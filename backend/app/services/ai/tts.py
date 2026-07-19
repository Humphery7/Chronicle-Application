import hashlib
import logging
from pathlib import Path

from app.core.config import settings
from app.services.ai.client import get_hf_client
from app.services.media import tts_audio_path, to_media_url

logger = logging.getLogger(__name__)


class TTSError(Exception):
    pass


def _cache_key(text: str) -> str:
    return hashlib.sha1(f"{settings.TTS_MODEL}:{text}".encode()).hexdigest()[:20]


async def synthesize_speech(text: str) -> str:
    """Convert text to speech, caching the result on disk by content hash,
    and return the public media URL for the audio file."""
    text = (text or "").strip()
    if not text:
        raise TTSError("Text cannot be empty")
    if len(text) > 2000:
        raise TTSError(f"Text too long: {len(text)} chars. Maximum: 2000 chars")
    if not settings.HUGGINGFACE_API_KEY:
        raise TTSError("Text-to-speech is not configured (missing HUGGINGFACE_API_KEY).")

    path: Path = tts_audio_path(_cache_key(text))
    if path.exists():
        return to_media_url(path)

    client = get_hf_client()
    try:
        audio_bytes = await client.text_to_speech(text, model=settings.TTS_MODEL)
    except Exception as e:
        logger.error(f"TTS request failed: {e}")
        raise TTSError(f"Text-to-speech conversion failed: {e}") from e

    if not audio_bytes:
        raise TTSError("TTS returned empty audio")

    path.write_bytes(audio_bytes)
    return to_media_url(path)
