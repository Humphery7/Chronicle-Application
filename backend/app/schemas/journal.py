from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.journal import JournalStatus, Mood


class AIReflectionOut(BaseModel):
    title: str
    body: list[str]
    highlight_word: Optional[str] = None


class JournalOut(BaseModel):
    id: str = Field(..., alias="_id")
    title: Optional[str] = None
    transcript: str
    mood: Mood
    duration_seconds: float
    audio_url: Optional[str] = None
    status: JournalStatus
    reflection: Optional[AIReflectionOut] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class JournalSummaryOut(BaseModel):
    """Lightweight shape used for list views (dashboard recents, history)."""

    id: str = Field(..., alias="_id")
    title: Optional[str] = None
    preview: str
    mood: Mood
    duration_seconds: float
    status: JournalStatus
    created_at: datetime

    class Config:
        populate_by_name = True


class JournalUpdate(BaseModel):
    title: Optional[str] = None
    mood: Optional[Mood] = None
