"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Menu, MenuButton, MenuItems } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { InformationCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  getRaces,
  getFinishes,
  getEntries,
  createFinish,
  deleteFinish,
  type Finish,
  type Race,
  type Entry,
} from "@/lib/api";
import { DeleteFinishModal } from "./DeleteFinishModal";
import { EntriesLookupModal } from "./EntriesLookupModal";
import { RaceNotesEditor } from "./RaceNotesEditor";

/** Normalize sail number for comparison: trim and remove all whitespace so "123", " 123", "12 3" match. */
function normalizeSailNumber(s: string): string {
  return s.trim().replace(/\s+/g, "");
}

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

function classNames(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

const TABS = [
  { id: "finish" as const, name: "Finish data" },
  { id: "notes" as const, name: "Notes" },
];

export default function RecordEnterRacePage() {
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const raceId = typeof params.raceId === "string" ? params.raceId : "";
  const [raceValid, setRaceValid] = useState<boolean | null>(null);
  const [currentRace, setCurrentRace] = useState<Race | null>(null);
  const [activeTab, setActiveTab] = useState<"finish" | "notes">("finish");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [finishesLoading, setFinishesLoading] = useState(true);
  const [newRows, setNewRows] = useState<NewRow[]>([
    { sail_number: "", finish_time: "", rc_scoring: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishToDelete, setFinishToDelete] = useState<Finish | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [entriesModalOpen, setEntriesModalOpen] = useState(false);

  useEffect(() => {
    if (!eventId || !raceId) {
      setRaceValid(false);
      setCurrentRace(null);
      return;
    }
    getRaces(eventId)
      .then((races) => {
        const valid = races.some((r) => r.race_id === raceId);
        setRaceValid(valid);
        setCurrentRace(races.find((r) => r.race_id === raceId) ?? null);
      })
      .catch(() => {
        setRaceValid(false);
        setCurrentRace(null);
      });
  }, [eventId, raceId]);

  useEffect(() => {
    if (!eventId) {
      setEntries([]);
      setEntriesLoading(false);
      return;
    }
    setEntriesLoading(true);
    getEntries(eventId)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setEntriesLoading(false));
  }, [eventId]);

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

  /** On Enter in a new row field: save if this row has sail number and save is allowed. */
  const handleNewRowKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const row = newRows[index];
    if (!row.sail_number.trim()) return;
    const canSave =
      !saving &&
      newRows.some((r) => r.sail_number.trim()) &&
      firstEntryHasValidTime;
    if (canSave) {
      e.preventDefault();
      saveNewRows();
    }
  };

  /** Set of normalized sail numbers from event entries (trim + collapse spaces for comparison). */
  const validSailNumbersSet = new Set(
    entries.map((e) => normalizeSailNumber(e.sail_number))
  );

  /** True if the sail number is non-empty and not in the event's entries (after normalizing). */
  const isSailNumberInvalid = (sailNumber: string): boolean => {
    const normalized = normalizeSailNumber(sailNumber);
    return normalized.length > 0 && !validSailNumbersSet.has(normalized);
  };

  /** When there are no existing finishes, the first entry must have a valid finish time. */
  const firstEntryNeedsTime = finishes.length === 0;
  const firstRowToSave = newRows.find((r) => r.sail_number.trim());
  const firstEntryHasValidTime =
    !firstEntryNeedsTime ||
    !firstRowToSave ||
    (firstRowToSave.finish_time.trim() !== "" &&
      parseFinishTimeToSeconds(firstRowToSave.finish_time.trim()) !== null);

  const saveNewRows = async () => {
    const toSave = newRows.filter((r) => r.sail_number.trim());
    if (toSave.length === 0 || !raceId) return;
    if (firstEntryNeedsTime) {
      const first = toSave[0];
      if (
        !first.finish_time.trim() ||
        parseFinishTimeToSeconds(first.finish_time.trim()) === null
      ) {
        setError("Please enter a valid finish time (e.g. 10:02:00) for the first entry.");
        return;
      }
    }
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

  const confirmRemoveFinish = async () => {
    if (!finishToDelete || !raceId) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteFinish(finishToDelete._id);
      setFinishToDelete(null);
      const data = await getFinishes(raceId, undefined);
      setFinishes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove finish");
    } finally {
      setDeleting(false);
    }
  };

  if (!eventId || !raceId) {
    return (
      <div className="pb-8 px-0 sm:px-8 lg:px-10">
        <p className="text-zinc-500 dark:text-zinc-400">Invalid event or race.</p>
        <Link href="/record" className="mt-4 inline-block text-sm underline">
          Back to Record
        </Link>
      </div>
    );
  }

  if (raceValid === false) {
    return (
      <div className="pb-8 px-0 sm:px-8 lg:px-10">
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
    <div className="pb-8 px-0 sm:px-8 lg:px-10">
      <header className="mb-8">
        <nav className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/record" className="hover:underline">
            Record
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/record/${eventId}`}
            className="hover:underline max-w-[10px] truncate inline-block align-bottom"
            style={{
              maxWidth: '100px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'bottom',
              whiteSpace: 'nowrap',
              display: 'inline-block'
            }}
            title={`Event ${eventId}`}
          >
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
        {/* <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Sail number, finish time (required for the first entry; later entries can leave blank for last + 1s), and optional rc_scoring (e.g. OCS, DNF).
          Sail number must match an entry for this event (red border = not in entries).
        </p> */}
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:hidden">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as "finish" | "notes")}
          aria-label="Select a tab"
          className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-2 pr-8 pl-3 text-base text-zinc-900 outline-1 -outline-offset-1 outline-zinc-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-zinc-900 dark:text-zinc-50 dark:outline-zinc-600"
        >
          {TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.name}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden
          className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end fill-zinc-500"
        />
      </div>
      <div className="hidden sm:block">
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <nav aria-label="Tabs" className="-mb-px flex space-x-8">
            {TABS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={classNames(
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300",
                  "border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap cursor-pointer bg-transparent"
                )}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {activeTab === "finish" && (
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  <button
                    type="button"
                    onClick={() => setEntriesModalOpen(true)}
                    className="cursor-pointer underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-600 dark:decoration-zinc-500 dark:hover:decoration-zinc-300"
                  >
                    Sail #
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  <span className="inline-flex items-center gap-1.5">
                    Finish time
                    <Menu as="div" className="relative inline-block">
                      <MenuButton className="flex items-center rounded text-zinc-400 hover:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                        <span className="sr-only">Finish time format</span>
                        <InformationCircleIcon aria-hidden className="size-4" />
                      </MenuButton>
                      <MenuItems
                        transition
                        anchor="top start"
                        className="z-50 w-72 rounded-md bg-white py-3 px-4 shadow-lg outline-1 outline-black/5 transition dark:bg-zinc-900 dark:outline-zinc-700 data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in [--anchor-gap:6px]"
                      >
                        <p className="max-h-[50vh] overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300">
                          Use <strong>H:MM:SS</strong> or <strong>HH:MM:SS</strong> (e.g.{" "}
                          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">10:02:00</code>
                          ). Hours, minutes, and seconds; minutes and seconds 00–59. Leave blank on new rows to use last finish + 1s.
                        </p>
                      </MenuItems>
                    </Menu>
                  </span>
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Score By RC
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
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          type="button"
                          onClick={() => setFinishToDelete(f)}
                          aria-label={`Remove finish for ${f.sail_number}`}
                          className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
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
                          onKeyDown={(e) => handleNewRowKeyDown(index, e)}
                          placeholder="e.g. 1"
                          className={`w-full min-w-[5rem] rounded border bg-white px-2 py-1.5 text-sm dark:bg-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 ${
                            !entriesLoading && isSailNumberInvalid(row.sail_number)
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500/50 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/50"
                              : "border-zinc-300 focus:border-zinc-400 focus:ring-zinc-300 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-700"
                          }`}
                          aria-invalid={!entriesLoading && isSailNumberInvalid(row.sail_number)}
                        />
                      </td>
                      <td className="px-6 py-2">
                        <input
                          type="text"
                          value={row.finish_time}
                          onChange={(e) =>
                            updateNewRow(index, "finish_time", e.target.value)
                          }
                          onKeyDown={(e) => handleNewRowKeyDown(index, e)}
                          placeholder={index === 0 && finishes.length === 0 ? "e.g. 10:02:00 (required for first entry)" : "e.g. 10:02:00 (blank = last + 1s)"}
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
                          onKeyDown={(e) => handleNewRowKeyDown(index, e)}
                          placeholder="OCS, DNF, DSQ"
                          className="w-full min-w-[4rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      </td>
                      <td className="px-6 py-2">
                        <button
                          type="button"
                          onClick={() => removeNewRow(index)}
                          aria-label="Remove row"
                          className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 ">
          <button
            type="button"
            onClick={addRow}
            className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300 cursor-pointer"
          >
            + Add row
          </button>
          <button
            type="button"
            onClick={saveNewRows}
            disabled={
              saving ||
              !newRows.some((r) => r.sail_number.trim()) ||
              !firstEntryHasValidTime
            }
            className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? "Saving…" : "Save new finishes"}
          </button>
        </div>
      </div>
      )}

      {activeTab === "notes" && (
        <div className="mt-6">
          {currentRace ? (
            <RaceNotesEditor
              raceMongoId={currentRace._id}
              initialNotes={currentRace.notes ?? ""}
              onSaved={() => {
                getRaces(eventId).then((races) => {
                  const updated = races.find((r) => r.race_id === raceId);
                  if (updated) setCurrentRace(updated);
                });
              }}
            />
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white px-6 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Loading…
            </div>
          )}
        </div>
      )}

      <DeleteFinishModal
        open={finishToDelete !== null}
        onClose={() => setFinishToDelete(null)}
        sailNumber={finishToDelete?.sail_number ?? ""}
        finishTime={finishToDelete?.finish_time ?? ""}
        onConfirm={confirmRemoveFinish}
        submitting={deleting}
      />
      <EntriesLookupModal
        open={entriesModalOpen}
        onClose={() => setEntriesModalOpen(false)}
        entries={entries}
        eventId={eventId}
      />
    </div>
  );
}
