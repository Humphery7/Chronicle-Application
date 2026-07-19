from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.common import PyObjectId


class UserDB(BaseModel):
    """Representation of a `users` document. Used for typing/reference;
    the services layer mostly works with raw dicts returned by Motor/PyMongo."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    email: EmailStr
    password_hash: Optional[str] = None
    full_name: Optional[str] = None
    picture: Optional[str] = None
    google_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
