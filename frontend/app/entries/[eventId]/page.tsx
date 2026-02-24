"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getDivisions,
  type Entry,
  type Division,
} from "@/lib/api";

export default function EntriesEventPage() {
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRows, setNewRows] = useState<
    { sail_number: string; name: string; division_ids: string[] }[]
  >([{ sail_number: "", name: "", division_ids: [] }]);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [removedFeedback, setRemovedFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastNewRowSailRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [entriesData, divisionsData] = await Promise.all([
        getEntries(eventId),
        getDivisions(eventId),
      ]);
      setEntries(entriesData);
      setDivisions(divisionsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

  /** Auto-dismiss success notification after 4 seconds. */
  useEffect(() => {
    if (successMessage == null) return;
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = setTimeout(() => {
      setSuccessMessage(null);
      successTimeoutRef.current = null;
    }, 4000);
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, [successMessage]);

  const addRow = () => {
    setNewRows((prev) => [...prev, { sail_number: "", name: "", division_ids: [] }]);
  };

  const updateNewRow = (
    index: number,
    field: "sail_number" | "name",
    value: string
  ) => {
    setNewRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const setNewRowDivision = (rowIndex: number, divisionId: string) => {
    setNewRows((prev) => {
      const next = [...prev];
      next[rowIndex] = {
        ...next[rowIndex],
        division_ids: divisionId ? [divisionId] : [],
      };
      return next;
    });
  };

  const setEntryDivision = async (entry: Entry, divisionId: string) => {
    const nextIds = divisionId ? [divisionId] : [];
    setError(null);
    try {
      await updateEntry(entry._id, { division_ids: nextIds });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update divisions");
    }
  };

  const removeNewRow = (index: number) => {
    setNewRows((prev) => prev.filter((_, i) => i !== index));
  };

  const showSavedFeedback = () => {
    setSuccessMessage("Saved");
  };

  const showRemovedFeedback = () => {
    setRemovedFeedback(true);
    setTimeout(() => setRemovedFeedback(false), 2000);
  };

  const removeEntry = async (entryId: string) => {
    setError(null);
    try {
      await deleteEntry(entryId);
      await load();
      showRemovedFeedback();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove entry");
    }
  };

  const saveNewRows = async () => {
    const toSave = newRows.filter((r) => r.sail_number.trim() !== "");
    if (toSave.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      for (const row of toSave) {
        await createEntry({
          event_id: eventId,
          sail_number: row.sail_number.trim(),
          name: row.name.trim(),
          division_ids: row.division_ids?.length ? row.division_ids : undefined,
        });
      }
      setNewRows([{ sail_number: "", name: "", division_ids: [] }]);
      showSavedFeedback();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveRowAndAddNew = async (index: number) => {
    const row = newRows[index];
    if (!row?.sail_number.trim()) {
      addRow();
      setTimeout(() => lastNewRowSailRef.current?.focus(), 0);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createEntry({
        event_id: eventId,
        sail_number: row.sail_number.trim(),
        name: row.name.trim(),
        division_ids: row.division_ids?.length ? row.division_ids : undefined,
      });
      setNewRows((prev) => [
        ...prev.slice(0, index),
        ...prev.slice(index + 1),
        { sail_number: "", name: "", division_ids: [] },
      ]);
      showSavedFeedback();
      await load();
      setTimeout(() => lastNewRowSailRef.current?.focus(), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleNewRowKeyDown = (
    index: number,
    field: "sail_number" | "name",
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    saveRowAndAddNew(index);
  };

  if (!eventId) {
    return (
      <div className="py-8 px-6 sm:px-8 lg:px-10">
        <p className="text-zinc-500 dark:text-zinc-400">Invalid event.</p>
        <Link href="/entries" className="mt-4 inline-block text-sm underline">
          ← Back to Entries
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 sm:px-8 lg:px-10">
      <header className="mb-8">
        <nav className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/entries" className="hover:underline">
            Entries
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">Event {eventId}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Entries for event {eventId}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Spreadsheet: add sail number and name, then save.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {removedFeedback && (
        <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          Entry removed.
        </p>
      )}

      {/* Success notification (Tailwind-style toast) */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[100] flex w-full max-w-sm items-start gap-3 rounded-lg border border-emerald-200 bg-white p-4 shadow-lg ring-1 ring-emerald-500/10 dark:border-emerald-800 dark:bg-zinc-900 dark:ring-emerald-400/20"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <svg
              className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="flex-1 pt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {successMessage}
          </p>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Dismiss notification"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-2.72 2.72a.75.75 0 101.06 1.06L10 11.06l2.72 2.72a.75.75 0 101.06-1.06L11.06 10l2.72-2.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 6.22z" />
            </svg>
          </button>
        </div>
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
                  Name
                </th>
                {divisions.length > 0 && (
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    Divisions
                  </th>
                )}
                <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={divisions.length > 0 ? 4 : 3}
                    className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    Loading…
                  </td>
                </tr>
              ) : (
                <>
                  {entries.map((entry) => (
                    <tr
                      key={entry._id}
                      className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                        {entry.sail_number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {entry.name ?? "—"}
                      </td>
                      {divisions.length > 0 && (
                        <td className="px-6 py-4 text-sm">
                          <select
                            value={(entry.division_ids ?? [])[0] ?? ""}
                            onChange={(e) =>
                              setEntryDivision(entry, e.target.value)
                            }
                            className="min-w-[8rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                          >
                            <option value="">—</option>
                            {divisions.map((div) => (
                              <option key={div._id} value={div._id}>
                                {div.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          type="button"
                          onClick={() => removeEntry(entry._id)}
                          className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                        >
                          Remove
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
                          ref={
                            index === newRows.length - 1
                              ? lastNewRowSailRef
                              : undefined
                          }
                          type="text"
                          value={row.sail_number}
                          onChange={(e) =>
                            updateNewRow(index, "sail_number", e.target.value)
                          }
                          onKeyDown={(e) =>
                            handleNewRowKeyDown(index, "sail_number", e)
                          }
                          placeholder="e.g. 1"
                          className="w-full min-w-[6rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      </td>
                      <td className="px-6 py-2">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) =>
                            updateNewRow(index, "name", e.target.value)
                          }
                          onKeyDown={(e) =>
                            handleNewRowKeyDown(index, "name", e)
                          }
                          placeholder="e.g. Larry"
                          className="w-full min-w-[8rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      </td>
                      {divisions.length > 0 && (
                        <td className="px-6 py-2">
                          <select
                            value={(row.division_ids ?? [])[0] ?? ""}
                            onChange={(e) =>
                              setNewRowDivision(index, e.target.value)
                            }
                            className="min-w-[8rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                          >
                            <option value="">—</option>
                            {divisions.map((div) => (
                              <option key={div._id} value={div._id}>
                                {div.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
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
            disabled={saving || newRows.every((r) => !r.sail_number.trim())}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              successMessage
                ? "bg-emerald-600 text-white dark:bg-emerald-600"
                : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            }`}
          >
            {saving ? (
              "Saving…"
            ) : successMessage ? (
              "Saved"
            ) : (
              "Save new entries"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
