from __future__ import annotations
from google import genai
from google.genai import types
from app.core.config import settings

def get_gemini_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError("Missing GEMINI_API_KEY")
    return genai.Client(api_key=settings.gemini_api_key)

def get_model_name() -> str:
    return settings.gemini_model

def make_config(system_instruction: str) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(system_instruction=system_instruction, temperature=settings.gemini_temperature)
