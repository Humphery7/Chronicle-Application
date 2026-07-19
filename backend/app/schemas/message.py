from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.message import MessageRole


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)

    @field_validator("content")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message cannot be empty")
        return v.strip()


class MessageOut(BaseModel):
    id: str = Field(..., alias="_id")
    role: MessageRole
    content: str
    created_at: datetime

    class Config:
        populate_by_name = True


class ChatTurnOut(BaseModel):
    """Returned after posting a user message: the user's stored message
    plus the assistant's generated reply, so the client can append both
    in one round trip."""

    user_message: MessageOut
    assistant_message: MessageOut
