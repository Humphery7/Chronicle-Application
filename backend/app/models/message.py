from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field

from app.models.common import PyObjectId


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"


class MessageDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    journal_id: PyObjectId
    user_id: PyObjectId
    role: MessageRole
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
