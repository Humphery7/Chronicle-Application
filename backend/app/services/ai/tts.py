import hashlib
import logging
from pathlib import Path
import numpy as np
import wave

from app.core.config import settings
from app.services.media import tts_audio_path, to_media_url

logger = logging.getLogger(__name__)


class TTSError(Exception):
    pass


def _cache_key(text: str) -> str:
    return hashlib.sha1(f"{settings.TTS_MODEL}:{text}".encode()).hexdigest()[:20]


async def synthesize_speech(text: str, tts_pipeline=None) -> str:
    """Convert text to speech, caching the result on disk by content hash,
    and return the public media URL for the audio file."""
    text = (text or "").strip()
    if not text:
        raise TTSError("Text cannot be empty")
    if len(text) > 2000:
        raise TTSError(f"Text too long: {len(text)} chars. Maximum: 2000 chars")
    if tts_pipeline is None:
        raise TTSError("Text-to-speech pipeline is not initialized.")

    path: Path = tts_audio_path(_cache_key(text))
    if path.exists():
        return to_media_url(path)

    try:
        result = tts_pipeline(text)

        audio = result["audio"]
        sampling_rate = result["sampling_rate"]

        audio = np.asarray(audio)

        # Convert float audio [-1, 1] to 16-bit PCM
        audio = np.clip(audio, -1, 1)
        audio = (audio * 32767).astype(np.int16)

        with wave.open(str(path), "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sampling_rate)
            wav_file.writeframes(audio.tobytes())

    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")
        raise TTSError(
            f"Text-to-speech conversion failed: {e}"
        ) from e

    if not path.exists() or path.stat().st_size == 0:
        raise TTSError("TTS returned empty audio")

    return to_media_url(path)