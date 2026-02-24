"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getEvents,
  getRaces,
  getFinishes,
  createFinish,
  type Event,
  type Race,
  type Finish,
} from "@/lib/api";

type NewRow = { sail_number: string; finish_time: string; race_id: string; rc_scoring: string };

export default function RecordEnterPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [eventId, setEventId] = useState("");
  const [raceId, setRaceId] = useState("");
  const [finishesLoading, setFinishesLoading] = useState(false);
  const [newRows, setNewRows] = useState<NewRow[]>([
    { sail_number: "", finish_time: "", race_id: "", rc_scoring: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvents().then(setEvents).catch(() => {});
  }, []);

  useEffect(() => {
    if (!eventId) {
      setRaces([]);
      setRaceId("");
      return;
    }
    getRaces(eventId).then((data) => {
      setRaces(data);
      setRaceId((prev) => {
        const stillValid = data.some((r) => r.race_id === prev);
        return stillValid ? prev : (data[0]?.race_id ?? "");
      });
    });
  }, [eventId]);

  useEffect(() => {
    if (!raceId && !eventId) {
      setFinishes([]);
      return;
    }
    setFinishesLoading(true);
    const promise = eventId
      ? getFinishes(undefined, eventId)
      : getFinishes(raceId, undefined);
    promise
      .then(setFinishes)
      .catch(() => setFinishes([]))
      .finally(() => setFinishesLoading(false));
  }, [raceId, eventId]);

  const addRow = () => {
    setNewRows((prev) => [
      ...prev,
      { sail_number: "", finish_time: "", race_id: raceId || "", rc_scoring: "" },
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
    const toSave = newRows.filter(
      (r) => r.sail_number.trim() && r.finish_time.trim() && r.race_id.trim()
    );
    if (toSave.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      for (const row of toSave) {
        await createFinish({
          sail_number: row.sail_number.trim(),
          race_id: row.race_id.trim(),
          finish_time: row.finish_time.trim(),
          rc_scoring: row.rc_scoring.trim() || undefined,
        });
      }
      setNewRows([
        { sail_number: "", finish_time: "", race_id: raceId || "", rc_scoring: "" },
      ]);
      if (eventId) {
        const data = await getFinishes(undefined, eventId);
        setFinishes(data);
      } else if (raceId) {
        const data = await getFinishes(raceId, undefined);
        setFinishes(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-8 px-6 sm:px-8 lg:px-10">
      <header className="mb-8">
        <nav className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/record" className="hover:underline">
            Record
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">Enter finish data</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Enter finish data
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Sail number, finish time, race ID, and optional rc_scoring (e.g. OCS, DNF).
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <span>Event:</span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">All</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <span>Race:</span>
          <select
            value={raceId}
            onChange={(e) => setRaceId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">—</option>
            {races.map((r) => (
              <option key={r._id} value={r.race_id}>
                {r.race_id} ({r.start_time})
              </option>
            ))}
          </select>
        </label>
      </div>

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
                  Race ID
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
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
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
                        {f.race_id}
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
                          placeholder="e.g. 10:02:00"
                          className="w-full min-w-[6rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      </td>
                      <td className="px-6 py-2">
                        <input
                          type="text"
                          value={row.race_id}
                          onChange={(e) =>
                            updateNewRow(index, "race_id", e.target.value)
                          }
                          placeholder="e.g. 1"
                          className="w-full min-w-[4rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
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
                !newRows.some(
                  (r) =>
                    r.sail_number.trim() &&
                    r.finish_time.trim() &&
                    r.race_id.trim()
                )
              }
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "Saving…" : "Save new finishes"}
            </button>
          </div>
      </div>
    </div>
  );
}
