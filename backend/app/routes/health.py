from fastapi import APIRouter

from app.core.config import settings
from app.db.mongodb import get_database

router = APIRouter()


@router.get("")
async def health_check():
    services: dict[str, str] = {}

    try:
        db = get_database()
        await db.command("ping")
        services["mongodb"] = "connected"
    except Exception as e:
        services["mongodb"] = f"error: {e}"

    missing = settings.ai_missing_keys()
    services["ai"] = "configured" if not missing else f"missing: {', '.join(missing)}"

    overall = "healthy" if services["mongodb"] == "connected" else "degraded"
    return {
        "status": overall,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "services": services,
    }
