"""Lazily-initialized AI clients shared across the ASR / TTS / chat services.

Kept separate from FastAPI's dependency-injection system on purpose: these
clients are cheap, stateless HTTP wrappers, so a simple module-level cache
initialized on first use (and torn down on shutdown) is enough and keeps the
AI layer usable from services, scripts, and tests alike.
"""

import logging

from huggingface_hub import AsyncInferenceClient

from app.core.config import settings

logger = logging.getLogger(__name__)

_hf_client: AsyncInferenceClient | None = None
_llm = None


def get_hf_client() -> AsyncInferenceClient:
    global _hf_client
    if _hf_client is None:
        _hf_client = AsyncInferenceClient(
            token=settings.HUGGINGFACE_API_KEY or None,
            timeout=settings.HF_TIMEOUT,
        )
        logger.info("HuggingFace AsyncInferenceClient initialized")
    return _hf_client


def get_llm():
    """Returns a LangChain chat model for the configured LLM provider.

    Only Gemini is wired up today (matching the AI prototype this was
    integrated from), but this is the single seam to extend if another
    provider is added later.
    """
    global _llm
    if _llm is None:
        if settings.LLM_PROVIDER == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI

            _llm = ChatGoogleGenerativeAI(
                model=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
                api_key=settings.LLM_API_KEY or None,
            )
        else:
            raise RuntimeError(f"Unsupported LLM provider: {settings.LLM_PROVIDER}")
        logger.info(f"LLM initialized: {settings.LLM_PROVIDER}/{settings.LLM_MODEL}")
    return _llm


def reset_clients() -> None:
    """Used on app shutdown / in tests to drop cached clients."""
    global _hf_client, _llm
    _hf_client = None
    _llm = None
