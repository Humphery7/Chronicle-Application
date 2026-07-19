from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.db.mongodb import get_database

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    """Resolve the authenticated user from the Bearer JWT.

    Shared by every router that needs auth (journals, messages, ai, auth/me)
    so there is exactly one place that decides what "authenticated" means.
    """
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db = get_database()
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    return user


def user_object_id(user: dict) -> ObjectId:
    """Normalize the current user's _id (already an ObjectId from Mongo)."""
    try:
        return user["_id"] if isinstance(user["_id"], ObjectId) else ObjectId(user["_id"])
    except (InvalidId, KeyError, TypeError):
        raise credentials_exception
