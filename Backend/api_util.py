"""
Utilities for Flask API: make MongoDB documents JSON-serializable (ObjectId -> str).
"""
from __future__ import annotations

from typing import Any

from bson import ObjectId


def serialize_for_json(obj: Any) -> Any:
    """Recursively convert ObjectId to string so jsonify works. In-place for dicts/lists."""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {k: serialize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize_for_json(v) for v in obj]
    return obj
