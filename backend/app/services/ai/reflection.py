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
    """Extract JSON object from LLM output, handling code block fences and truncated JSON."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    
    first_brace = text.find("{")
    if first_brace != -1:
        text = text[first_brace:]
    
    # Try standard parse or repair truncated JSON by appending closing syntax
    for suffix in ["", '"]}', '"}]', ']}', '}']:
        try:
            return json.loads(text + suffix, strict=False)
        except Exception:
            pass

    # Regex extraction fallback if JSON syntax is severely broken/truncated
    title_match = re.search(r'"title"\s*:\s*"([^"]+)"', text)
    body_matches = re.findall(r'"((?:[^"\\]|\\.)+)"', text)
    
    title = title_match.group(1) if title_match else "Your reflection"
    body = [
        m for m in body_matches 
        if m not in ("title", "body", "highlight_word") and len(m) > 15
    ]

    return {
        "title": title,
        "body": body if body else ["Thanks for sharing your thoughts."],
        "highlight_word": None,
    }


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
        body = parsed.get("body")
        if isinstance(body, str):
            body = [body]
        elif not isinstance(body, list):
            body = ["Thanks for sharing your thoughts."]

        return {
            "title": parsed.get("title") or "Your reflection",
            "body": body,
            "highlight_word": parsed.get("highlight_word"),
        }
    except Exception as e:
        logger.warning(f"Reflection generation fallback: {e}")
        raw = raw_text.strip() if 'raw_text' in locals() and raw_text else ""
        return {
            "title": "Your reflection",
            "body": [p.strip() for p in raw.split("\n\n") if p.strip()] if raw else ["Thanks for sharing your thoughts."],
            "highlight_word": None,
        }
