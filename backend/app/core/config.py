from typing import Literal, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central, type-safe application configuration.

    All values are loaded from environment variables / `.env`. This is the
    single source of truth for configuration across the API, auth and AI
    services -- there is intentionally only one settings object in the
    whole backend so behaviour never diverges between modules.
    """

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # --- Project ---
    PROJECT_NAME: str = "Chronicle API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: Literal["development", "production"] = "development"
    DEBUG: bool = True

    # --- CORS ---
    # Kept as a raw string (comma-separated, or "*") rather than list[str] so
    # pydantic-settings doesn't try to JSON-decode it from the .env file.
    CORS_ORIGINS: str = "*"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # --- Database ---
    MONGODB_URL: str
    DATABASE_NAME: str = "Chronicle"

    # --- Security ---
    JWT_SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # --- Google OAuth ---
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # --- AI: HuggingFace (ASR + TTS) ---
    HUGGINGFACE_API_KEY: str = ""
    WHISPER_MODEL: str = "openai/whisper-large-v3-turbo"
    TTS_MODEL: str = "facebook/mms-tts-eng"
    HF_TIMEOUT: int = 300

    # --- AI: LLM (conversational reflection) ---
    LLM_PROVIDER: Literal["gemini"] = "gemini"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.0-flash"
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 600
    CONVERSATION_HISTORY_SIZE: int = 12

    # --- Media / uploads ---
    MEDIA_ROOT: str = "media"
    MAX_AUDIO_FILE_SIZE_MB: int = 25
    ALLOWED_AUDIO_CONTENT_TYPES: set[str] = {
        "audio/wav",
        "audio/x-wav",
        "audio/mpeg",
        "audio/mp4",
        "audio/x-m4a",
        "audio/m4a",
        "audio/aac",
        "audio/webm",
        "application/octet-stream",  # some RN recorders omit a precise mime type
    }

    @property
    def max_audio_file_size_bytes(self) -> int:
        return self.MAX_AUDIO_FILE_SIZE_MB * 1024 * 1024

    def ai_missing_keys(self) -> list[str]:
        """Keys required for AI features. The API still boots without them,
        but AI endpoints will return a clear 503 instead of a stack trace."""
        missing = []
        if not self.HUGGINGFACE_API_KEY:
            missing.append("HUGGINGFACE_API_KEY")
        if not self.LLM_API_KEY:
            missing.append("LLM_API_KEY")
        return missing


settings = Settings()
