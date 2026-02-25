"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { discardSummary } from "@/lib/api";

const DRAWER_TRANSITION_MS = 200;

export interface EventDrawerProps {
  open: boolean;
  entered: boolean;
  editingEventId: string | null;
  eventName: string;
  onEventNameChange: (value: string) => void;
  onClose: () => void;
  onTransitionEnd: (e: React.TransitionEvent) => void;
  discardInputs: string[];
  onUpdateDiscardInput: (index: number, value: string) => void;
  onAddDiscardRowOnEnter: (index: number) => void;
  onRemoveDiscardRow: (index: number) => void;
  lastDiscardInputRef: React.RefObject<HTMLInputElement | null>;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function EventDrawer({
  open,
  entered,
  editingEventId,
  eventName,
  onEventNameChange,
  onClose,
  onTransitionEnd,
  discardInputs,
  onUpdateDiscardInput,
  onAddDiscardRowOnEnter,
  onRemoveDiscardRow,
  lastDiscardInputRef,
  error,
  submitting,
  onSubmit,
}: EventDrawerProps) {
  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ease-out ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: `${DRAWER_TRANSITION_MS}ms` }}
        aria-hidden
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950 ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ transitionDuration: `${DRAWER_TRANSITION_MS}ms` }}
        onTransitionEnd={onTransitionEnd}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {editingEventId ? "Edit event" : "Add event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 cursor-pointer"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div>
              <label htmlFor="event-name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Event name
              </label>
              <input
                type="text"
                id="event-name"
                value={eventName}
                onChange={(e) => onEventNameChange(e.target.value)}
                placeholder="e.g. Spring Regatta 2025"
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                aria-label="Event name"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Discard
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Enter a number and press Enter to add the next row. Values must
                go from small to big.
              </p>
              <div className="mt-2 space-y-2">
                {discardInputs.map((value, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_auto] items-center gap-3"
                  >
                    <input
                      ref={
                        index === discardInputs.length - 1
                          ? lastDiscardInputRef
                          : undefined
                      }
                      type="number"
                      min={0}
                      value={value}
                      onChange={(e) => onUpdateDiscardInput(index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onAddDiscardRowOnEnter(index);
                        }
                      }}
                      placeholder={
                        index === discardInputs.length - 1 ? "e.g. 3" : ""
                      }
                      className="block w-24 rounded-md border border-zinc-300 bg-white px-2 py-2 text-left text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                      aria-label={`Discard ${index + 1}`}
                      id={`discard-${index}`}
                    />
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {discardSummary(index + 1)}
                      </span>
                      {discardInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveDiscardRow(index)}
                          className="w-6 h-6 cursor-pointer flex items-center justify-center shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                          aria-label={`Remove row ${index + 1}`}
                        >
                          <XMarkIcon className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {submitting ? "Saving…" : editingEventId ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
