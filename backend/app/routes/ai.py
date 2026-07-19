from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.deps import get_current_user
from app.schemas.ai import TranscriptionOut, TTSOut, TTSRequest
from app.services.ai.asr import ASRError, transcribe_audio, validate_audio_upload
from app.services.ai.tts import TTSError, synthesize_speech

router = APIRouter()


@router.post("/transcribe", response_model=TranscriptionOut)
async def transcribe(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Quick standalone transcription -- used by the mic button inside the
    live-conversation input bar (doesn't create a journal entry)."""
    try:
        audio_bytes = await validate_audio_upload(file)
        result = await transcribe_audio(audio_bytes)
    except ASRError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return result


@router.post("/tts", response_model=TTSOut)
async def text_to_speech(payload: TTSRequest, current_user: dict = Depends(get_current_user)):
    try:
        audio_url = await synthesize_speech(payload.text)
    except TTSError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"audio_url": audio_url, "format": "wav"}
