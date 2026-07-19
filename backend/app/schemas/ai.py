from pydantic import BaseModel, Field


class TranscriptionOut(BaseModel):
    text: str
    language: str = "en"


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class TTSOut(BaseModel):
    audio_url: str
    format: str = "wav"
