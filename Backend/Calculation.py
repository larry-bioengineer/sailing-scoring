"""
Sailing race series result calculation: positions from finishes, discard rule,
TOTAL/NET, RRS A8 tie-breaking, and CSV output.
Data is loaded from MongoDB (Scoring database) via DataAccess.
"""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from DataAccess import load_entries, load_event_info, load_finishes, load_race_info


def positions_from_finishes(
    finishes: list[dict[str, Any]],
    race_order: list[str],
) -> tuple[dict[str, dict[str, float]], list[tuple[str, str, str]]]:
    """
    Build per-boat, per-race position (1-based) from finish data.
    For each race, sort by finish_time and assign 1, 2, 3, ... to finishes that
    do NOT have rc_scoring. Finishes with rc_scoring are not counted for position
    (they get a penalty score elsewhere) and are returned in rc_scoring_finishes.
    Returns (positions, rc_scoring_finishes) where rc_scoring_finishes is
    list of (sail_number, race_id, rc_scoring_code).
    """
    # Group finishes by race_id
    by_race: dict[str, list[dict]] = {rid: [] for rid in race_order}
    for f in finishes:
        rid = f.get("race_id")
        if rid in by_race:
            by_race[rid].append(f)

    rc_scoring_finishes: list[tuple[str, str, str]] = []

    # Assign positions per race (earliest finish = 1); exclude rc_scoring from ranking
    positions: dict[str, dict[str, float]] = {}
    for rid in race_order:
        with_rc = [(f, f.get("rc_scoring")) for f in by_race[rid]]
        # Finishes with rc_scoring: record for penalty score, do not assign position
        for f, rc in with_rc:
            if rc:
                sn = f.get("sail_number")
                if sn is not None:
                    rc_scoring_finishes.append((str(sn), str(rid), str(rc).strip()))
        # Only assign 1, 2, 3, ... to finishes without rc_scoring
        normal_finishes = sorted(
            [f for f, rc in with_rc if not rc],
            key=lambda x: x.get("finish_time", ""),
        )
        for pos, fin in enumerate(normal_finishes, start=1):
            sn = fin.get("sail_number")
            if sn is None:
                continue
            if sn not in positions:
                positions[sn] = {}
            positions[sn][rid] = float(pos)

    return (positions, rc_scoring_finishes)


def num_discards(n_races: int, discard_thresholds: list[int]) -> int:
    """
    Number of discards allowed: count of elements in discard_thresholds
    such that n_races >= element. E.g. [3, 6, 9] and 4 races -> 1 discard.
    """
    if not discard_thresholds:
        return 0
    return sum(1 for t in discard_thresholds if n_races >= t)


def total_and_net(
    race_scores: list[float | None],
    num_discards: int,
) -> tuple[float, float, list[bool]]:
    """
    TOTAL = sum of all (non-None) race scores.
    Discard the worst num_discards scores; if tied, discard by later race order.
    NET = TOTAL - sum of discarded scores.
    Returns (total, net, is_discarded) where is_discarded[i] is True if race i is discarded.
    """
    # Pairs (score, index) for non-None scores only; index for tie-break (later = discard first)
    scored: list[tuple[float, int]] = [
        (s, i) for i, s in enumerate(race_scores) if s is not None
    ]
    total = sum(s for s, _ in scored)
    n = len(scored)
    is_discarded = [False] * len(race_scores)

    if num_discards <= 0 or n == 0:
        return (total, total, is_discarded)

    # Sort by worst first: higher score first, then higher index (later race)
    to_discard = min(num_discards, n)
    sorted_by_worst = sorted(scored, key=lambda x: (-x[0], -x[1]))
    discard_indices = {sorted_by_worst[i][1] for i in range(to_discard)}
    for i in discard_indices:
        is_discarded[i] = True

    discarded_sum = sum(
        race_scores[i] for i in range(len(race_scores)) if is_discarded[i] and race_scores[i] is not None
    )
    net = total - discarded_sum
    return (total, net, is_discarded)


def _a8_compare_key(
    race_scores: list[float | None],
    is_discarded: list[bool],
) -> tuple[tuple[float, ...], tuple[float, ...]]:
    """
    A8.1: scores best to worst excluding discarded (tuple for comparison).
    A8.2: scores in order last race, next-to-last, ... (all scores, including discarded).
    Missing (None) counts as worst for tie-break. Returns (a8_1_key, a8_2_key) for sort key.
    """
    # A8.1: non-discarded scores, sorted best (lowest) to worst
    non_discarded = [
        race_scores[i] for i in range(len(race_scores))
        if race_scores[i] is not None and not is_discarded[i]
    ]
    a8_1 = tuple(sorted(non_discarded))

    # A8.2: last race, next-to-last, ...; use inf for missing so missing is worse
    a8_2 = tuple(
        s if s is not None else float("inf")
        for s in reversed(race_scores)
    )

    return (a8_1, a8_2)


def build_series_result(
    event_id: str,
    entries: list[dict[str, Any]],
    races: list[dict[str, Any]],
    finishes: list[dict[str, Any]],
    event_info: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Build ranked result rows for the event. Each row has: sail_number, rank, rank_display,
    scores (list of (score, is_discarded) in race order), total, net.
    The result always includes every entry from the Entry collection for this event.
    Boats not marked in ScoreSample for a race are scored as DNC (Did Not Compete),
    using the same penalty as rc_scoring (n_boats + 1).
    """
    race_order = [r["race_id"] for r in races]
    score_matrix, rc_scoring_finishes = positions_from_finishes(finishes, race_order)
    discard_thresholds = event_info.get("discard") or []
    n_races = len(race_order)
    n_discards = num_discards(n_races, discard_thresholds)

    # Filter entries for this event (number of boats in series). Normalize to str so DB 1 matches "1".
    entries_for_event = [e for e in entries if str(e.get("event_id")) == str(event_id)]
    sail_numbers = [e["sail_number"] for e in entries_for_event]
    name_by_sail = {e["sail_number"]: (e.get("name") or "") for e in entries_for_event}
    if not sail_numbers:
        return []

    n_boats = len(sail_numbers)
    rc_penalty = n_boats + 1  # Score for rc_scoring: one more than boats in series
    rc_display_map: dict[tuple[str, str], str] = {
        (sn, rid): code for sn, rid, code in rc_scoring_finishes
    }

    # Per boat: race_scores in race order. Missing from ScoreSample = DNC (same penalty as rc_scoring).
    rows_data: list[tuple[str, list[float | None], list[str | None], float, float, list[bool]]] = []
    for sn in sail_numbers:
        boat_scores = score_matrix.get(sn, {})
        race_scores: list[float | None] = []
        rc_displays: list[str | None] = []
        for rid in race_order:
            if (str(sn), str(rid)) in rc_display_map:
                race_scores.append(float(rc_penalty))
                rc_displays.append(rc_display_map[(str(sn), str(rid))])
            elif rid in boat_scores:
                race_scores.append(boat_scores[rid])
                rc_displays.append(None)
            else:
                # Not in ScoreSample for this race = DNC (Did Not Compete), same principle as rc_scoring
                race_scores.append(float(rc_penalty))
                rc_displays.append("DNC")
        total, net, is_discarded = total_and_net(race_scores, n_discards)
        rows_data.append((sn, race_scores, rc_displays, total, net, is_discarded))

    # Sort by NET (lower better), then A8
    def sort_key(item: tuple[str, list[float | None], list[str | None], float, float, list[bool]]) -> tuple[float, tuple[tuple[float, ...], tuple[float | None, ...]]]:
        sn, race_scores, _rc_displays, _total, net, is_discarded = item
        a8_1, a8_2 = _a8_compare_key(race_scores, is_discarded)
        return (net, (a8_1, a8_2))

    rows_data.sort(key=sort_key)

    # Assign ranks (1st, 2nd, 3rd, ...); scores are (score, is_discarded, rc_display)
    result_rows: list[dict[str, Any]] = []
    for rank_one_based, (sn, race_scores, rc_displays, total, net, is_discarded) in enumerate(rows_data, start=1):
        rank_display = _rank_display(rank_one_based)
        scores_with_discard = [
            (s if s is not None else None, is_discarded[i], rc_displays[i] if i < len(rc_displays) else None)
            for i, s in enumerate(race_scores)
        ]
        result_rows.append({
            "sail_number": sn,
            "name": name_by_sail.get(sn, ""),
            "rank": rank_one_based,
            "rank_display": rank_display,
            "scores": scores_with_discard,
            "total": total,
            "net": net,
        })

    return result_rows


def _rank_display(rank: int) -> str:
    if rank == 1:
        return "1st"
    if rank == 2:
        return "2nd"
    if rank == 3:
        return "3rd"
    return f"{rank}th"


def write_result_csv(
    rows: list[dict[str, Any]],
    race_ids: list[str],
    path: str | Path,
) -> None:
    """
    Write result rows to CSV. Header: RANK, Sail Number, Name, R1, R2, ..., TOTAL, NET.
    Discarded scores are shown in parentheses e.g. (3.0).
    """
    path = Path(path)
    header = ["RANK", "Sail Number", "Name"] + [f"R{r}" for r in race_ids] + ["TOTAL", "NET"]

    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for row in rows:
            rank_display = row["rank_display"]
            sail_number = row["sail_number"]
            name = row.get("name", "")
            score_cells = []
            for score, is_discarded, rc_display in row["scores"]:
                if score is None:
                    score_cells.append("")
                else:
                    cell = f"{score:.1f}" + (f" {rc_display}" if rc_display else "")
                    if is_discarded:
                        cell = f"({cell})" if not rc_display else f"({score:.1f} {rc_display})"
                    score_cells.append(cell)
            total = row["total"]
            net = row["net"]
            writer.writerow([rank_display, sail_number, name] + score_cells + [f"{total:.1f}", f"{net:.1f}"])


def to_csv_string(rows: list[dict[str, Any]], race_ids: list[str]) -> str:
    """Return CSV content as a string (for testing)."""
    import io
    buf = io.StringIO()
    header = ["RANK", "Sail Number", "Name"] + [f"R{r}" for r in race_ids] + ["TOTAL", "NET"]
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        rank_display = row["rank_display"]
        sail_number = row["sail_number"]
        name = row.get("name", "")
        score_cells = []
        for score, is_discarded, rc_display in row["scores"]:
            if score is None:
                score_cells.append("")
            else:
                cell = f"{score:.1f}" + (f" {rc_display}" if rc_display else "")
                if is_discarded:
                    cell = f"({cell})" if not rc_display else f"({score:.1f} {rc_display})"
                score_cells.append(cell)
        total = row["total"]
        net = row["net"]
        writer.writerow([rank_display, sail_number, name] + score_cells + [f"{total:.1f}", f"{net:.1f}"])
    return buf.getvalue()


# ---------- Result CSV generation (uses DataAccess for MongoDB) ----------


def generate_result_csv_for_event(
    event_id: str,
    *,
    output_csv_path: str | Path,
) -> list[dict[str, Any]]:
    """
    Load event, entries, races, and finishes from MongoDB (Scoring database),
    compute series result, write CSV, return rows.
    """
    events = load_event_info()
    event_info = next((e for e in events if str(e.get("_id")) == str(event_id)), None)
    if not event_info:
        raise ValueError(f"Event {event_id} not found in event info")

    entries = load_entries()
    races_list = load_race_info()
    races = [r for r in races_list if str(r.get("event_id")) == str(event_id)]
    finishes = load_finishes()

    rows = build_series_result(event_id, entries, races, finishes, event_info)
    race_ids = [r["race_id"] for r in races]
    write_result_csv(rows, race_ids, output_csv_path)
    return rows
