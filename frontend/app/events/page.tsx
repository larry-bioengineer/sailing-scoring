"use client";

import { useEffect, useState, useRef } from "react";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { getEvents, createEvent, updateEvent, deleteEvent, discardSummary, type Event } from "@/lib/api";
import { EventDrawer } from "./EventDrawer";
import { DeleteEventModal } from "./DeleteEventModal";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** When set, drawer is in edit mode for this event id. */
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  /** When true, drawer panel/backdrop use "open" styles so transition runs on enter. */
  const [drawerEntered, setDrawerEntered] = useState(false);
  const drawerClosingRef = useRef(false);
  /** One string per row; last element is always the empty "next" row. */
  const [discardInputs, setDiscardInputs] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Success toast message; shown after save, auto-dismisses. */
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  /** Event selected for deletion; modal is open when non-null. */
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const lastDiscardInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  /** Run enter animation: paint closed state first, then open. */
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
    setEditingEventId(null);
  };

  const openAddDrawer = () => {
    setEditingEventId(null);
    setDiscardInputs([""]);
    setError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (ev: Event) => {
    setEditingEventId(ev.id);
    setDiscardInputs([...ev.discard.map(String), ""]);
    setError(null);
    setDrawerOpen(true);
  };

  const handleDrawerTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    if (drawerClosingRef.current) {
      setDrawerOpen(false);
      drawerClosingRef.current = false;
    }
  };

  /** Focus the last (empty) discard input when we add a new row. */
  useEffect(() => {
    if (drawerOpen) lastDiscardInputRef.current?.focus();
  }, [drawerOpen, discardInputs.length]);

  const updateDiscardInput = (index: number, value: string) => {
    setDiscardInputs((prev) =>
      prev.map((v, i) => (i === index ? value : v))
    );
    setError(null);
  };

  const addDiscardRowOnEnter = (index: number) => {
    if (index !== discardInputs.length - 1) return;
    const raw = discardInputs[index].trim();
    if (raw === "") return;
    const num = parseInt(raw, 10);
    if (Number.isNaN(num) || num < 0) {
      setError("Enter a valid non-negative integer.");
      return;
    }
    const prevValues = discardInputs.slice(0, -1).map((s) => parseInt(s.trim(), 10));
    const last = prevValues.length ? prevValues[prevValues.length - 1] : -1;
    if (num <= last) {
      setError(`Values must go from small to big. Next value must be greater than ${last}.`);
      return;
    }
    setError(null);
    setDiscardInputs((prev) => [...prev.slice(0, -1), raw, ""]);
  };

  const removeDiscardRow = (index: number) => {
    if (discardInputs.length <= 1) return;
    setDiscardInputs((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const getDiscardValues = (): number[] =>
    discardInputs
      .filter((s) => s.trim() !== "")
      .map((s) => parseInt(s.trim(), 10));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const discard = getDiscardValues();
      if (discard.some((n) => Number.isNaN(n))) {
        setError("Every value must be a valid non-negative integer.");
        setSubmitting(false);
        return;
      }
      for (let i = 1; i < discard.length; i++) {
        if (discard[i] <= discard[i - 1]) {
          setError("Values must go from small to big.");
          setSubmitting(false);
          return;
        }
      }
      if (editingEventId) {
        await updateEvent(editingEventId, { discard });
      } else {
        await createEvent({ discard });
      }
      setDrawerEntered(false);
      setDrawerOpen(false);
      setEditingEventId(null);
      setDiscardInputs([""]);
      await load();
      setSuccessMessage(editingEventId ? "Event updated." : "Event saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingEventId
            ? "Failed to update event"
            : "Failed to create event"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    setDeleteSubmitting(true);
    setError(null);
    try {
      await deleteEvent(eventToDelete.id);
      setEventToDelete(null);
      await load();
      setSuccessMessage("Event deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="py-8 px-0 sm:px-8 lg:px-10">
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

      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Events
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage and view events.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddDrawer}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add event
        </button>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <p className="p-6 text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : error && events.length === 0 ? (
          <p className="p-6 text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    Event ID (auto-generated)
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    Discard
                  </th>
                  <th
                    scope="col"
                    className="relative px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {events.map((ev) => (
                  <tr
                    key={ev.id}
                    className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                      {ev.id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {discardSummary(ev.discard.length)}
                      </span>
                      {ev.discard.length > 0 && (
                        <span className="ml-1 text-zinc-700 dark:text-zinc-300">
                          ({ev.discard.join(", ")})
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditDrawer(ev)}
                          aria-label={`Edit event ${ev.id}`}
                          className="cursor-pointer rounded-lg border border-zinc-300 bg-white p-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                        >
                          <PencilSquareIcon className="size-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventToDelete(ev)}
                          aria-label={`Delete event ${ev.id}`}
                          className="cursor-pointer rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                        >
                          <TrashIcon className="size-5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EventDrawer
        open={drawerOpen}
        entered={drawerEntered}
        editingEventId={editingEventId}
        onClose={closeDrawer}
        onTransitionEnd={handleDrawerTransitionEnd}
        discardInputs={discardInputs}
        onUpdateDiscardInput={updateDiscardInput}
        onAddDiscardRowOnEnter={addDiscardRowOnEnter}
        onRemoveDiscardRow={removeDiscardRow}
        lastDiscardInputRef={lastDiscardInputRef}
        error={error}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      <DeleteEventModal
        open={eventToDelete != null}
        onClose={() => setEventToDelete(null)}
        eventId={eventToDelete?.id ?? ""}
        onConfirm={handleConfirmDelete}
        submitting={deleteSubmitting}
      />
    </div>
  );
}
