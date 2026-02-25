"""
MongoDB data access for Scoring database.
Loads MONGO_URI from .env via python-dotenv; provides get_db() and load_* functions.
"""
from __future__ import annotations

import os
from typing import Any

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database

_DB: Database[dict[str, Any]] | None = None


def get_db() -> Database[dict[str, Any]]:
    """Return the Scoring database; create client from MONGO_URI on first use."""
    global _DB
    if _DB is None:
        load_dotenv()
        uri = os.environ.get("MONGO_URI")
        if not uri:
            raise ValueError("MONGO_URI is not set; add it to .env or the environment")
        # Use certifi CA bundle so SSL works on macOS (avoids CERTIFICATE_VERIFY_FAILED)
        client = MongoClient(uri, tlsCAFile=certifi.where())
        _DB = client["Scoring"]
    return _DB


def load_event_info() -> list[dict[str, Any]]:
    """Load all events from Scoring.EventInfo."""
    return list(get_db().EventInfo.find({}))


def load_entries() -> list[dict[str, Any]]:
    """Load all entries from Scoring.Entry."""
    return list(get_db().Entry.find({}))


def load_race_info() -> list[dict[str, Any]]:
    """Load all races from Scoring.RaceInfo (sorted by start_time then race_id for order)."""
    coll = get_db().RaceInfo
    return list(coll.find({}).sort([("start_time", 1), ("race_id", 1)]))


def load_finishes() -> list[dict[str, Any]]:
    """Load all finish records from Scoring.ScoreSample."""
    return list(get_db().ScoreSample.find({}))


def load_divisions() -> list[dict[str, Any]]:
    """Load all divisions from Scoring.Division."""
    return list(get_db().Division.find({}))
