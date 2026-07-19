import json
import logging
import re

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.services.ai.client import get_llm
from app.services.ai.prompts import CBT_SYSTEM_PROMPT, REFLECTION_INSTRUCTIONS

logger = logging.getLogger(__name__)


class ReflectionError(Exception):
    pass


def _extract_json(raw: str) -> dict:
    """LLMs love to wrap JSON in markdown fences despite instructions not to.
    Strip those defensively before parsing."""
    text = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)
    else:
        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        if brace_match:
            text = brace_match.group(0)
    return json.loads(text)


async def generate_reflection(transcript: str) -> dict:
    """Return {"title": str, "body": [str, ...], "highlight_word": str | None}."""
    if not settings.LLM_API_KEY:
        raise ReflectionError("AI reflection is not configured (missing LLM_API_KEY).")

    llm = get_llm()
    messages = [
        SystemMessage(content=CBT_SYSTEM_PROMPT),
        HumanMessage(content=REFLECTION_INSTRUCTIONS.format(transcript=transcript)),
    ]

    try:
        result = await llm.ainvoke(messages)
        raw_text = result.content if hasattr(result, "content") else str(result)
        parsed = _extract_json(raw_text)
    except json.JSONDecodeError:
        logger.warning("Reflection response was not valid JSON; falling back to plain text")
        return {
            "title": "Your reflection",
            "body": [raw_text.strip()] if raw_text else ["Thanks for sharing that with me."],
            "highlight_word": None,
        }
    except Exception as e:
        logger.error(f"Reflection generation failed: {e}")
        raise ReflectionError(f"Failed to generate AI reflection: {e}") from e

    return {
        "title": parsed.get("title") or "Your reflection",
        "body": parsed.get("body") or [],
        "highlight_word": parsed.get("highlight_word"),
    }
