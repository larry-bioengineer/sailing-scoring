from datetime import date as date_type

from flask import Flask, request, jsonify, Response

from flask_cors import CORS

from DataAccess import (
    load_event_info,
    load_entries,
    load_race_info,
    load_finishes,
    load_divisions,
)
from ScoringEntry import (
    event_doc,
    entry_doc,
    division_doc,
    race_doc,
    finish_doc,
    insert_event,
    update_event,
    delete_event,
    insert_entry,
    delete_entry,
    update_entry,
    get_entry,
    entry_with_sail_number_exists,
    insert_division,
    update_division,
    delete_division,
    insert_race,
    update_race,
    delete_race,
    insert_finish,
    delete_finish,
    update_finish,
)
from Calculation import build_series_result, to_csv_string
from api_util import serialize_for_json

app = Flask(__name__)
CORS(app)


def _str_id(doc: dict) -> str:
    return str(doc.get("_id", ""))


# ---------- Events ----------


@app.route("/api/events", methods=["GET"])
def get_events():
    events = load_event_info()
    out = [{"id": _str_id(e), "name": e.get("name") or "", "discard": e.get("discard", [])} for e in events]
    out.sort(key=lambda x: x["id"], reverse=True)
    return jsonify(out)


@app.route("/api/events/<event_id>", methods=["GET"])
def get_event(event_id):
    if not event_id or not event_id.strip():
        return jsonify({"error": "event_id is required"}), 400
    event_id = event_id.strip()
    events = load_event_info()
    event = next((e for e in events if _str_id(e) == event_id), None)
    if event is None:
        return jsonify({"error": "Event not found"}), 404
    out = {"id": _str_id(event), "name": event.get("name") or "", "discard": event.get("discard", [])}
    return jsonify(serialize_for_json(out))


@app.route("/api/events", methods=["POST"])
def post_event():
    data = request.get_json() or {}
    discard = data.get("discard")
    if discard is None:
        return jsonify({"error": "discard is required"}), 400
    if isinstance(discard, str):
        try:
            discard = [int(x.strip()) for x in discard.split(",") if x.strip()]
        except ValueError:
            return jsonify({"error": "discard must be comma-separated integers"}), 400
    if not isinstance(discard, list) or not all(isinstance(x, int) for x in discard):
        return jsonify({"error": "discard must be a list of integers"}), 400
    name = (data.get("name") or "").strip()
    try:
        doc = event_doc(discard, name=name)
        result = insert_event(doc)
        out = {"id": result.inserted_id, "name": doc.get("name") or "", "discard": doc["discard"]}
        return jsonify(serialize_for_json(out)), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/events/<event_id>", methods=["PUT", "PATCH"])
def put_event(event_id):
    if not event_id or not event_id.strip():
        return jsonify({"error": "event_id is required"}), 400
    event_id = event_id.strip()
    data = request.get_json() or {}
    discard = data.get("discard")
    if discard is None:
        return jsonify({"error": "discard is required"}), 400
    if isinstance(discard, str):
        try:
            discard = [int(x.strip()) for x in discard.split(",") if x.strip()]
        except ValueError:
            return jsonify({"error": "discard must be comma-separated integers"}), 400
    if not isinstance(discard, list) or not all(isinstance(x, int) for x in discard):
        return jsonify({"error": "discard must be a list of integers"}), 400
    name = data.get("name")
    if name is not None:
        name = (name or "").strip()
    try:
        updated = update_event(event_id, discard, name=name)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    if updated is None:
        return jsonify({"error": "Event not found"}), 404
    out = {"id": _str_id(updated), "name": updated.get("name") or "", "discard": updated.get("discard", [])}
    return jsonify(serialize_for_json(out))


@app.route("/api/events/<event_id>", methods=["DELETE"])
def delete_event_route(event_id):
    if not event_id or not event_id.strip():
        return jsonify({"error": "event_id is required"}), 400
    event_id = event_id.strip()
    events = load_event_info()
    event = next((e for e in events if _str_id(e) == event_id), None)
    if event is None:
        return jsonify({"error": "Event not found"}), 404
    try:
        deleted = delete_event(event_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if not deleted:
        return jsonify({"error": "Event not found"}), 404
    return "", 204


# ---------- Entries ----------


@app.route("/api/entries", methods=["GET"])
def get_entries():
    event_id = request.args.get("event_id")
    entries = load_entries()
    if event_id is not None and event_id != "":
        entries = [e for e in entries if str(e.get("event_id", "")) == str(event_id)]
    out = serialize_for_json(entries)
    return jsonify(out)


@app.route("/api/entries", methods=["POST"])
def post_entry():
    data = request.get_json() or {}
    event_id = (data.get("event_id") or "").strip()
    sail_number = (data.get("sail_number") or "").strip()
    name = (data.get("name") or "").strip()
    division_ids = data.get("division_ids")
    if division_ids is not None and not isinstance(division_ids, list):
        division_ids = None
    if entry_with_sail_number_exists(event_id, sail_number):
        return jsonify({"error": "Duplicate sail number"}), 400
    try:
        doc = entry_doc(event_id, sail_number, name=name, division_ids=division_ids)
        result = insert_entry(doc)
        out = {**doc, "_id": str(result.inserted_id)}
        return jsonify(serialize_for_json(out)), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/entries/<entry_id>", methods=["DELETE"])
def delete_entry_route(entry_id):
    if not entry_id or not entry_id.strip():
        return jsonify({"error": "entry_id is required"}), 400
    deleted = delete_entry(entry_id.strip())
    if not deleted:
        return jsonify({"error": "Entry not found"}), 404
    return "", 204


@app.route("/api/entries/<entry_id>", methods=["PATCH"])
def patch_entry(entry_id):
    if not entry_id or not entry_id.strip():
        return jsonify({"error": "entry_id is required"}), 400
    entry_id = entry_id.strip()
    data = request.get_json() or {}
    if "sail_number" in data:
        sail_number = (data.get("sail_number") or "").strip()
        if sail_number:
            existing = get_entry(entry_id)
            if existing and entry_with_sail_number_exists(
                existing.get("event_id", ""), sail_number, exclude_entry_id=entry_id
            ):
                return jsonify({"error": "Duplicate sail number"}), 400
    updated = update_entry(entry_id, data)
    if updated is None:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify(serialize_for_json(updated))


# ---------- Divisions ----------


@app.route("/api/divisions", methods=["GET"])
def get_divisions():
    event_id = request.args.get("event_id")
    divisions = load_divisions()
    if event_id is not None and event_id != "":
        divisions = [d for d in divisions if str(d.get("event_id", "")) == str(event_id)]
    out = serialize_for_json(divisions)
    return jsonify(out)


@app.route("/api/divisions", methods=["POST"])
def post_division():
    data = request.get_json() or {}
    event_id = (data.get("event_id") or "").strip()
    name = (data.get("name") or "").strip()
    try:
        doc = division_doc(event_id, name)
        result = insert_division(doc)
        out = {**doc, "_id": str(result.inserted_id)}
        return jsonify(serialize_for_json(out)), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/divisions/<division_id>", methods=["PUT", "PATCH"])
def put_division(division_id):
    if not division_id or not division_id.strip():
        return jsonify({"error": "division_id is required"}), 400
    division_id = division_id.strip()
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    try:
        updated = update_division(division_id, name)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if updated is None:
        return jsonify({"error": "Division not found"}), 404
    out = {"_id": _str_id(updated), "event_id": updated.get("event_id"), "name": updated.get("name")}
    return jsonify(serialize_for_json(out))


@app.route("/api/divisions/<division_id>", methods=["DELETE"])
def delete_division_route(division_id):
    if not division_id or not division_id.strip():
        return jsonify({"error": "division_id is required"}), 400
    deleted = delete_division(division_id.strip())
    if not deleted:
        return jsonify({"error": "Division not found"}), 404
    return "", 204


# ---------- Races ----------


@app.route("/api/races", methods=["GET"])
def get_races():
    event_id = request.args.get("event_id")
    races = load_race_info()
    if event_id is not None and event_id != "":
        races = [r for r in races if str(r.get("event_id", "")) == str(event_id)]
    return jsonify(serialize_for_json(races))


@app.route("/api/races", methods=["POST"])
def post_race():
    data = request.get_json() or {}
    event_id = (data.get("event_id") or "").strip()
    race_id = (data.get("race_id") or "").strip()
    start_time = (data.get("start_time") or "").strip()
    division_id = (data.get("division_id") or "").strip()
    date = (data.get("date") or "").strip() or str(date_type.today())
    finish_window = data.get("finish_window_minutes")
    if finish_window is not None and not isinstance(finish_window, int):
        try:
            finish_window = int(finish_window)
        except (TypeError, ValueError):
            finish_window = None
    if not division_id:
        return jsonify({"error": "division_id is required and must be non-empty"}), 400
    if finish_window is None:
        return jsonify({"error": "finish_window_minutes is required (integer: minutes allowed to finish after first boat)"}), 400
    try:
        doc = race_doc(event_id, race_id, start_time, division_id, date=date, finish_window_minutes=finish_window)
        result = insert_race(doc)
        out = {**doc, "_id": str(result.inserted_id)}
        return jsonify(serialize_for_json(out)), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/races/<race_mongo_id>", methods=["PATCH"])
def patch_race(race_mongo_id):
    if not race_mongo_id or not race_mongo_id.strip():
        return jsonify({"error": "race_mongo_id is required"}), 400
    data = request.get_json() or {}
    notes = data.get("notes")
    if notes is not None and not isinstance(notes, str):
        notes = str(notes)
    race_id = data.get("race_id")
    if race_id is not None:
        race_id = race_id if isinstance(race_id, str) else str(race_id)
    start_time = data.get("start_time")
    if start_time is not None:
        start_time = start_time if isinstance(start_time, str) else str(start_time)
    date = data.get("date")
    if date is not None:
        date = date if isinstance(date, str) else str(date)
    division_id = data.get("division_id")
    if division_id is not None:
        division_id = str(division_id).strip() if division_id else ""
        if not division_id:
            return jsonify({"error": "division_id must be non-empty when provided"}), 400
    finish_window_minutes = data.get("finish_window_minutes")
    if finish_window_minutes is not None:
        try:
            finish_window_minutes = int(finish_window_minutes)
        except (TypeError, ValueError):
            return jsonify({"error": "finish_window_minutes must be an integer"}), 400
    try:
        updated = update_race(
            race_mongo_id.strip(),
            notes=notes,
            race_id=race_id,
            start_time=start_time,
            date=date,
            division_id=division_id,
            finish_window_minutes=finish_window_minutes,
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if updated is None:
        return jsonify({"error": "Race not found"}), 404
    out = {
        "_id": str(updated.get("_id", "")),
        "event_id": updated.get("event_id"),
        "race_id": updated.get("race_id"),
        "start_time": updated.get("start_time"),
        "notes": updated.get("notes", ""),
    }
    if updated.get("date") is not None:
        out["date"] = updated.get("date")
    if updated.get("division_id") is not None:
        out["division_id"] = updated.get("division_id")
    if updated.get("finish_window_minutes") is not None:
        out["finish_window_minutes"] = updated.get("finish_window_minutes")
    return jsonify(serialize_for_json(out))


@app.route("/api/races/<race_id>", methods=["DELETE"])
def delete_race_route(race_id):
    if not race_id or not race_id.strip():
        return jsonify({"error": "race_id is required"}), 400
    deleted = delete_race(race_id.strip())
    if not deleted:
        return jsonify({"error": "Race not found"}), 404
    return "", 204


# ---------- Finishes (ScoreSample) ----------


@app.route("/api/finishes", methods=["GET"])
def get_finishes():
    race_id = request.args.get("race_id")
    event_id = request.args.get("event_id")
    finishes = load_finishes()
    if event_id is not None and event_id != "":
        races = load_race_info()
        race_ids = {str(r.get("race_id", "")) for r in races if str(r.get("event_id", "")) == str(event_id)}
        finishes = [f for f in finishes if str(f.get("race_id", "")) in race_ids]
    if race_id is not None and race_id != "":
        finishes = [f for f in finishes if str(f.get("race_id", "")) == str(race_id)]
    return jsonify(serialize_for_json(finishes))


@app.route("/api/finishes", methods=["POST"])
def post_finish():
    data = request.get_json() or {}
    sail_number = (data.get("sail_number") or "").strip()
    race_id = (data.get("race_id") or "").strip()
    finish_time = (data.get("finish_time") or "").strip()
    rc_scoring = data.get("rc_scoring")
    if rc_scoring is not None:
        rc_scoring = (rc_scoring or "").strip() or None
    try:
        doc = finish_doc(sail_number, race_id, finish_time, rc_scoring=rc_scoring)
        result = insert_finish(doc)
        out = {**doc, "_id": str(result.inserted_id)}
        return jsonify(serialize_for_json(out)), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/finishes/<finish_id>", methods=["DELETE"])
def delete_finish_route(finish_id: str):
    if delete_finish(finish_id):
        return "", 204
    return jsonify({"error": "Finish not found"}), 404


@app.route("/api/finishes/<finish_id>", methods=["PUT"])
def put_finish_route(finish_id: str):
    data = request.get_json() or {}
    sail_number = data.get("sail_number")
    if sail_number is not None:
        sail_number = (sail_number or "").strip() or None
    race_id = data.get("race_id")
    if race_id is not None:
        race_id = (race_id or "").strip() or None
    finish_time = data.get("finish_time")
    if finish_time is not None:
        finish_time = (finish_time or "").strip() or None
    # Only pass rc_scoring when key is present so empty string can clear the field
    put_kw: dict = {"sail_number": sail_number, "race_id": race_id, "finish_time": finish_time}
    if "rc_scoring" in data:
        put_kw["rc_scoring"] = (data.get("rc_scoring") or "").strip() or None
    try:
        updated = update_finish(finish_id, **put_kw)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if updated is None:
        return jsonify({"error": "Finish not found"}), 404
    return jsonify(serialize_for_json(updated))


@app.route("/api/finishes/extract-from-image", methods=["POST"])
def extract_finish_from_image():
    data = request.get_json() or {}
    image = data.get("image")
    if image is None or (isinstance(image, str) and not image.strip()):
        return jsonify({"error": "image is required"}), 400
    image_str = image if isinstance(image, str) else str(image)
    try:
        from openrouter import extract_sail_numbers_from_image
        sail_numbers = extract_sail_numbers_from_image(image_str)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"sail_numbers": sail_numbers})


# ---------- Results ----------


def _event_result(event_id: str, division_id: str | None = None):
    events = load_event_info()
    event_info = next((e for e in events if str(e.get("_id", "")) == str(event_id)), None)
    if not event_info:
        return None, None, None
    entries = load_entries()
    entries = [e for e in entries if str(e.get("event_id", "")) == str(event_id)]
    if division_id is not None and division_id.strip() != "":
        div_id = str(division_id).strip()
        entry_division_ids = lambda e: e.get("division_ids") or []
        entries = [e for e in entries if div_id in entry_division_ids(e)]
    races_list = load_race_info()
    races = [r for r in races_list if str(r.get("event_id", "")) == str(event_id)]
    finishes = load_finishes()
    rows = build_series_result(event_id, entries, races, finishes, event_info)
    race_ids = [r["race_id"] for r in races]
    return rows, race_ids, event_info


@app.route("/api/results/<event_id>", methods=["GET"])
def get_result_json(event_id):
    division_id = request.args.get("division_id")
    rows, race_ids, _ = _event_result(event_id, division_id=division_id)
    if rows is None:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(serialize_for_json(rows))


@app.route("/api/results/<event_id>/csv", methods=["GET"])
def get_result_csv_route(event_id):
    division_id = request.args.get("division_id")
    rows, race_ids, _ = _event_result(event_id, division_id=division_id)
    if rows is None:
        return jsonify({"error": "Event not found"}), 404
    csv_str = to_csv_string(rows, race_ids)
    return Response(csv_str, mimetype="text/plain", headers={"Content-Disposition": "inline"})


@app.route("/")
def index():
    return "Hello, World!"


if __name__ == "__main__":
    app.run(debug=True)
