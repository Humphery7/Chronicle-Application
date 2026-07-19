from datetime import datetime, timezone

from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.db.mongodb import get_database
from app.schemas.user import UserCreate, UserLogin


async def register_user(user_in: UserCreate) -> dict:
    db = get_database()
    existing_user = await db.users.find_one({"email": user_in.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )

    user_dict = {
        "email": user_in.email,
        "password_hash": get_password_hash(user_in.password),
        "full_name": None,
        "picture": None,
        "google_id": None,
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.users.insert_one(user_dict)
    return await db.users.find_one({"_id": result.inserted_id})


async def authenticate_user(user_in: UserLogin) -> dict | None:
    db = get_database()
    user = await db.users.find_one({"email": user_in.email})
    if not user or not user.get("password_hash"):
        return None
    if not verify_password(user_in.password, user["password_hash"]):
        return None
    return user


async def authenticate_google_user(oauth_token: str) -> dict | None:
    if not settings.GOOGLE_CLIENT_ID:
        return None

    try:
        idinfo = id_token.verify_oauth2_token(
            oauth_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError:
        return None

    email = idinfo["email"]
    db = get_database()
    user = await db.users.find_one({"email": email})

    if not user:
        user_dict = {
            "email": email,
            "password_hash": None,
            "full_name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "google_id": idinfo["sub"],
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(user_dict)
        user = await db.users.find_one({"_id": result.inserted_id})

    return user
