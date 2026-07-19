import logging

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from app.core.config import settings
from app.services.ai.client import get_llm
from app.services.ai.prompts import CBT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


class ChatError(Exception):
    pass


async def generate_chat_reply(transcript: str, history: list[dict]) -> str:
    """Generate the next assistant turn.

    `history` is a chronological list of {"role": "user"|"assistant", "content": str}
    already persisted in MongoDB -- there is no in-memory session state, so the
    reply is fully reproducible from what's in the database (safe across
    server restarts / multiple backend instances).
    """
    if not settings.LLM_API_KEY:
        raise ChatError("AI chat is not configured (missing LLM_API_KEY).")

    llm = get_llm()

    messages: list[BaseMessage] = [
        SystemMessage(
            content=(
                f"{CBT_SYSTEM_PROMPT}\n\nFor context, here is the original journal entry "
                f"this conversation is about:\n\"\"\"{transcript}\"\"\""
            )
        )
    ]

    recent_history = history[-settings.CONVERSATION_HISTORY_SIZE :]
    for turn in recent_history:
        if turn["role"] == "user":
            messages.append(HumanMessage(content=turn["content"]))
        else:
            messages.append(AIMessage(content=turn["content"]))

    try:
        result = await llm.ainvoke(messages)
        text = result.content if hasattr(result, "content") else str(result)
    except Exception as e:
        logger.error(f"Chat generation failed: {e}")
        raise ChatError(f"Failed to generate a response: {e}") from e

    text = (text or "").strip()
    if not text:
        raise ChatError("The AI returned an empty response. Please try again.")
    return text
