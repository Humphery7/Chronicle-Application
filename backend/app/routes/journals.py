import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.core.deps import get_current_user, user_object_id
from app.models.journal import Mood
from app.schemas.journal import JournalOut, JournalSummaryOut, JournalUpdate
from app.schemas.message import ChatTurnOut, MessageCreate, MessageOut
from app.services import journal_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=JournalOut, status_code=status.HTTP_201_CREATED)
async def create_journal(
    file: UploadFile = File(..., description="Recorded audio (m4a/wav/mp3)"),
    mood: Mood = Form(Mood.calm),
    duration_seconds: float = Form(0.0),
    current_user: dict = Depends(get_current_user),
):
    """Upload a voice recording; the server transcribes it, generates the
    first AI reflection, and returns the full journal entry in one call."""
    doc = await journal_service.create_journal_from_audio(
        user_object_id(current_user), file, mood, duration_seconds
    )
    return journal_service.journal_to_response(doc)


@router.get("", response_model=list[JournalSummaryOut])
async def list_journals(current_user: dict = Depends(get_current_user)):
    docs = await journal_service.list_journals(user_object_id(current_user))
    return [journal_service.journal_to_summary(d) for d in docs]


@router.get("/{journal_id}", response_model=JournalOut)
async def get_journal(journal_id: str, current_user: dict = Depends(get_current_user)):
    doc = await journal_service.get_journal(user_object_id(current_user), journal_id)
    return journal_service.journal_to_response(doc)


@router.patch("/{journal_id}", response_model=JournalOut)
async def update_journal(
    journal_id: str, payload: JournalUpdate, current_user: dict = Depends(get_current_user)
):
    updates = payload.model_dump(exclude_unset=True)
    if "mood" in updates and updates["mood"] is not None:
        updates["mood"] = updates["mood"].value if hasattr(updates["mood"], "value") else updates["mood"]
    doc = await journal_service.update_journal(user_object_id(current_user), journal_id, updates)
    return journal_service.journal_to_response(doc)


@router.delete("/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal(journal_id: str, current_user: dict = Depends(get_current_user)):
    await journal_service.delete_journal(user_object_id(current_user), journal_id)


@router.get("/{journal_id}/messages", response_model=list[MessageOut])
async def list_messages(journal_id: str, current_user: dict = Depends(get_current_user)):
    docs = await journal_service.list_messages(user_object_id(current_user), journal_id)
    return [journal_service.message_to_response(d) for d in docs]


@router.post("/{journal_id}/messages", response_model=ChatTurnOut, status_code=status.HTTP_201_CREATED)
async def post_message(
    journal_id: str, payload: MessageCreate, current_user: dict = Depends(get_current_user)
):
    """Post a user message to the journal's conversation and get the AI's
    reply back in the same response (used by the live conversation screen)."""
    user_msg, assistant_msg = await journal_service.post_message(
        user_object_id(current_user), journal_id, payload.content
    )
    return {
        "user_message": journal_service.message_to_response(user_msg),
        "assistant_message": journal_service.message_to_response(assistant_msg),
    }
