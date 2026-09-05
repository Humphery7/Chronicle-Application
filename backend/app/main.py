import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.mongodb import close_mongo_connection, connect_to_mongo
from app.routes import ai, auth, health, journals
from app.services.ai.client import reset_clients
from app.services.media import MEDIA_ROOT
from transformers import pipeline
import torch

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s - %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("pymongo").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await connect_to_mongo()
    missing = settings.ai_missing_keys()
    if missing:
        logger.warning(
            f"AI features are disabled -- missing env vars: {', '.join(missing)}. "
            "Set them in backend/.env to enable transcription, reflection and chat."
        )

    device = 0 if torch.cuda.is_available() else -1
    logger.info(f"Loading ASR model: {settings.WHISPER_MODEL}")
    app.state.asr_pipeline = pipeline(
        "automatic-speech-recognition",
        model=settings.WHISPER_MODEL,
        device=device,
        token=settings.HUGGINGFACE_API_KEY or None,
    )
    logger.info("ASR model loaded successfully")

    logger.info(f"Loading TTS model: {settings.TTS_MODEL}")
    app.state.tts_pipeline = pipeline(
        "text-to-speech",
        model=settings.TTS_MODEL,
        device=device,
        token=settings.HUGGINGFACE_API_KEY or None,
    )
    logger.info("TTS model loaded successfully")
    yield

    await close_mongo_connection()
    if hasattr(app.state, "asr_pipeline"):
        del app.state.asr_pipeline
    if hasattr(app.state, "tts_pipeline"):
        del app.state.tts_pipeline
    reset_clients()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-powered voice journaling API: auth, journals, and AI reflection/chat.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred",
            "detail": str(exc) if settings.DEBUG else None,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.__class__.__name__, "message": exc.detail},
    )


# Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(journals.router, prefix=f"{settings.API_V1_STR}/journals", tags=["Journals"])
app.include_router(ai.router, prefix=f"{settings.API_V1_STR}/ai", tags=["AI"])
app.include_router(health.router, prefix=f"{settings.API_V1_STR}/health", tags=["Health"])

# Serve recorded + generated audio (journal recordings, TTS output)
app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")


@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
    }
