import logging

from pymongo import AsyncMongoClient

from app.core.config import settings

logger = logging.getLogger(__name__)

db_client: AsyncMongoClient | None = None
database = None


async def connect_to_mongo() -> None:
    """Open the MongoDB connection and ensure required indexes exist.

    Index creation is idempotent (MongoDB no-ops if the index already
    exists with the same spec) so it's safe to run on every startup.
    """
    global db_client, database
    db_client = AsyncMongoClient(settings.MONGODB_URL)
    database = db_client.get_database(settings.DATABASE_NAME)

    await _ensure_indexes(database)

    logger.info(f"Connected to MongoDB database '{settings.DATABASE_NAME}'")


async def _ensure_indexes(db) -> None:
    await db.users.create_index("email", unique=True)
    await db.journals.create_index([("user_id", 1), ("created_at", -1)])
    await db.messages.create_index([("journal_id", 1), ("created_at", 1)])


async def close_mongo_connection() -> None:
    global db_client
    if db_client:
        await db_client.close()
        logger.info("MongoDB connection closed")


def get_database():
    global database
    if database is None:
        raise RuntimeError("Database not initialized. Was connect_to_mongo() called?")
    return database
