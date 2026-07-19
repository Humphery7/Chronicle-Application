from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.models.common import PyObjectId


class Mood(str, Enum):
    calm = "Calm"
    low = "Low"
    frustrated = "Frustrated"
    happy = "Happy"
    anxious = "Anxious"


class JournalStatus(str, Enum):
    processing = "processing"  # audio uploaded, transcription/reflection in flight
    ready = "ready"            # transcript + AI reflection available
    failed = "failed"          # AI processing failed; transcript may still exist


class AIReflection(BaseModel):
    """Structured first reflection generated right after a journal entry."""

    title: str
    body: list[str] = Field(default_factory=list)
    highlight_word: Optional[str] = None


class JournalDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    title: Optional[str] = None
    transcript: str = ""
    mood: Mood = Mood.calm
    duration_seconds: float = 0.0
    audio_path: Optional[str] = None
    status: JournalStatus = JournalStatus.processing
    reflection: Optional[AIReflection] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
