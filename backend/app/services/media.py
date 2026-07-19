from pathlib import Path

from app.core.config import settings

MEDIA_ROOT = Path(settings.MEDIA_ROOT)
AUDIO_DIR = MEDIA_ROOT / "audio"
TTS_DIR = MEDIA_ROOT / "tts"

AUDIO_DIR.mkdir(parents=True, exist_ok=True)
TTS_DIR.mkdir(parents=True, exist_ok=True)


def journal_audio_path(journal_id: str, extension: str = "m4a") -> Path:
    return AUDIO_DIR / f"{journal_id}.{extension}"


def tts_audio_path(cache_key: str) -> Path:
    return TTS_DIR / f"{cache_key}.wav"


def to_media_url(path: Path) -> str:
    """Convert an on-disk path under MEDIA_ROOT into the public /media/... URL
    the app mounts via StaticFiles."""
    relative = path.relative_to(MEDIA_ROOT)
    return f"/media/{relative.as_posix()}"
