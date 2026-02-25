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


def event_doc(discard: list[int], name: str = "") -> dict[str, Any]:
    """Build an EventInfo document: {"discard": discard, "name": name}. _id is omitted so MongoDB auto-generates it."""
    if not isinstance(discard, list) or not all(isinstance(x, int) for x in discard):
        raise ValueError("discard must be a list of integers")
    doc: dict[str, Any] = {"discard": list(discard)}
    if name is not None and str(name).strip():
        doc["name"] = str(name).strip()
    return doc


def entry_doc(
    event_id: str,
    sail_number: str,
    name: str = "",
    division_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Build an Entry document: {"event_id", "sail_number", "name", "division_ids"?}."""
    if not event_id or not event_id.strip():
        raise ValueError("event_id must be non-empty")
    if not sail_number or not str(sail_number).strip():
        raise ValueError("sail_number must be non-empty")
    doc: dict[str, Any] = {
        "event_id": event_id.strip(),
        "sail_number": str(sail_number).strip(),
        "name": (name or "").strip(),
    }
    if division_ids is not None:
        doc["division_ids"] = [str(d).strip() for d in division_ids if str(d).strip()]
    return doc


def division_doc(event_id: str, name: str) -> dict[str, Any]:
    """Build a Division document: {"event_id", "name"}."""
    if not event_id or not event_id.strip():
        raise ValueError("event_id must be non-empty")
    if not name or not str(name).strip():
        raise ValueError("name must be non-empty")
    return {
        "event_id": event_id.strip(),
        "name": str(name).strip(),
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


def update_event(
    event_id: str, discard: list[int], name: str | None = None
) -> dict[str, Any] | None:
    """Update an event's discard list and optionally name in Scoring.EventInfo. Returns updated document or None if not found."""
    if not isinstance(discard, list) or not all(isinstance(x, int) for x in discard):
        raise ValueError("discard must be a list of integers")
    coll = get_db().EventInfo
    try:
        q = {"_id": ObjectId(event_id)}
    except Exception:
        q = {"_id": event_id}
    update_fields: dict[str, Any] = {"discard": list(discard)}
    if name is not None:
        update_fields["name"] = (name or "").strip()
    update = {"$set": update_fields}
    result = coll.find_one_and_update(q, update, return_document=ReturnDocument.AFTER)
    if result is None:
        # Retry with the other _id type (string vs ObjectId)
        try:
            q = {"_id": event_id}
            result = coll.find_one_and_update(q, update, return_document=ReturnDocument.AFTER)
        except Exception:
            pass
    return result


def delete_event(event_id: str) -> bool:
    """Delete an event and all related data (entries, divisions, races, finishes). Returns True if the event was deleted."""
    if not event_id or not str(event_id).strip():
        raise ValueError("event_id must be non-empty")
    event_id_str = str(event_id).strip()
    db = get_db()
    # Resolve event _id for EventInfo (may be ObjectId or string)
    try:
        event_oid = ObjectId(event_id_str)
        event_query = {"_id": event_oid}
    except Exception:
        event_oid = None
        event_query = {"_id": event_id_str}
    event_doc = db.EventInfo.find_one(event_query)
    if not event_doc:
        return False
    # Delete all entries for this event
    db.Entry.delete_many({"event_id": event_id_str})
    # Delete all divisions for this event
    db.Division.delete_many({"event_id": event_id_str})
    # Delete all finishes for races of this event, then delete the races
    races = list(db.RaceInfo.find({"event_id": event_id_str}))
    for race in races:
        race_id_str = str(race.get("race_id", ""))
        if race_id_str:
            db.ScoreSample.delete_many({"race_id": race_id_str})
    db.RaceInfo.delete_many({"event_id": event_id_str})
    # Delete the event
    result = db.EventInfo.delete_one(event_query)
    return result.deleted_count > 0


def _normalize_sail(s: str) -> str:
    """Normalize sail number for duplicate comparison: strip, remove all whitespace, lower."""
    t = (s or "").strip().lower()
    return "".join(t.split())


def entry_with_sail_number_exists(
    event_id: str, sail_number: str, exclude_entry_id: str | None = None
) -> bool:
    """Return True if an entry for this event already has this sail number (normalized). Optionally exclude an entry by _id (for updates)."""
    if not sail_number or not str(sail_number).strip():
        return False
    coll = get_db().Entry
    norm = _normalize_sail(sail_number)
    event_id_str = str(event_id).strip()
    for doc in coll.find({"event_id": event_id_str}):
        if exclude_entry_id and str(doc.get("_id")) == str(exclude_entry_id):
            continue
        if _normalize_sail(doc.get("sail_number")) == norm:
            return True
    return False


def get_entry(entry_id: str) -> dict[str, Any] | None:
    """Get one entry by _id. Returns the document or None if not found."""
    coll = get_db().Entry
    try:
        return coll.find_one({"_id": ObjectId(entry_id)})
    except Exception:
        return coll.find_one({"_id": entry_id})


def insert_entry(doc: dict[str, Any]) -> Any:
    """Insert one entry into Scoring.Entry. Returns inserted _id."""
    return get_db().Entry.insert_one(doc)


def update_entry(entry_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    """Update an entry by _id. data may contain "sail_number", "name", "division_ids". Returns updated document or None if not found."""
    coll = get_db().Entry
    try:
        q = {"_id": ObjectId(entry_id)}
    except Exception:
        q = {"_id": entry_id}
    updates: dict[str, Any] = {}
    if "sail_number" in data:
        sn = (data.get("sail_number") or "").strip()
        if sn:
            updates["sail_number"] = sn
    if "name" in data:
        updates["name"] = (data.get("name") or "").strip()
    if "division_ids" in data:
        ids = data["division_ids"]
        if isinstance(ids, list):
            updates["division_ids"] = [str(d).strip() for d in ids if str(d).strip()]
        else:
            updates["division_ids"] = []
    if not updates:
        result = coll.find_one(q)
        return result
    result = coll.find_one_and_update(q, {"$set": updates}, return_document=ReturnDocument.AFTER)
    if result is None and "_id" in q and not isinstance(q["_id"], ObjectId):
        result = coll.find_one_and_update(
            {"_id": ObjectId(entry_id)}, {"$set": updates}, return_document=ReturnDocument.AFTER
        )
    return result


def delete_entry(entry_id: str) -> bool:
    """Delete one entry from Scoring.Entry by _id. Returns True if a document was deleted."""
    try:
        result = get_db().Entry.delete_one({"_id": ObjectId(entry_id)})
        return result.deleted_count > 0
    except Exception:
        return False


def insert_division(doc: dict[str, Any]) -> Any:
    """Insert one division into Scoring.Division. Returns inserted _id."""
    return get_db().Division.insert_one(doc)


def update_division(division_id: str, name: str) -> dict[str, Any] | None:
    """Update a division's name in Scoring.Division. Returns updated document or None if not found."""
    if not name or not str(name).strip():
        raise ValueError("name must be non-empty")
    coll = get_db().Division
    try:
        q = {"_id": ObjectId(division_id)}
    except Exception:
        q = {"_id": division_id}
    update = {"$set": {"name": str(name).strip()}}
    result = coll.find_one_and_update(q, update, return_document=ReturnDocument.AFTER)
    if result is None:
        try:
            q = {"_id": division_id}
            result = coll.find_one_and_update(q, update, return_document=ReturnDocument.AFTER)
        except Exception:
            pass
    return result


def delete_division(division_id: str) -> bool:
    """Delete one division from Scoring.Division. Removes this division_id from all entries' division_ids. Returns True if a document was deleted."""
    db = get_db()
    try:
        oid = ObjectId(division_id)
        div_id_str = str(oid)
    except Exception:
        div_id_str = str(division_id)
    # Remove this division from any entry's division_ids
    db.Entry.update_many(
        {"division_ids": div_id_str},
        {"$pull": {"division_ids": div_id_str}},
    )
    try:
        result = db.Division.delete_one({"_id": ObjectId(division_id)})
        return result.deleted_count > 0
    except Exception:
        return False


def insert_race(doc: dict[str, Any]) -> Any:
    """Insert one race into Scoring.RaceInfo. Returns inserted _id."""
    return get_db().RaceInfo.insert_one(doc)


def update_race(race_mongo_id: str, notes: str | None) -> dict[str, Any] | None:
    """Update a race's notes in Scoring.RaceInfo by _id. Returns updated document or None if not found."""
    coll = get_db().RaceInfo
    try:
        oid = ObjectId(race_mongo_id)
    except Exception:
        return None
    value = (notes if notes is not None else "").strip() if notes is not None else ""
    result = coll.find_one_and_update(
        {"_id": oid},
        {"$set": {"notes": value}},
        return_document=ReturnDocument.AFTER,
    )
    return result


def delete_race(race_mongo_id: str) -> bool:
    """Delete one race from Scoring.RaceInfo by _id, and all finishes for that race. Returns True if the race was deleted."""
    db = get_db()
    try:
        oid = ObjectId(race_mongo_id)
    except Exception:
        return False
    race = db.RaceInfo.find_one({"_id": oid})
    if not race:
        return False
    race_id_str = str(race.get("race_id", ""))
    db.ScoreSample.delete_many({"race_id": race_id_str})
    result = db.RaceInfo.delete_one({"_id": oid})
    return result.deleted_count > 0


def insert_finish(doc: dict[str, Any]) -> Any:
    """Insert one finish into Scoring.ScoreSample. Returns inserted _id."""
    return get_db().ScoreSample.insert_one(doc)


def delete_finish(finish_mongo_id: str) -> bool:
    """Delete one finish from Scoring.ScoreSample by _id. Returns True if a document was deleted."""
    try:
        oid = ObjectId(finish_mongo_id)
    except Exception:
        return False
    result = get_db().ScoreSample.delete_one({"_id": oid})
    return result.deleted_count > 0


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
