"""
Data type for a single boat's series result row (sail number, rank, scores, total, net).
Also provides document builders and MongoDB insert helpers for EventInfo, Entry, RaceInfo, ScoreSample.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from DataAccess import get_db


# ---------- Document builders (for data entry) ----------


def event_doc(discard: list[int]) -> dict[str, Any]:
    """Build an EventInfo document: {"discard": discard}. _id is omitted so MongoDB auto-generates it."""
    if not isinstance(discard, list) or not all(isinstance(x, int) for x in discard):
        raise ValueError("discard must be a list of integers")
    return {"discard": list(discard)}


def entry_doc(event_id: str, sail_number: str, name: str = "") -> dict[str, Any]:
    """Build an Entry document: {"event_id", "sail_number", "name"}."""
    if not event_id or not event_id.strip():
        raise ValueError("event_id must be non-empty")
    if not sail_number or not str(sail_number).strip():
        raise ValueError("sail_number must be non-empty")
    return {
        "event_id": event_id.strip(),
        "sail_number": str(sail_number).strip(),
        "name": (name or "").strip(),
    }


def race_doc(event_id: str, race_id: str, start_time: str) -> dict[str, Any]:
    """Build a RaceInfo document: {"event_id", "race_id", "start_time"}."""
    if not event_id or not event_id.strip():
        raise ValueError("event_id must be non-empty")
    if not race_id or not str(race_id).strip():
        raise ValueError("race_id must be non-empty")
    if not start_time or not str(start_time).strip():
        raise ValueError("start_time must be non-empty")
    return {
        "event_id": event_id.strip(),
        "race_id": str(race_id).strip(),
        "start_time": str(start_time).strip(),
    }


def finish_doc(
    sail_number: str,
    race_id: str,
    finish_time: str,
    rc_scoring: str | None = None,
) -> dict[str, Any]:
    """Build a ScoreSample (finish) document: {"sail_number", "race_id", "finish_time", "rc_scoring"?}."""
    if not sail_number or not str(sail_number).strip():
        raise ValueError("sail_number must be non-empty")
    if not race_id or not str(race_id).strip():
        raise ValueError("race_id must be non-empty")
    if not finish_time or not str(finish_time).strip():
        raise ValueError("finish_time must be non-empty")
    doc: dict[str, Any] = {
        "sail_number": str(sail_number).strip(),
        "race_id": str(race_id).strip(),
        "finish_time": str(finish_time).strip(),
    }
    if rc_scoring is not None and str(rc_scoring).strip():
        doc["rc_scoring"] = str(rc_scoring).strip()
    return doc


# ---------- Insert methods (MongoDB) ----------


def insert_event(doc: dict[str, Any]) -> Any:
    """Insert one event into Scoring.EventInfo. Returns inserted _id."""
    return get_db().EventInfo.insert_one(doc)


def update_event(event_id: str, discard: list[int]) -> dict[str, Any] | None:
    """Update an event's discard list in Scoring.EventInfo. Returns updated document or None if not found."""
    if not isinstance(discard, list) or not all(isinstance(x, int) for x in discard):
        raise ValueError("discard must be a list of integers")
    coll = get_db().EventInfo
    try:
        q = {"_id": ObjectId(event_id)}
    except Exception:
        q = {"_id": event_id}
    update = {"$set": {"discard": list(discard)}}
    result = coll.find_one_and_update(q, update, return_document=ReturnDocument.AFTER)
    if result is None:
        # Retry with the other _id type (string vs ObjectId)
        try:
            q = {"_id": event_id}
            result = coll.find_one_and_update(q, update, return_document=ReturnDocument.AFTER)
        except Exception:
            pass
    return result


def insert_entry(doc: dict[str, Any]) -> Any:
    """Insert one entry into Scoring.Entry. Returns inserted _id."""
    return get_db().Entry.insert_one(doc)


def delete_entry(entry_id: str) -> bool:
    """Delete one entry from Scoring.Entry by _id. Returns True if a document was deleted."""
    try:
        result = get_db().Entry.delete_one({"_id": ObjectId(entry_id)})
        return result.deleted_count > 0
    except Exception:
        return False


def insert_race(doc: dict[str, Any]) -> Any:
    """Insert one race into Scoring.RaceInfo. Returns inserted _id."""
    return get_db().RaceInfo.insert_one(doc)


def insert_finish(doc: dict[str, Any]) -> Any:
    """Insert one finish into Scoring.ScoreSample. Returns inserted _id."""
    return get_db().ScoreSample.insert_one(doc)


def insert_events(docs: list[dict[str, Any]]) -> Any:
    """Bulk insert events into Scoring.EventInfo. Returns insert result."""
    if not docs:
        return None
    return get_db().EventInfo.insert_many(docs)


def insert_entries(docs: list[dict[str, Any]]) -> Any:
    """Bulk insert entries into Scoring.Entry. Returns insert result."""
    if not docs:
        return None
    return get_db().Entry.insert_many(docs)


def insert_races(docs: list[dict[str, Any]]) -> Any:
    """Bulk insert races into Scoring.RaceInfo. Returns insert result."""
    if not docs:
        return None
    return get_db().RaceInfo.insert_many(docs)


def insert_finishes(docs: list[dict[str, Any]]) -> Any:
    """Bulk insert finishes into Scoring.ScoreSample. Returns insert result."""
    if not docs:
        return None
    return get_db().ScoreSample.insert_many(docs)


# ---------- Result row dataclass ----------


@dataclass
class ScoringEntry:
    """One result row: sail number, rank, scores with discard flags, total, net."""

    sail_number: str
    rank: int
    rank_display: str
    scores: list[tuple[float | None, bool]]  # (score, is_discarded) per race
    total: float
    net: float

    @classmethod
    def from_result_row(cls, row: dict[str, Any]) -> "ScoringEntry":
        """Build from build_series_result row dict."""
        return cls(
            sail_number=row["sail_number"],
            rank=row["rank"],
            rank_display=row["rank_display"],
            scores=row["scores"],
            total=row["total"],
            net=row["net"],
        )
