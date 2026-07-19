import logging

from fastapi import UploadFile

from app.core.config import settings
from app.services.ai.client import get_hf_client

logger = logging.getLogger(__name__)


class ASRError(Exception):
    """Raised for any recoverable ASR failure (bad upload, empty result, etc)."""


async def validate_audio_upload(file: UploadFile) -> bytes:
    """Validate content-type/size and return the raw audio bytes."""
    if file.content_type and file.content_type not in settings.ALLOWED_AUDIO_CONTENT_TYPES:
        allowed = ", ".join(sorted(settings.ALLOWED_AUDIO_CONTENT_TYPES))
        raise ASRError(f"Unsupported audio type '{file.content_type}'. Allowed: {allowed}")

    data = await file.read()
    if not data:
        raise ASRError("Empty audio file")
    if len(data) > settings.max_audio_file_size_bytes:
        actual_mb = len(data) / (1024 * 1024)
        raise ASRError(
            f"File too large: {actual_mb:.1f}MB. Maximum allowed: {settings.MAX_AUDIO_FILE_SIZE_MB}MB"
        )
    return data


async def transcribe_audio(audio_bytes: bytes) -> dict:
    """Transcribe raw audio bytes to text using the configured Whisper model."""
    if not settings.HUGGINGFACE_API_KEY:
        raise ASRError("Speech-to-text is not configured (missing HUGGINGFACE_API_KEY).")

    client = get_hf_client()
    try:
        result = await client.automatic_speech_recognition(audio_bytes, model=settings.WHISPER_MODEL)
    except Exception as e:  # HF client raises a variety of httpx/huggingface errors
        logger.error(f"ASR request failed: {e}")
        raise ASRError(f"Transcription failed: {e}") from e

    if isinstance(result, dict):
        text = result.get("text", "")
    elif isinstance(result, str):
        text = result
    else:
        text = str(getattr(result, "text", result))

    text = (text or "").strip()
    if not text:
        raise ASRError("Transcription returned empty text. Please try recording again.")

    return {"text": text, "language": "en"}
