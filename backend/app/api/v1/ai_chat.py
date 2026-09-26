"""Wanderers AI travel assistant — Hugging Face Serverless endpoint."""
from __future__ import annotations

import httpx
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.cache import rate_limit_check

router = APIRouter()

logger = logging.getLogger("wanderer.ai")

SYSTEM_PROMPT = """
You are Wanderers AI, the travel assistant inside Wanderers.

Wanderers is an Indian travel-discovery platform focused on helping people
discover beautiful, culturally meaningful, lesser-known destinations across
India while supporting responsible tourism and local communities.

Your responsibilities:
1. Help users discover destinations in India.
2. Prefer useful, specific travel information.
3. Encourage responsible and respectful tourism.
4. Do not invent live weather, hotel availability, ticket prices, road
   conditions, opening hours, or other real-time information.
5. When live information is required, suggest the user check the Wanderers
   weather panel or map for current data, or use the provided tools.
6. Keep answers concise unless the user asks for detail.
7. Tone: Friendly, modern, knowledgeable, concise, adventurous, and professional.
"""

class ChatMessage(BaseModel):
    content: str = Field(min_length=1, max_length=3000)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=3000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=10)

@router.post("/chat")
async def ai_chat(request: Request, body: ChatRequest):
    if not settings.HUGGINGFACE_API_KEY:
        raise HTTPException(status_code=503, detail="AI service is not configured")
    client_key = request.client.host if request.client else "unknown"
    if not rate_limit_check(f"ai:{client_key}", 10, 60):
        raise HTTPException(status_code=429, detail="AI request limit reached. Try again shortly.")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.HUGGINGFACE_API_KEY}",
    }

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    total_size = len(body.message) + sum(len(item.content) for item in body.history)
    if total_size > 12000:
        raise HTTPException(status_code=413, detail="Chat history is too large")
    for item in body.history:
        role = "assistant" if item.role == "assistant" else "user"
        messages.append({"role": role, "content": item.content[:3000]})
    messages.append({"role": "user", "content": body.message})

    payload = {
        "model": settings.HF_MODEL,
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": 700,
    }

    async def call_hf(json_payload):
        async with httpx.AsyncClient(timeout=60.0) as client:
            return await client.post(settings.HF_MODEL_URL, headers=headers, json=json_payload)

    try:
        response = await call_hf(payload)
        
        if response.status_code != 200:
            logger.warning("AI provider returned status %s", response.status_code)
            raise HTTPException(status_code=502, detail="AI provider request failed")

        data = response.json()
        message = data["choices"][0]["message"]
        
        reply = message.get("content", "").strip()

        if not reply:
            raise HTTPException(status_code=502, detail="AI returned an empty response")

        return {"reply": reply, "success": True}

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI service timed out")
    except HTTPException:
        raise
    except Exception:
        logger.exception("AI provider request failed")
        raise HTTPException(status_code=500, detail="Unable to generate AI response")
