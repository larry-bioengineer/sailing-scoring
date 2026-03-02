"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getRaces,
  getDivisions,
  getFinishes,
  getEntries,
  createFinish,
  updateFinish,
  deleteFinish,
  type Race,
  type Division,
  type Finish,
  type Entry,
} from "@/lib/api";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { AddEntryOrDivisionModal } from "./AddEntryOrDivisionModal";

function normalizeSail(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/** Ensure time string is HH:MM:SS (e.g. "12:00" -> "12:00:00"). */
function normalizeTimeToHHMMSS(t: string): string {
  const s = (t ?? "").trim();
  if (!s) return "";
  const parts = s.split(":");
  if (parts.length === 3) return s;
  if (parts.length === 2) return `${s}:00`;
  return s.length <= 5 ? `${s}:00` : s;
}

/** Parse finish_time into date (YYYY-MM-DD) and time. Handles "YYYY-MM-DD HH:MM:SS" or "HH:MM:SS". */
function parseFinishTime(ft: string): { date: string; time: string } {
  const s = (ft ?? "").trim();
  if (!s) return { date: "", time: "" };
  const space = s.indexOf(" ");
  if (space > 0) {
    return { date: s.slice(0, space), time: normalizeTimeToHHMMSS(s.slice(space + 1)) };
  }
  return { date: "", time: normalizeTimeToHHMMSS(s) };
}

export default function RecordFinishPage() {
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";

  const [races, setRaces] = useState<Race[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Today in YYYY-MM-DD for default finish date */
  const todayStr = () => new Date().toISOString().slice(0, 10);

  // Add row form
  const [newSailNumber, setNewSailNumber] = useState("");
  const [newRaceId, setNewRaceId] = useState("");
  const [newFinishDate, setNewFinishDate] = useState(todayStr());
  const [newFinishTime, setNewFinishTime] = useState("");
  const [newRcScoring, setNewRcScoring] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSailNumber, setEditSailNumber] = useState("");
  const [editRaceId, setEditRaceId] = useState("");
  const [editFinishDate, setEditFinishDate] = useState("");
  const [editFinishTime, setEditFinishTime] = useState("");
  const [editRcScoring, setEditRcScoring] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal: sail has no entry or no division
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryModalSailNumber, setEntryModalSailNumber] = useState("");
  const [entryModalEntry, setEntryModalEntry] = useState<Entry | null>(null);

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [racesData, divisionsData, finishesData, entriesData] =
        await Promise.all([
          getRaces(eventId),
          getDivisions(eventId),
          getFinishes(undefined, eventId),
          getEntries(eventId),
        ]);
      setRaces(racesData);
      setDivisions(divisionsData);
      setFinishes(finishesData);
      setEntries(entriesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const divisionNameById = useMemo(
    () => new Map(divisions.map((d) => [d._id, d.name])),
    [divisions]
  );

  const entryBySail = useMemo(
    () =>
      new Map(entries.map((e) => [normalizeSail(e.sail_number), e])),
    [entries]
  );

  /** Races that belong to any of the given division IDs */
  const racesForDivisionIds = useMemo(
    () => (divisionIds: string[]) => {
      const set = new Set(divisionIds);
      return races.filter((r) => r.division_id && set.has(r.division_id));
    },
    [races]
  );

  /** For a sail number, get the list of races (Race No) they can choose from */
  const getRacesForSail = (sailNumber: string): Race[] => {
    const norm = normalizeSail(sailNumber);
    const entry = entryBySail.get(norm);
    const divisionIds = entry?.division_ids ?? [];
    return racesForDivisionIds(divisionIds);
  };

  const canChooseRaceForSail = (sailNumber: string): boolean => {
    const norm = normalizeSail(sailNumber);
    const entry = entryBySail.get(norm);
    if (!entry) return false;
    const ids = entry.division_ids ?? [];
    if (ids.length === 0) return false;
    return racesForDivisionIds(ids).length > 0;
  };

  const needsEntryOrDivision = (sailNumber: string): "no-entry" | "no-division" | null => {
    const norm = normalizeSail(sailNumber);
    if (!sailNumber.trim()) return null;
    const entry = entryBySail.get(norm);
    if (!entry) return "no-entry";
    const ids = entry.division_ids ?? [];
    if (ids.length === 0) return "no-division";
    return null;
  };

  const openEntryModalFor = (sailNumber: string) => {
    const norm = normalizeSail(sailNumber);
    const entry = entryBySail.get(norm) ?? null;
    setEntryModalSailNumber(sailNumber.trim());
    setEntryModalEntry(entry);
    setEntryModalOpen(true);
  };

  const finishRows = useMemo(() => {
    const rows = finishes.map((f) => {
      const entry = entryBySail.get(normalizeSail(f.sail_number));
      const divisionNames = (entry?.division_ids ?? [])
        .map((id) => divisionNameById.get(id) ?? id)
        .filter(Boolean);
      const { date, time } = parseFinishTime(f.finish_time);
      return {
        ...f,
        divisionsDisplay:
          divisionNames.length > 0 ? divisionNames.join(", ") : "—",
        dateDisplay: date || "—",
        timeDisplay: time || f.finish_time,
      };
    });
    return [...rows].reverse();
  }, [finishes, entryBySail, divisionNameById]);

  const handleAddFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    const sail = newSailNumber.trim();
    const need = needsEntryOrDivision(sail);
    if (need) {
      openEntryModalFor(sail);
      return;
    }
    if (!newRaceId.trim() || !newFinishTime.trim()) return;
    setError(null);
    setSavingNew(true);
    try {
      const timePart = normalizeTimeToHHMMSS(newFinishTime.trim());
      const finishTime = newFinishDate.trim()
        ? `${newFinishDate.trim()} ${timePart}`.trim()
        : timePart;
      await createFinish({
        sail_number: sail,
        race_id: newRaceId.trim(),
        finish_time: finishTime,
        rc_scoring: newRcScoring.trim() || undefined,
      });
      await load();
      setNewSailNumber("");
      setNewRaceId("");
      setNewFinishDate(todayStr());
      setNewFinishTime("");
      setNewRcScoring("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add finish");
    } finally {
      setSavingNew(false);
    }
  };

  const startEdit = (f: Finish) => {
    const { date, time } = parseFinishTime(f.finish_time);
    setEditingId(f._id);
    setEditSailNumber(f.sail_number);
    setEditRaceId(f.race_id);
    setEditFinishDate(date || todayStr());
    setEditFinishTime(time);
    setEditRcScoring(f.rc_scoring ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdateFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const need = needsEntryOrDivision(editSailNumber);
    if (need) {
      openEntryModalFor(editSailNumber);
      return;
    }
    setError(null);
    setSavingEdit(true);
    try {
      const timePart = normalizeTimeToHHMMSS(editFinishTime.trim());
      const finishTime = editFinishDate.trim()
        ? `${editFinishDate.trim()} ${timePart}`.trim()
        : timePart;
      await updateFinish(editingId, {
        sail_number: editSailNumber.trim(),
        race_id: editRaceId.trim(),
        finish_time: finishTime,
        rc_scoring: editRcScoring.trim() || undefined,
      });
      await load();
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (finishId: string) => {
    if (!confirm("Delete this finish record?")) return;
    setError(null);
    try {
      await deleteFinish(finishId);
      await load();
      if (editingId === finishId) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const newRowRaces = useMemo(
    () => getRacesForSail(newSailNumber),
    [newSailNumber, entryBySail, racesForDivisionIds]
  );
  const editRowRaces = useMemo(
    () => getRacesForSail(editSailNumber),
    [editSailNumber, entryBySail, racesForDivisionIds]
  );

  if (!eventId) {
    return (
      <div className="py-8 px-0 sm:px-8 lg:px-10">
        <p className="text-zinc-500 dark:text-zinc-400">Invalid event.</p>
        <Link href="/record" className="mt-4 inline-block text-sm underline">
          ← Record
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 px-0 sm:px-8 lg:px-10">
      <header className="mb-8">
        <Link
          href={`/record/${eventId}`}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          ← Back to Record
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Edit finishes
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Add, edit, or delete finish records. Race No is filtered by the sail
          number’s division(s).
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : (
        <div className="space-y-6">
          {/* Add new row */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
              Add finish
            </h2>
            <form onSubmit={handleAddFinish} className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Sail No.
                </label>
                <input
                  type="text"
                  value={newSailNumber}
                  onChange={(e) => setNewSailNumber(e.target.value)}
                  placeholder="e.g. HKG 123"
                  className="mt-1 h-9 w-32 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Race No
                </label>
                {newSailNumber.trim() && needsEntryOrDivision(newSailNumber.trim()) ? (
                  <button
                    type="button"
                    onClick={() => openEntryModalFor(newSailNumber.trim())}
                    className="mt-1 block rounded border border-amber-400 bg-amber-50 px-2 py-1.5 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200"
                  >
                    Add to entries / Assign division
                  </button>
                ) : (
                  <select
                    value={newRaceId}
                    onChange={(e) => setNewRaceId(e.target.value)}
                    className="mt-1 h-9 w-24 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Select</option>
                    {newRowRaces.map((r) => (
                      <option key={r._id} value={r.race_id}>
                        {r.race_id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Date
                </label>
                <input
                  type="date"
                  value={newFinishDate}
                  onChange={(e) => setNewFinishDate(e.target.value)}
                  className="mt-1 h-9 w-40 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Time (HH:MM:SS)
                </label>
                <input
                  type="time"
                  step="1"
                  value={newFinishTime}
                  onChange={(e) => setNewFinishTime(e.target.value)}
                  className="mt-1 h-9 w-40 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Score by RC
                </label>
                <input
                  type="text"
                  value={newRcScoring}
                  onChange={(e) => setNewRcScoring(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 h-9 w-24 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                disabled={
                  savingNew ||
                  !newSailNumber.trim() ||
                  !!needsEntryOrDivision(newSailNumber.trim()) ||
                  !newFinishTime.trim() ||
                  (canChooseRaceForSail(newSailNumber)
                    ? !newRaceId.trim()
                    : false)
                }
                className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {savingNew ? "Adding…" : "Add"}
              </button>
            </form>
          </section>

          {/* Table */}
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead>
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Sail No.
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Divisions
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Race No
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Time (HH:MM:SS)
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Score by RC
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {finishRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                      >
                        No finishes. Add one above.
                      </td>
                    </tr>
                  ) : (
                    finishRows.map((row) =>
                      editingId === row._id ? (
                        <tr key={row._id} className="bg-zinc-50 dark:bg-zinc-900/50">
                          <td className="px-6 py-2">
                            <input
                              type="text"
                              value={editSailNumber}
                              onChange={(e) => setEditSailNumber(e.target.value)}
                              className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                            />
                          </td>
                          <td className="px-6 py-2 text-sm text-zinc-500">
                            {row.divisionsDisplay}
                          </td>
                          <td className="px-6 py-2">
                            {editSailNumber.trim() &&
                            needsEntryOrDivision(editSailNumber.trim()) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openEntryModalFor(editSailNumber.trim())
                                }
                                className="text-sm text-amber-600 dark:text-amber-400"
                              >
                                Add/assign division
                              </button>
                            ) : (
                              <select
                                value={editRaceId}
                                onChange={(e) => setEditRaceId(e.target.value)}
                                className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                              >
                                {editRowRaces.map((r) => (
                                  <option key={r._id} value={r.race_id}>
                                    {r.race_id}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-6 py-2">
                            <input
                              type="date"
                              value={editFinishDate}
                              onChange={(e) => setEditFinishDate(e.target.value)}
                              className="w-36 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                            />
                          </td>
                          <td className="px-6 py-2">
                            <input
                              type="time"
                              step="1"
                              value={editFinishTime}
                              onChange={(e) =>
                                setEditFinishTime(e.target.value)
                              }
                              className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                            />
                          </td>
                          <td className="px-6 py-2">
                            <input
                              type="text"
                              value={editRcScoring}
                              onChange={(e) => setEditRcScoring(e.target.value)}
                              className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                            />
                          </td>
                          <td className="px-6 py-2 text-right">
                            <button
                              type="button"
                              onClick={handleUpdateFinish}
                              disabled={savingEdit}
                              className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:underline disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="cursor-pointer ml-2 text-sm text-zinc-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr
                          key={row._id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                            {row.sail_number}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.divisionsDisplay}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.race_id}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.dateDisplay}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.timeDisplay}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.rc_scoring ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              title="Edit"
                              aria-label="Edit"
                              className="cursor-pointer rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                            >
                              <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row._id)}
                              title="Delete"
                              aria-label="Delete"
                              className="cursor-pointer rounded p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <AddEntryOrDivisionModal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        eventId={eventId}
        sailNumber={entryModalSailNumber}
        existingEntry={entryModalEntry}
        divisions={divisions}
        onSuccess={load}
      />
    </div>
  );
}
