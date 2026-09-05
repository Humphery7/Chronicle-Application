import logging
import os
import subprocess
import tempfile

from fastapi import UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)


class ASRError(Exception):
    """Raised for any recoverable ASR failure (bad upload, empty result, etc)."""


async def validate_audio_upload(file: UploadFile) -> bytes:
    """Validate content-type/size and return the raw audio bytes."""

    if (
        file.content_type
        and file.content_type not in settings.ALLOWED_AUDIO_CONTENT_TYPES
    ):
        allowed = ", ".join(sorted(settings.ALLOWED_AUDIO_CONTENT_TYPES))
        raise ASRError(
            f"Unsupported audio type '{file.content_type}'. "
            f"Allowed: {allowed}"
        )

    data = await file.read()

    if not data:
        raise ASRError("Empty audio file")

    if len(data) > settings.max_audio_file_size_bytes:
        actual_mb = len(data) / (1024 * 1024)
        raise ASRError(
            f"File too large: {actual_mb:.1f}MB. Maximum allowed: "
            f"{settings.MAX_AUDIO_FILE_SIZE_MB}MB"
        )

    return data


async def transcribe_audio(audio_bytes: bytes, asr_pipeline=None) -> dict:
    """Convert uploaded audio to WAV, then transcribe it with Whisper."""

    if asr_pipeline is None:
        raise ASRError("Speech-to-text pipeline is not initialized.")

    input_path = None
    result = None

    try:
        logger.info(
            "🎙️ AUDIO: size=%d bytes, first16=%s",
            len(audio_bytes),
            audio_bytes[:16].hex(),
        )

        # ---------------------------------------------------------
        # 1. Save the original uploaded M4A for debugging
        # ---------------------------------------------------------
        with open("debug.m4a", "wb") as f:
            f.write(audio_bytes)

        logger.info(
            "🎙️ DEBUG M4A: saved (%d bytes)",
            len(audio_bytes),
        )

        # ---------------------------------------------------------
        # 2. Save uploaded audio to a temporary M4A file
        # ---------------------------------------------------------
        with tempfile.NamedTemporaryFile(
            suffix=".m4a",
            delete=False,
        ) as input_file:
            input_file.write(audio_bytes)
            input_path = input_file.name

        # ---------------------------------------------------------
        # 3. Convert M4A → 16 kHz mono WAV using FFmpeg
        # ---------------------------------------------------------
        with tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False,
        ) as output_file:
            debug_wav_path = output_file.name

        process = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                input_path,
                "-ar",
                "16000",
                "-ac",
                "1",
                "-f",
                "wav",
                debug_wav_path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        if process.returncode != 0:
            ffmpeg_error = process.stderr.decode(errors="ignore")

            logger.error(
                "FFmpeg conversion failed:\n%s",
                ffmpeg_error,
            )

            raise ASRError("Could not decode the audio file.")

        # ---------------------------------------------------------
        # 4. Confirm the WAV was actually created
        # ---------------------------------------------------------
        wav_size = os.path.getsize(debug_wav_path)

        logger.info(
            "🎙️ DEBUG WAV: saved (%d bytes)",
            wav_size,
        )

        if wav_size < 1000:
            raise ASRError(
                "Audio conversion produced an invalid WAV file."
            )

        # ---------------------------------------------------------
        # 5. Give the WAV file to Whisper
        # ---------------------------------------------------------
        logger.info("🎙️ Sending debug.wav to Whisper...")

        result = asr_pipeline(
            debug_wav_path,
            return_timestamps=True,
        )

        logger.info("🎙️ Whisper transcription completed.")

    except ASRError:
        raise

    except Exception as e:
        logger.error(
            "ASR request failed: %s",
            e,
            exc_info=True,
        )
        raise ASRError(
            f"Transcription failed: {e}"
        ) from e

    finally:
        # ---------------------------------------------------------
        # 6. Delete only the temporary M4A
        #
        # debug.m4a and debug.wav intentionally remain on disk
        # so you can inspect/listen to them.
        # ---------------------------------------------------------
        if input_path:
            try:
                os.remove(input_path)
            except OSError:
                pass

        if debug_wav_path:
            try:
                os.remove(debug_wav_path)
            except OSError:
                pass

    text = result.get("text", "").strip()

    if not text:
        raise ASRError(
            "Transcription returned empty text. "
            "Please try recording again."
        )
    
    logger.info("🎙️ Whisper transcription result: %s", text)

    return {
        "text": text,
        "language": "en",
    }