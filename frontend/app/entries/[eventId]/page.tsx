"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MultiSelect } from "react-multi-select-component";
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import {
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getDivisions,
  type Entry,
  type Division,
} from "@/lib/api";
import { UploadEntriesModal } from "./UploadEntriesModal";

type DivisionOption = { label: string; value: string };

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
  const [statsOpen, setStatsOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSailNumber, setEditSailNumber] = useState("");
  const [editName, setEditName] = useState("");
  const [editDivisionIds, setEditDivisionIds] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
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

  const divisionOptions: DivisionOption[] = useMemo(
    () => divisions.map((d) => ({ label: d.name, value: d._id })),
    [divisions]
  );

  /** Normalize sail number for duplicate comparison: trim, remove all whitespace, lower. */
  const normalizeSail = (s: string) =>
    (s ?? "").trim().toLowerCase().replace(/\s+/g, "");

  /** Set of normalized sail numbers from existing entries. */
  const existingSailSet = useMemo(
    () => new Set(entries.map((e) => normalizeSail(e.sail_number))),
    [entries]
  );

  /** True if this sail number is already used by another entry (or another new row). */
  const isNewRowSailDuplicate = (rowIndex: number): boolean => {
    const sail = newRows[rowIndex]?.sail_number ?? "";
    const norm = normalizeSail(sail);
    if (!norm) return false;
    if (existingSailSet.has(norm)) return true;
    const count = newRows.filter((_, i) => normalizeSail(newRows[i].sail_number) === norm).length;
    return count > 1;
  };

  /** True if the current edit sail number is a duplicate (used by another entry). */
  const isEditSailDuplicate = (): boolean => {
    const norm = normalizeSail(editSailNumber);
    if (!norm) return false;
    const other = entries.find((e) => e._id !== editingId && normalizeSail(e.sail_number) === norm);
    return !!other;
  };

  const idsToSelected = (ids: string[]): DivisionOption[] =>
    (ids ?? []).map((id) => divisionOptions.find((o) => o.value === id) ?? { label: id, value: id }).filter(Boolean) as DivisionOption[];

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

  const setNewRowDivision = (rowIndex: number, divisionIds: string[]) => {
    setNewRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], division_ids: divisionIds ?? [] };
      return next;
    });
  };

  const saveEntryDivisions = async (entry: Entry, divisionIds: string[]) => {
    if (editingId === entry._id) return;
    setError(null);
    try {
      await updateEntry(entry._id, { division_ids: divisionIds });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update divisions");
    }
  };

  const startEdit = (entry: Entry) => {
    setEditingId(entry._id);
    setEditSailNumber(entry.sail_number);
    setEditName(entry.name ?? "");
    setEditDivisionIds(entry.division_ids ?? []);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSailNumber("");
    setEditName("");
    setEditDivisionIds([]);
  };

  const saveEdit = async () => {
    if (!editingId || !editSailNumber.trim()) return;
    if (isEditSailDuplicate()) {
      setError("Duplicate sail number");
      return;
    }
    setError(null);
    setSavingEdit(true);
    try {
      await updateEntry(editingId, {
        sail_number: editSailNumber.trim(),
        name: editName.trim() || undefined,
        division_ids: editDivisionIds.length ? editDivisionIds : undefined,
      });
      showSavedFeedback();
      cancelEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSavingEdit(false);
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
    const seen = new Set<string>();
    for (const row of toSave) {
      const norm = normalizeSail(row.sail_number);
      if (existingSailSet.has(norm) || seen.has(norm)) {
        setError("Duplicate sail number");
        return;
      }
      seen.add(norm);
    }
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
    if (isNewRowSailDuplicate(index)) {
      setError("Duplicate sail number");
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
      <div className="py-8 px-0 sm:px-8 lg:px-10">
        <p className="text-zinc-500 dark:text-zinc-400">Invalid event.</p>
        <Link href="/entries" className="mt-4 inline-block text-sm underline">
          ← Back to Entries
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 px-0 sm:px-8 lg:px-10">
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

      {/* Entry statistics accordion */}
      {!loading && (
        <section
          className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30"
          aria-label="Entry statistics"
        >
          <button
            type="button"
            onClick={() => setStatsOpen((prev) => !prev)}
            aria-expanded={statsOpen}
            aria-controls="entries-stats-content"
            id="entries-stats-trigger"
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Statistics
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {entries.length} total
            </span>
            <svg
              className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${
                statsOpen ? "rotate-180" : ""
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <div
            id="entries-stats-content"
            role="region"
            aria-labelledby="entries-stats-trigger"
            className={`overflow-hidden transition-[height] duration-200 ease-out ${
              statsOpen ? "visible" : "invisible h-0"
            }`}
          >
            <div className="border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-800">
              <div className="flex flex-wrap items-baseline gap-6">
                <div>
                  <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                    {entries.length}
                  </span>
                  <span className="ml-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                    total entries
                  </span>
                </div>
                {divisions.length > 0 && (
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                    {divisions.map((div) => {
                      const count = entries.filter(
                        (e) => (e.division_ids ?? []).indexOf(div._id) !== -1
                      ).length;
                      return (
                        <div key={div._id}>
                          <span className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                            {count}
                          </span>
                          <span className="ml-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                            {div.name}
                          </span>
                        </div>
                      );
                    })}
                    {(() => {
                      const unassigned = entries.filter(
                        (e) => !(e.division_ids ?? []).length
                      ).length;
                      if (unassigned > 0) {
                        return (
                          <div>
                            <span className="text-lg font-medium text-zinc-600 dark:text-zinc-400">
                              {unassigned}
                            </span>
                            <span className="ml-1.5 text-sm text-zinc-500 dark:text-zinc-500">
                              Unassigned
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
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
                  {entries.map((entry) => {
                    const isEditing = editingId === entry._id;
                    return (
                      <tr
                        key={entry._id}
                        className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editSailNumber}
                              onChange={(e) => setEditSailNumber(e.target.value)}
                              className={`w-full min-w-[6rem] rounded border px-2 py-1.5 text-sm dark:bg-zinc-900 dark:text-zinc-50 ${
                                isEditSailDuplicate()
                                  ? "border-red-500 dark:border-red-500"
                                  : "border-zinc-300 dark:border-zinc-600"
                              }`}
                              placeholder="Sail number"
                              aria-invalid={isEditSailDuplicate()}
                            />
                          ) : (
                            entry.sail_number
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full min-w-[8rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                              placeholder="Name"
                            />
                          ) : (
                            entry.name ?? "—"
                          )}
                        </td>
                        {divisions.length > 0 && (
                          <td className="min-w-[12rem] px-6 py-4 text-sm">
                            <MultiSelect
                              options={divisionOptions}
                              value={idsToSelected(
                                isEditing ? editDivisionIds : entry.division_ids ?? []
                              )}
                              onChange={(selected: DivisionOption[]) =>
                                isEditing
                                  ? setEditDivisionIds(selected.map((s) => s.value))
                                  : saveEntryDivisions(
                                      entry,
                                      selected.map((s) => s.value)
                                    )
                              }
                              labelledBy="Divisions"
                              disableSearch={divisionOptions.length <= 8}
                              className="min-w-[10rem] rounded border border-zinc-300 bg-white text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 [&_.dropdown-heading]:min-h-[2.25rem] [&_.dropdown-heading]:rounded [&_.dropdown-heading]:border-0 [&_.dropdown-heading]:py-1.5"
                            />
                          </td>
                        )}
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          {isEditing ? (
                            <span className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={saveEdit}
                                disabled={savingEdit || !editSailNumber.trim() || isEditSailDuplicate()}
                                className="cursor-pointer rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-zinc-800 dark:hover:text-emerald-400 disabled:opacity-50"
                                aria-label="Save"
                              >
                                <CheckIcon className="h-5 w-5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={savingEdit}
                                className="cursor-pointer rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 disabled:opacity-50"
                                aria-label="Cancel"
                              >
                                <XMarkIcon className="h-5 w-5" aria-hidden />
                              </button>
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(entry)}
                                className="cursor-pointer rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                                aria-label="Edit"
                              >
                                <PencilIcon className="h-5 w-5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeEntry(entry._id)}
                                className="cursor-pointer rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                                aria-label="Remove"
                              >
                                <TrashIcon className="h-5 w-5" aria-hidden />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
                          className={`w-full min-w-[6rem] rounded border px-2 py-1.5 text-sm dark:bg-zinc-900 dark:text-zinc-50 ${
                            isNewRowSailDuplicate(index)
                              ? "border-red-500 dark:border-red-500"
                              : "border-zinc-300 dark:border-zinc-600"
                          }`}
                          aria-invalid={isNewRowSailDuplicate(index)}
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
                        <td className="min-w-[12rem] px-6 py-2">
                          <MultiSelect
                            options={divisionOptions}
                            value={idsToSelected(row.division_ids ?? [])}
                            onChange={(selected: DivisionOption[]) =>
                              setNewRowDivision(
                                index,
                                selected.map((s) => s.value)
                              )
                            }
                            labelledBy="Divisions"
                            disableSearch={divisionOptions.length <= 8}
                            className="min-w-[10rem] rounded border border-zinc-300 bg-white text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 [&_.dropdown-heading]:min-h-[2.25rem] [&_.dropdown-heading]:rounded [&_.dropdown-heading]:border-0 [&_.dropdown-heading]:py-1.5"
                          />
                        </td>
                      )}
                      <td className="px-6 py-2">
                        <button
                          type="button"
                          onClick={() => removeNewRow(index)}
                          className="cursor-pointer rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                          aria-label="Remove"
                        >
                          <TrashIcon className="h-5 w-5" aria-hidden />
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
            className="cursor-pointer text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
          >
            + Add row
          </button>
          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="cursor-pointer text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
          >
            Upload Files
          </button>
          <button
            type="button"
            onClick={saveNewRows}
            disabled={saving || newRows.every((r) => !r.sail_number.trim())}
            className={`cursor-pointer inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
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
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>

      <UploadEntriesModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        eventId={eventId}
        existingEntries={entries}
        onImported={() => {
          load();
          setSuccessMessage("Imported");
          setUploadModalOpen(false);
        }}
      />
    </div>
  );
}
