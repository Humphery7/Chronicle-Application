import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, UploadFile, status

from app.db.mongodb import get_database
from app.models.journal import JournalStatus, Mood
from app.models.message import MessageRole
from app.services.ai.asr import ASRError, transcribe_audio, validate_audio_upload
from app.services.ai.chat import ChatError, generate_chat_reply
from app.services.ai.reflection import ReflectionError, generate_reflection
from app.services.media import journal_audio_path, to_media_url

logger = logging.getLogger(__name__)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal not found")


async def create_journal_from_audio(
    user_id: ObjectId, file: UploadFile, mood: Mood, duration_seconds: float = 0.0, asr_pipeline=None
) -> dict:
    """End-to-end: validate + persist the audio, transcribe it, generate the
    first AI reflection, and store everything as one journal document with
    the reflection also seeded into the conversation as the first assistant
    message (so aiReflection and aiLiveConversation share one data source).
    """
    db = get_database()

    try:
        audio_bytes = await validate_audio_upload(file)
    except ASRError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    now = datetime.now(timezone.utc)
    journal_doc = {
        "user_id": user_id,
        "title": None,
        "transcript": "",
        "mood": mood.value,
        "duration_seconds": duration_seconds,
        "audio_path": None,
        "status": JournalStatus.processing.value,
        "reflection": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.journals.insert_one(journal_doc)
    journal_id = result.inserted_id

    # Persist the raw audio to disk, keyed by journal id.
    extension = _extension_from_content_type(file.content_type) or "m4a"
    audio_path = journal_audio_path(str(journal_id), extension)
    audio_path.write_bytes(audio_bytes)

    update: dict = {
        "audio_path": str(audio_path),
        "updated_at": datetime.now(timezone.utc),
    }

    try:
        transcription = await transcribe_audio(audio_bytes, asr_pipeline)
        transcript = transcription["text"]
        update["transcript"] = transcript
        update["title"] = _derive_title(transcript)

        reflection = await generate_reflection(transcript)
        update["reflection"] = reflection
        update["status"] = JournalStatus.ready.value

        body_text = "\n\n".join(reflection.get("body") or [])
        content = body_text if body_text else reflection.get("title", "")

        await db.messages.insert_one(
            {
                "journal_id": journal_id,
                "user_id": user_id,
                "role": MessageRole.assistant.value,
                "content": content,
                "created_at": datetime.now(timezone.utc),
            }
        )
    except (ASRError, ReflectionError) as e:
        logger.warning(f"Journal {journal_id} processing failed: {e}")
        update["status"] = JournalStatus.failed.value
        update["transcript"] = update.get("transcript", "")

    await db.journals.update_one({"_id": journal_id}, {"$set": update})
    return await db.journals.find_one({"_id": journal_id})


def _extension_from_content_type(content_type: str | None) -> str | None:
    mapping = {
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
        "audio/m4a": "m4a",
        "audio/aac": "aac",
        "audio/webm": "webm",
    }
    return mapping.get(content_type or "")


def _derive_title(transcript: str, max_words: int = 6) -> str:
    words = transcript.strip().split()
    if not words:
        return "Untitled entry"
    title = " ".join(words[:max_words])
    return title + ("…" if len(words) > max_words else "")


async def list_journals(user_id: ObjectId, limit: int = 50) -> list[dict]:
    db = get_database()
    cursor = db.journals.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    return [doc async for doc in cursor]


async def get_journal(user_id: ObjectId, journal_id: str) -> dict:
    db = get_database()
    try:
        oid = ObjectId(journal_id)
    except Exception:
        raise _not_found()
    doc = await db.journals.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise _not_found()
    return doc


async def update_journal(user_id: ObjectId, journal_id: str, updates: dict) -> dict:
    db = get_database()
    doc = await get_journal(user_id, journal_id)
    changes = {k: v for k, v in updates.items() if v is not None}
    if changes:
        changes["updated_at"] = datetime.now(timezone.utc)
        await db.journals.update_one({"_id": doc["_id"]}, {"$set": changes})
        doc = await db.journals.find_one({"_id": doc["_id"]})
    return doc


async def delete_journal(user_id: ObjectId, journal_id: str) -> None:
    db = get_database()
    doc = await get_journal(user_id, journal_id)
    await db.messages.delete_many({"journal_id": doc["_id"]})
    await db.journals.delete_one({"_id": doc["_id"]})
    audio_path = doc.get("audio_path")
    if audio_path:
        from pathlib import Path

        p = Path(audio_path)
        if p.exists():
            p.unlink()


def journal_to_response(doc: dict) -> dict:
    """Shape a raw Mongo document into the API response dict."""
    audio_url = None
    if doc.get("audio_path"):
        from pathlib import Path

        audio_url = to_media_url(Path(doc["audio_path"]))

    return {
        "_id": str(doc["_id"]),
        "title": doc.get("title"),
        "transcript": doc.get("transcript", ""),
        "mood": doc.get("mood", Mood.calm.value),
        "duration_seconds": doc.get("duration_seconds", 0.0),
        "audio_url": audio_url,
        "status": doc.get("status", JournalStatus.processing.value),
        "reflection": doc.get("reflection"),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


def journal_to_summary(doc: dict) -> dict:
    transcript = doc.get("transcript", "")
    preview = transcript[:140] + ("…" if len(transcript) > 140 else "")
    return {
        "_id": str(doc["_id"]),
        "title": doc.get("title"),
        "preview": preview or "Processing your entry…",
        "mood": doc.get("mood", Mood.calm.value),
        "duration_seconds": doc.get("duration_seconds", 0.0),
        "status": doc.get("status", JournalStatus.processing.value),
        "created_at": doc["created_at"],
    }


# ---------------------------------------------------------------------------
# Conversation (messages) on top of a journal
# ---------------------------------------------------------------------------


async def list_messages(user_id: ObjectId, journal_id: str) -> list[dict]:
    journal = await get_journal(user_id, journal_id)
    db = get_database()
    cursor = db.messages.find({"journal_id": journal["_id"]}).sort("created_at", 1)
    return [doc async for doc in cursor]


async def post_message(user_id: ObjectId, journal_id: str, content: str) -> tuple[dict, dict]:
    """Store the user's message, generate the assistant's reply from full
    history, store that too, and return both documents."""
    journal = await get_journal(user_id, journal_id)
    db = get_database()

    now = datetime.now(timezone.utc)
    user_msg = {
        "journal_id": journal["_id"],
        "user_id": user_id,
        "role": MessageRole.user.value,
        "content": content,
        "created_at": now,
    }
    user_result = await db.messages.insert_one(user_msg)
    user_msg["_id"] = user_result.inserted_id

    history_cursor = db.messages.find({"journal_id": journal["_id"]}).sort("created_at", 1)
    history = [{"role": m["role"], "content": m["content"]} async for m in history_cursor]

    try:
        reply_text = await generate_chat_reply(journal.get("transcript", ""), history)
    except ChatError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    assistant_msg = {
        "journal_id": journal["_id"],
        "user_id": user_id,
        "role": MessageRole.assistant.value,
        "content": reply_text,
        "created_at": datetime.now(timezone.utc),
    }
    assistant_result = await db.messages.insert_one(assistant_msg)
    assistant_msg["_id"] = assistant_result.inserted_id

    return user_msg, assistant_msg


def message_to_response(doc: dict) -> dict:
    return {
        "_id": str(doc["_id"]),
        "role": doc["role"],
        "content": doc["content"],
        "created_at": doc["created_at"],
    }
