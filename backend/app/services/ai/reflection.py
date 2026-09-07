import logging
import re

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.services.ai.client import get_llm
from app.services.ai.prompts import CBT_REFLECTION_SYSTEM_PROMPT
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)


class ReflectionError(Exception):
    pass


def _extract_title_and_body(raw: str) -> tuple[str, list[str], str | None]:
    """Parse the LLM's plain-text response into (title, body[], highlight_word).

    First line becomes the title (stripped of any 'Title:' prefix).
    Everything after the first line becomes the body, split on blank lines
    into paragraphs.
    """
    text = (raw or "").strip()

    # Strip leading markdown/title markers the model sometimes adds.
    text = re.sub(r"^#+\s*", "", text)
    text = re.sub(r"^\*+(.+?)\*+\s*$", r"\1", text, count=1, flags=re.MULTILINE)

    # Drop optional code fences the model may have wrapped the response in.
    text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    if not text:
        return "Your reflection", ["Thanks for sharing your thoughts."], None

    # Split on blank lines first.
    if "\n\n" in text:
        chunks = [c.strip() for c in text.split("\n\n") if c.strip()]
    else:
        chunks = [c.strip() for c in text.split("\n") if c.strip()]

    if not chunks:
        return "Your reflection", ["Thanks for sharing your thoughts."], None

    # First chunk is the title. Strip any 'Title:' prefix.
    title = re.sub(r"^(title\s*[:\-])\s*", "", chunks[0], flags=re.IGNORECASE).strip()
    if len(title.split()) > 15:
        title = " ".join(title.split()[:8]).rstrip(",.;:") + "…"

    # Remaining chunks form the body.
    body_chunks = chunks[1:]

    # If the model gave everything on one line after title,
    # split on sentence boundaries if chunk is long enough.
    if len(body_chunks) == 1 and len(body_chunks[0].split()) > 40:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", body_chunks[0]) if s.strip()]
        if len(sentences) >= 4:
            third = max(2, len(sentences) // 3)
            body = [
                " ".join(sentences[:third]).strip(),
                " ".join(sentences[third : 2 * third]).strip(),
                " ".join(sentences[2 * third :]).strip(),
            ]
        else:
            body = body_chunks
    else:
        body = body_chunks

    body = [b.strip() for b in body if b.strip()]

    if not body:
        body = ["Thanks for sharing your thoughts."]

    return title or "Your reflection", body, None


async def generate_reflection(transcript: str) -> dict:
    """Return {"title": str, "body": [str, ...], "highlight_word": str | None}.

    Uses the CBT reflection system prompt and context formatting. The model
    produces a multi-paragraph reflection. We extract a title from the first
    line and parse the remaining paragraphs.
    """
    if not settings.LLM_API_KEY:
        raise ReflectionError("AI reflection is not configured (missing LLM_API_KEY).")

    # llm = get_llm()
    llm = ChatGoogleGenerativeAI(
        model=settings.LLM_MODEL,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=settings.LLM_MAX_TOKENS,
        thinking_budget=0,
        api_key=settings.LLM_API_KEY or None,
    )

    system = (
        f"{CBT_REFLECTION_SYSTEM_PROMPT}\n\nFor context, here is the original journal entry "
        f"this user just recorded:\n\"\"\"{transcript}\"\"\""
    )

    user = (
        "Write a warm, supportive CBT reflection on this journal entry.\n\n"
        "Start with a short, warm 3-8 word title on the first line.\n"
        "Then write 2 to 3 thoughtful paragraphs of reflection, separated by blank lines.\n"
        "Stay in character as Chronicle: warm, empathetic, gently notice any cognitive distortions you see."
    )

    messages = [
        SystemMessage(content=system),
        HumanMessage(content=user),
    ]

    try:
        result = await llm.ainvoke(messages)
        raw_text = result.content if hasattr(result, "content") else str(result)
        logger.info(f"Result: {result}")
        logger.info(f"Response metadata: {getattr(result, 'response_metadata', None)}")
        logger.info(f"Usage metadata: {getattr(result, 'usage_metadata', None)}")
    except Exception as e:
        logger.error(f"Reflection generation failed: {e}")
        raise ReflectionError(f"Failed to generate a reflection: {e}") from e


    title, body, highlight = _extract_title_and_body(raw_text)

    return {
        "title": title,
        "body": body,
        "highlight_word": highlight,
    }