"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getDivisions,
  getEntries,
  createDivision,
  updateDivision,
  deleteDivision,
  updateEntry,
  type Division,
  type Entry,
} from "@/lib/api";

const DRAWER_TRANSITION_MS = 200;

export default function DivisionsEventPage() {
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDivisionId, setEditingDivisionId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  /** Entries for the event, loaded when drawer opens */
  const [drawerEntries, setDrawerEntries] = useState<Entry[]>([]);
  /** Entry _ids to include in this division (when saving) */
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  /** Search query to filter entries in the drawer */
  const [entrySearchQuery, setEntrySearchQuery] = useState("");
  const [drawerEntered, setDrawerEntered] = useState(false);
  const drawerClosingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const data = await getDivisions(eventId);
      setDivisions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load divisions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

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

  useEffect(() => {
    if (!drawerOpen) return;
    setDrawerEntered(false);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [drawerOpen]);

  const closeDrawer = () => {
    drawerClosingRef.current = true;
    setDrawerEntered(false);
    setEditingDivisionId(null);
    setNameInput("");
    setDrawerEntries([]);
    setSelectedEntryIds(new Set());
    setEntrySearchQuery("");
  };

  const openAddDrawer = async () => {
    setEditingDivisionId(null);
    setNameInput("");
    setSelectedEntryIds(new Set());
    setError(null);
    setDrawerOpen(true);
    try {
      const entries = await getEntries(eventId);
      setDrawerEntries(entries);
    } catch {
      setDrawerEntries([]);
    }
  };

  const openEditDrawer = async (d: Division) => {
    setEditingDivisionId(d._id);
    setNameInput(d.name);
    setError(null);
    setDrawerOpen(true);
    try {
      const entries = await getEntries(eventId);
      setDrawerEntries(entries);
      const inDivision = new Set(
        entries
          .filter((e) => (e.division_ids ?? []).includes(d._id))
          .map((e) => e._id)
      );
      setSelectedEntryIds(inDivision);
    } catch {
      setDrawerEntries([]);
      setSelectedEntryIds(new Set());
    }
  };

  const toggleEntryInDivision = (entryId: string) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  /** Entries visible after search filter */
  const filteredDrawerEntries = drawerEntries.filter((e) => {
    const q = entrySearchQuery.trim().toLowerCase();
    if (!q) return true;
    const sail = (e.sail_number ?? "").toLowerCase();
    const name = (e.name ?? "").toLowerCase();
    return sail.includes(q) || name.includes(q);
  });

  /** Select all entries currently shown (search result). */
  const selectAllEntries = () =>
    setSelectedEntryIds(new Set(filteredDrawerEntries.map((e) => e._id)));
  /** Deselect all entries currently shown (search result). */
  const deselectAllEntries = () =>
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      filteredDrawerEntries.forEach((e) => next.delete(e._id));
      return next;
    });

  const handleDrawerTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    if (drawerClosingRef.current) {
      setDrawerOpen(false);
      drawerClosingRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = nameInput.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingDivisionId) {
        await updateDivision(editingDivisionId, { name });
        for (const entry of drawerEntries) {
          const current = new Set(entry.division_ids ?? []);
          const shouldBeIn = selectedEntryIds.has(entry._id);
          const hasDivision = current.has(editingDivisionId);
          if (shouldBeIn && !hasDivision) {
            current.add(editingDivisionId);
            await updateEntry(entry._id, { division_ids: [...current] });
          } else if (!shouldBeIn && hasDivision) {
            current.delete(editingDivisionId);
            await updateEntry(entry._id, { division_ids: [...current] });
          }
        }
        setSuccessMessage("Division updated.");
      } else {
        const created = await createDivision({ event_id: eventId, name });
        const divisionId = created._id;
        for (const entry of drawerEntries) {
          if (selectedEntryIds.has(entry._id)) {
            const next = new Set(entry.division_ids ?? []);
            next.add(divisionId);
            await updateEntry(entry._id, { division_ids: [...next] });
          }
        }
        setSuccessMessage("Division created.");
      }
      setDrawerEntered(false);
      setDrawerOpen(false);
      setEditingDivisionId(null);
      setNameInput("");
      setDrawerEntries([]);
      setSelectedEntryIds(new Set());
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingDivisionId
            ? "Failed to update division"
            : "Failed to create division"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (divisionId: string) => {
    setError(null);
    try {
      await deleteDivision(divisionId);
      setDeleteConfirmId(null);
      setSuccessMessage("Division removed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete division");
    }
  };

  if (!eventId) {
    return (
      <div className="py-8 px-6 sm:px-8 lg:px-10">
        <p className="text-zinc-500 dark:text-zinc-400">Invalid event.</p>
        <Link href="/divisions" className="mt-4 inline-block text-sm underline">
          ← Back to Divisions
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 sm:px-8 lg:px-10">
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[100] flex w-full max-w-sm items-start gap-3 rounded-lg border border-emerald-200 bg-white p-4 shadow-lg ring-1 ring-emerald-500/10 dark:border-emerald-800 dark:bg-zinc-900 dark:ring-emerald-400/20"
        >
          <p className="flex-1 pt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {successMessage}
          </p>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Dismiss notification"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-2.72 2.72a.75.75 0 101.06 1.06L10 11.06l2.72 2.72a.75.75 0 101.06-1.06L11.06 10l2.72-2.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 6.22z" />
            </svg>
          </button>
        </div>
      )}

      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <nav className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/divisions" className="hover:underline">
              Divisions
            </Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-700 dark:text-zinc-300">Event {eventId}</span>
          </nav>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Divisions for event {eventId}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create and edit divisions. Assign entries to divisions on the Entries page.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddDrawer}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add division
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <p className="p-6 text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    Division name
                  </th>
                  <th
                    scope="col"
                    className="relative px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {divisions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                    >
                      No divisions yet. Add a division to group entries for results.
                    </td>
                  </tr>
                ) : (
                  divisions.map((d) => (
                    <tr
                      key={d._id}
                      className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {d.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {deleteConfirmId === d._id ? (
                          <span className="flex items-center justify-end gap-2">
                            <span className="text-sm text-zinc-500 dark:text-zinc-400">
                              Delete?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDelete(d._id)}
                              className="rounded-lg bg-red-600 px-2 py-1 text-sm font-medium text-white hover:bg-red-700"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="rounded-lg border border-zinc-300 px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditDrawer(d)}
                              className="mr-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(d._id)}
                              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <Link
          href="/divisions"
          className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
        >
          ← Back to Divisions
        </Link>
      </div>

      {drawerOpen && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ease-out ${
              drawerEntered ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDuration: `${DRAWER_TRANSITION_MS}ms` }}
            aria-hidden
            onClick={closeDrawer}
          />
          <div
            className={`fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950 ${
              drawerEntered ? "translate-x-0" : "translate-x-full"
            }`}
            style={{ transitionDuration: `${DRAWER_TRANSITION_MS}ms` }}
            onTransitionEnd={handleDrawerTransitionEnd}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {editingDivisionId ? "Edit division" : "Add division"}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-2.72 2.72a.75.75 0 101.06 1.06L10 11.06l2.72 2.72a.75.75 0 101.06-1.06L11.06 10l2.72-2.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 6.22z" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden p-6">
              {error && (
                <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <label htmlFor="division-name" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Name
              </label>
              <input
                id="division-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="e.g. Laser, Optimist"
              />

              {drawerEntries.length > 0 && (
                <div className="mb-4 flex flex-1 flex-col overflow-hidden">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Entries in this division
                    </span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllEntries}
                        className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-400"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllEntries}
                        className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-400"
                      >
                        Deselect all
                      </button>
                    </span>
                  </div>
                  <input
                    type="search"
                    value={entrySearchQuery}
                    onChange={(e) => setEntrySearchQuery(e.target.value)}
                    placeholder="Search by sail number or name…"
                    className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
                    aria-label="Filter entries"
                  />
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <ul className="divide-y divide-zinc-200 p-2 dark:divide-zinc-700">
                      {filteredDrawerEntries.length === 0 ? (
                        <li className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                          No entries match your search.
                        </li>
                      ) : (
                        filteredDrawerEntries.map((entry) => (
                          <li key={entry._id}>
                            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                              <input
                                type="checkbox"
                                checked={selectedEntryIds.has(entry._id)}
                                onChange={() => toggleEntryInDivision(entry._id)}
                                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
                              />
                              <span className="text-sm text-zinc-900 dark:text-zinc-100">
                                {entry.sail_number}
                                {entry.name ? ` — ${entry.name}` : ""}
                              </span>
                            </label>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedEntryIds.size} of {drawerEntries.length} selected
                    {entrySearchQuery.trim() && ` (${filteredDrawerEntries.length} match search)`}
                  </p>
                </div>
              )}

              {drawerOpen && drawerEntries.length === 0 && (
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                  No entries for this event yet. Add entries on the Entries page first.
                </p>
              )}

              <div className="mt-auto flex shrink-0 gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {submitting ? "Saving…" : editingDivisionId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
