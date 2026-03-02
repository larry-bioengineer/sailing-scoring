"""
OpenRouter API client for image-to-finish extraction (vision).
"""
from __future__ import annotations

import json
import os
import re
import ssl
import urllib.error
import urllib.request

import certifi


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
VISION_MODEL = "google/gemini-3.1-pro-preview"

# System prompt: strict response format so the service can parse the payload
SYSTEM_PROMPT = """You must respond with a valid JSON array of strings only. No other text, no markdown, no code fences, no explanation.
Format: ["sail1", "sail2", "sail3"]
Each element is one sail number as a string. The response must be parseable by JSON.parse()."""

EXTRACT_PROMPT = """This image shows a sailing race finish list or similar list of sail/boat numbers in finish order (first across the line to last).

Extract every sail number (or boat number) from the image in the exact order they appear (top to bottom, or left to right, as displayed).

Respond with only a valid JSON array of strings: one string per boat, in finish order. Example: ["1", "2", "3", "42"]
Do not wrap in markdown or code blocks. Output nothing except the raw JSON array."""


def extract_sail_numbers_from_image(image_base64_or_data_url: str) -> list[str]:
    """
    Send the image to OpenRouter vision API and return sail numbers in finish order.
    :param image_base64_or_data_url: Either raw base64 string or data URL (data:image/jpeg;base64,...)
    :return: List of sail number strings in order
    :raises ValueError: If API key missing, image invalid, or response cannot be parsed
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key or not str(api_key).strip():
        raise ValueError("OPENROUTER_API_KEY is not set")

    image_str = (image_base64_or_data_url or "").strip()
    if not image_str:
        raise ValueError("image is required")

    # Accept data URL as-is; if raw base64, build data URL
    if not image_str.startswith("data:"):
        image_str = f"data:image/jpeg;base64,{image_str}"

    payload = {
        "model": VISION_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": EXTRACT_PROMPT},
                    {"type": "image_url", "image_url": {"url": image_str}},
                ],
            }
        ],
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OPENROUTER_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    # Use certifi's CA bundle so SSL verification works on macOS when Python
    # doesn't use the system certificate store (avoids CERTIFICATE_VERIFY_FAILED)
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    try:
        with urllib.request.urlopen(req, timeout=60, context=ssl_context) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        try:
            err_obj = json.loads(body)
            msg = err_obj.get("error", {}).get("message", body) if isinstance(err_obj.get("error"), dict) else err_obj.get("error", body)
        except Exception:
            msg = body or str(e)
        raise ValueError(f"OpenRouter API error: {msg}")
    except urllib.error.URLError as e:
        raise ValueError(f"OpenRouter request failed: {e.reason}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid OpenRouter response: {e}")

    choices = data.get("choices")
    if not choices or not isinstance(choices, list):
        raise ValueError("OpenRouter response missing choices")
    first = choices[0]
    if not isinstance(first, dict):
        raise ValueError("OpenRouter response invalid choices shape")
    message = first.get("message")
    if not isinstance(message, dict):
        raise ValueError("OpenRouter response missing message")
    content = message.get("content")
    if content is None:
        content = ""
    text = content if isinstance(content, str) else str(content)

    # Strip markdown code fence if present
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if match:
        text = match.group(1).strip()
    if not text:
        raise ValueError("OpenRouter returned no sail number list")

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Could not parse sail numbers from response: {e}")

    if not isinstance(parsed, list):
        raise ValueError("Response is not a JSON array")
    result = []
    for i, item in enumerate(parsed):
        if item is None:
            continue
        s = str(item).strip()
        if s:
            result.append(s)
    return result
