"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getRaces,
  getFinishes,
  createFinish,
  type Finish,
} from "@/lib/api";

type NewRow = { sail_number: string; finish_time: string; rc_scoring: string };

/** Parse "H:MM:SS" or "HH:MM:SS" to seconds since midnight. Returns null if invalid. */
function parseFinishTimeToSeconds(timeStr: string): number | null {
  const trimmed = timeStr.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => isNaN(n) || n < 0)) return null;
  const [h, m, s] = parts;
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

/** Format seconds since midnight to "HH:MM:SS". Handles rollover (e.g. 86400 -> 00:00:00). */
function secondsToFinishTime(totalSeconds: number): string {
  const s = ((totalSeconds % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Get the latest finish time for a race and add one second. Falls back to "00:00:01" if no finishes. */
function deriveFinishTimeFromLast(finishes: Finish[]): string {
  if (finishes.length === 0) return "00:00:01";
  let maxSeconds = -1;
  for (const f of finishes) {
    const sec = parseFinishTimeToSeconds(f.finish_time);
    if (sec !== null && sec > maxSeconds) maxSeconds = sec;
  }
  if (maxSeconds < 0) return "00:00:01";
  return secondsToFinishTime(maxSeconds + 1);
}

export default function RecordEnterRacePage() {
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const raceId = typeof params.raceId === "string" ? params.raceId : "";
  const [raceValid, setRaceValid] = useState<boolean | null>(null);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [finishesLoading, setFinishesLoading] = useState(true);
  const [newRows, setNewRows] = useState<NewRow[]>([
    { sail_number: "", finish_time: "", rc_scoring: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !raceId) {
      setRaceValid(false);
      return;
    }
    getRaces(eventId)
      .then((races) => {
        const valid = races.some((r) => r.race_id === raceId);
        setRaceValid(valid);
      })
      .catch(() => setRaceValid(false));
  }, [eventId, raceId]);

  useEffect(() => {
    if (!raceId || raceValid !== true) {
      setFinishes([]);
      setFinishesLoading(raceValid === null);
      return;
    }
    setFinishesLoading(true);
    getFinishes(raceId, undefined)
      .then(setFinishes)
      .catch(() => setFinishes([]))
      .finally(() => setFinishesLoading(false));
  }, [raceId, raceValid]);

  const addRow = () => {
    setNewRows((prev) => [
      ...prev,
      { sail_number: "", finish_time: "", rc_scoring: "" },
    ]);
  };

  const updateNewRow = (
    index: number,
    field: keyof NewRow,
    value: string
  ) => {
    setNewRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeNewRow = (index: number) => {
    setNewRows((prev) => prev.filter((_, i) => i !== index));
  };

  const saveNewRows = async () => {
    const toSave = newRows.filter((r) => r.sail_number.trim());
    if (toSave.length === 0 || !raceId) return;
    setError(null);
    setSaving(true);
    try {
      const defaultTime = deriveFinishTimeFromLast(finishes);
      for (const row of toSave) {
        const finishTime = row.finish_time.trim() || defaultTime;
        await createFinish({
          sail_number: row.sail_number.trim(),
          race_id: raceId,
          finish_time: finishTime,
          rc_scoring: row.rc_scoring.trim() || undefined,
        });
      }
      setNewRows([{ sail_number: "", finish_time: "", rc_scoring: "" }]);
      const data = await getFinishes(raceId, undefined);
      setFinishes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!eventId || !raceId) {
    return (
      <div className="py-8 px-6 sm:px-8 lg:px-10">
        <p className="text-zinc-500 dark:text-zinc-400">Invalid event or race.</p>
        <Link href="/record" className="mt-4 inline-block text-sm underline">
          Back to Record
        </Link>
      </div>
    );
  }

  if (raceValid === false) {
    return (
      <div className="py-8 px-6 sm:px-8 lg:px-10">
        <p className="text-zinc-500 dark:text-zinc-400">
          Race not found for this event.
        </p>
        <Link href={`/record/${eventId}`} className="mt-4 inline-block text-sm underline">
          Back to Event {eventId}
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 sm:px-8 lg:px-10">
      <header className="mb-8">
        <nav className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/record" className="hover:underline">
            Record
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/record/${eventId}`} className="hover:underline">
            Event {eventId}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">
            Enter finishes — Race {raceId}
          </span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Enter finish data — Race {raceId}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Sail number, finish time (optional; blank = last + 1s), and optional rc_scoring (e.g. OCS, DNF).
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Sail number
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Finish time
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  rc_scoring
                </th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {finishesLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Loading…
                  </td>
                </tr>
              ) : (
                <>
                  {finishes.map((f) => (
                    <tr
                      key={f._id}
                      className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                        {f.sail_number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {f.finish_time}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {f.rc_scoring ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">—</td>
                    </tr>
                  ))}
                  {newRows.map((row, index) => (
                    <tr
                      key={`new-${index}`}
                      className="bg-zinc-50/50 dark:bg-zinc-900/30"
                    >
                      <td className="px-6 py-2">
                        <input
                          type="text"
                          value={row.sail_number}
                          onChange={(e) =>
                            updateNewRow(index, "sail_number", e.target.value)
                          }
                          placeholder="e.g. 1"
                          className="w-full min-w-[5rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      </td>
                      <td className="px-6 py-2">
                        <input
                          type="text"
                          value={row.finish_time}
                          onChange={(e) =>
                            updateNewRow(index, "finish_time", e.target.value)
                          }
                          placeholder="e.g. 10:02:00 (blank = last + 1s)"
                          className="w-full min-w-[6rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      </td>
                      <td className="px-6 py-2">
                        <input
                          type="text"
                          value={row.rc_scoring}
                          onChange={(e) =>
                            updateNewRow(index, "rc_scoring", e.target.value)
                          }
                          placeholder="OCS, DNF, DSQ"
                          className="w-full min-w-[4rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      </td>
                      <td className="px-6 py-2">
                        <button
                          type="button"
                          onClick={() => removeNewRow(index)}
                          className="text-sm text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={addRow}
            className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
          >
            + Add row
          </button>
          <button
            type="button"
            onClick={saveNewRows}
            disabled={
              saving ||
              !newRows.some((r) => r.sail_number.trim())
            }
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? "Saving…" : "Save new finishes"}
          </button>
          <Link
            href={`/record/${eventId}`}
            className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
          >
            Back to event
          </Link>
        </div>
      </div>
    </div>
  );
}
