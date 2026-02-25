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
    insert_division,
    update_division,
    delete_division,
    insert_race,
    delete_race,
    insert_finish,
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
    out = [{"id": _str_id(e), "discard": e.get("discard", [])} for e in events]
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
    out = {"id": _str_id(event), "discard": event.get("discard", [])}
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
    try:
        doc = event_doc(discard)
        result = insert_event(doc)
        return jsonify(serialize_for_json({"id": result.inserted_id, "discard": doc["discard"]})), 201
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
    try:
        updated = update_event(event_id, discard)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    if updated is None:
        return jsonify({"error": "Event not found"}), 404
    out = {"id": _str_id(updated), "discard": updated.get("discard", [])}
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
    try:
        doc = race_doc(event_id, race_id, start_time)
        result = insert_race(doc)
        out = {**doc, "_id": str(result.inserted_id)}
        return jsonify(serialize_for_json(out)), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


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
