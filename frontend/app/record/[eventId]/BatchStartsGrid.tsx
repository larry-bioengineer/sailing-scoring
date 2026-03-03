"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createRace, type Race, type Division } from "@/lib/api";

const BATCH_COLS = [
  { key: "race_id" as const, label: "Race No", type: "text" },
  { key: "start_time" as const, label: "Start time", type: "time" },
  { key: "date" as const, label: "Date", type: "date" },
  { key: "course" as const, label: "Course", type: "text" },
  { key: "finish_window_minutes" as const, label: "Finish (min)", type: "number" },
];

export type BatchRow = {
  race_id: string;
  start_time: string;
  date: string;
  course: string;
  finish_window_minutes: number;
};

function defaultRow(
  suggestedRaceId: string,
  defaultDate: string,
  defaultTime: string
): BatchRow {
  return {
    race_id: suggestedRaceId,
    start_time: defaultTime,
    date: defaultDate,
    course: "",
    finish_window_minutes: 30,
  };
}

function nextRaceId(races: Race[]): string {
  if (races.length === 0) return "1";
  let max = 0;
  for (const r of races) {
    const n = parseInt(r.race_id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

function nextRaceIdForDivision(races: Race[], divisionId: string): string {
  const forDivision = races.filter(
    (r) => (r.division_id ?? "").trim() === divisionId.trim()
  );
  return nextRaceId(forDivision);
}

export type BatchStartsGridProps = {
  eventId: string;
  divisions: Division[];
  existingRaces: Race[];
  onAdded: () => void;
  onCancel: () => void;
};

export function BatchStartsGrid({
  eventId,
  divisions,
  existingRaces,
  onAdded,
  onCancel,
}: BatchStartsGridProps) {
  const defaultDate = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );
  const defaultTime = "12:00:00";

  const [batchDivisionId, setBatchDivisionId] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedRaceId = useMemo(
    () =>
      batchDivisionId.trim()
        ? nextRaceIdForDivision(existingRaces, batchDivisionId)
        : "1",
    [existingRaces, batchDivisionId]
  );

  /** Next race id for a new row (max of existing for division + current rows) + 1 */
  const nextRaceIdForNewRow = useMemo(() => {
    const forDivision = existingRaces.filter(
      (r) => (r.division_id ?? "").trim() === batchDivisionId.trim()
    );
    const fromExisting = forDivision.map((r) => parseInt(r.race_id, 10));
    const fromRows = rows.map((r) => parseInt(r.race_id, 10));
    const all = [...fromExisting, ...fromRows].filter((n) => !Number.isNaN(n));
    const max = all.length ? Math.max(...all) : 0;
    return String(max + 1);
  }, [existingRaces, batchDivisionId, rows]);

  const prevDivisionIdRef = useRef("");
  // Create first row when user selects a division; clear when cleared; renumber race no when division changes
  useEffect(() => {
    if (!batchDivisionId.trim()) {
      prevDivisionIdRef.current = "";
      setRows([]);
      return;
    }
    const divisionChanged = prevDivisionIdRef.current !== batchDivisionId;
    prevDivisionIdRef.current = batchDivisionId;

    setRows((prev) => {
      if (prev.length === 0) {
        return [
          defaultRow(suggestedRaceId, defaultDate, defaultTime),
        ];
      }
      if (divisionChanged) {
        const base = parseInt(suggestedRaceId, 10) || 1;
        return prev.map((row, i) => ({
          ...row,
          race_id: String(base + i),
        }));
      }
      return prev;
    });
  }, [batchDivisionId, suggestedRaceId, defaultDate, defaultTime]);

  const [dragFill, setDragFill] = useState<{
    row: number;
    col: (typeof BATCH_COLS)[number]["key"];
    value: string | number;
  } | null>(null);
  const dragFillRef = useRef(dragFill);
  dragFillRef.current = dragFill;

  useEffect(() => {
    const up = () => setDragFill(null);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const updateCell = useCallback(
    (rowIndex: number, col: (typeof BATCH_COLS)[number]["key"], value: string | number) => {
      setRows((prev) => {
        const next = prev.map((r, i) =>
          i === rowIndex ? { ...r, [col]: value } : r
        );
        return next;
      });
    },
    []
  );

  const fillColumn = useCallback(
    (fromRow: number, toRow: number, col: (typeof BATCH_COLS)[number]["key"], value: string | number) => {
      const lo = Math.min(fromRow, toRow);
      const hi = Math.max(fromRow, toRow);
      setRows((prev) =>
        prev.map((r, i) =>
          i >= lo && i <= hi ? { ...r, [col]: value } : r
        )
      );
    },
    []
  );

  const handleCellMouseDown = useCallback(
    (rowIndex: number, col: (typeof BATCH_COLS)[number]["key"]) => {
      const row = rows[rowIndex];
      if (!row) return;
      const value = row[col];
      setDragFill({ row: rowIndex, col, value });
    },
    [rows]
  );

  const handleCellMouseEnter = useCallback(
    (rowIndex: number, col: (typeof BATCH_COLS)[number]["key"]) => {
      const state = dragFillRef.current;
      if (!state || state.col !== col) return;
      const value = state.value;
      fillColumn(state.row, rowIndex, col, value);
    },
    [fillColumn]
  );

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      defaultRow(nextRaceIdForNewRow, defaultDate, defaultTime),
    ]);
  }, [nextRaceIdForNewRow, defaultDate, defaultTime]);

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const validRows = useMemo(() => {
    return rows.filter(
      (r) =>
        batchDivisionId.trim() !== "" &&
        r.race_id.trim() !== "" &&
        r.date.trim() !== "" &&
        r.start_time.trim() !== "" &&
        Number.isInteger(r.finish_window_minutes) &&
        r.finish_window_minutes >= 0
    );
  }, [rows, batchDivisionId]);

  const canSubmit = validRows.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      for (const row of validRows) {
        await createRace({
          event_id: eventId,
          race_id: row.race_id.trim(),
          start_time: row.start_time.trim(),
          date: row.date.trim(),
          division_id: batchDivisionId.trim(),
          finish_window_minutes: row.finish_window_minutes,
          course: row.course.trim() || undefined,
        });
      }
      onAdded();
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add starts");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Enter multiple starts for the same division. Drag from a cell to fill
        the same value down the column.
      </p>

      <div>
        <label
          htmlFor="batch-division"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Division (all rows) <span className="text-red-500">*</span>
        </label>
        <select
          id="batch-division"
          value={batchDivisionId}
          onChange={(e) => setBatchDivisionId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Select division</option>
          {divisions.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full table-auto text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <th className="px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300 w-8">
                #
              </th>
              {BATCH_COLS.map((c) => (
                <th
                  key={c.key}
                  className="whitespace-nowrap px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {c.label}
                </th>
              ))}
              <th className="w-10" aria-label="Remove row" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={BATCH_COLS.length + 2}
                  className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  {batchDivisionId.trim()
                    ? "Click Add row to add a start."
                    : "Select a division above to add starts."}
                </td>
              </tr>
            ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"
              >
                <td className="px-2 py-1 text-zinc-500 dark:text-zinc-400">
                  {rowIndex + 1}
                </td>
                {BATCH_COLS.map((col) => {
                  const val = row[col.key];
                  const inputVal =
                    typeof val === "number" ? String(val) : (val ?? "");
                  return (
                    <td key={col.key} className="p-0">
                      <input
                        type={col.type}
                        step={col.type === "number" ? 1 : undefined}
                        min={col.type === "number" ? 0 : undefined}
                        value={inputVal}
                        onChange={(e) => {
                          const v = e.target.value;
                          const next =
                            col.key === "finish_window_minutes"
                              ? (() => {
                                  const n = v === "" ? NaN : parseInt(v, 10);
                                  return Number.isNaN(n)
                                    ? 0
                                    : Math.max(0, n);
                                })()
                              : v;
                          updateCell(rowIndex, col.key, next);
                        }}
                        onMouseDown={() => handleCellMouseDown(rowIndex, col.key)}
                        onMouseEnter={() =>
                          handleCellMouseEnter(rowIndex, col.key)
                        }
                        placeholder={
                          col.key === "race_id" && batchDivisionId.trim()
                            ? suggestedRaceId
                            : undefined
                        }
                        className="w-full rounded border-0 bg-transparent px-2 py-1.5 text-zinc-900 focus:ring-1 focus:ring-indigo-500 dark:text-zinc-100 dark:focus:ring-indigo-400"
                      />
                    </td>
                  );
                })}
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    aria-label="Remove row"
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  >
                    −
                  </button>
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        disabled={!batchDivisionId.trim()}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        + Add row
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitting
            ? "Adding…"
            : `Add ${validRows.length} start${validRows.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
