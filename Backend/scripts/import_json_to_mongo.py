"""
One-time script: load the four JSON files (EventInfo, Entry, RaceInfo, ScoreSample)
into MongoDB database Scoring, using collection names matching the file names.
Run from Backend: python scripts/import_json_to_mongo.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Ensure Backend is on path and load .env from Backend
_backend = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend))

from dotenv import load_dotenv

load_dotenv(_backend / ".env")

from DataAccess import get_db


def main() -> None:
    base = _backend
    db = get_db()

    files_collections = [
        ("EventInfo.json", "EventInfo"),
        ("Entry.json", "Entry"),
        ("RaceInfo.json", "RaceInfo"),
        ("ScoreSample.json", "ScoreSample"),
    ]

    for filename, collection_name in files_collections:
        path = base / filename
        if not path.exists():
            print(f"Skip {filename}: not found")
            continue
        with path.open(encoding="utf-8") as f:
            docs = json.load(f)
        if not docs:
            print(f"{collection_name}: no documents")
            continue
        coll = db[collection_name]
        result = coll.insert_many(docs)
        print(f"{collection_name}: inserted {len(result.inserted_ids)} documents")

    print("Done.")


if __name__ == "__main__":
    main()
