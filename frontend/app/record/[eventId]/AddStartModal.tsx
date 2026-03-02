"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { createRace, type Race, type Division } from "@/lib/api";

export type AddStartModalProps = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  divisions: Division[];
  existingRaces: Race[];
  onAdded: () => void;
};

function nextRaceId(races: Race[]): string {
  if (races.length === 0) return "1";
  let max = 0;
  for (const r of races) {
    const n = parseInt(r.race_id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

export function AddStartModal({
  open,
  onClose,
  eventId,
  divisions,
  existingRaces,
  onAdded,
}: AddStartModalProps) {
  const [divisionId, setDivisionId] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState("12:00:00");
  const [finishWindowMinutes, setFinishWindowMinutes] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextId = useMemo(() => nextRaceId(existingRaces), [existingRaces]);
  const finishWindowValid =
    Number.isInteger(finishWindowMinutes) && finishWindowMinutes >= 0;
  const canSubmit =
    divisionId.trim() !== "" &&
    date.trim() !== "" &&
    startTime.trim() !== "" &&
    finishWindowValid &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await createRace({
        event_id: eventId,
        race_id: nextId,
        start_time: startTime.trim(),
        date: date.trim(),
        division_id: divisionId.trim(),
        finish_window_minutes: finishWindowMinutes,
      });
      onAdded();
      onClose();
      setDivisionId("");
      setDate(new Date().toISOString().slice(0, 10));
      setStartTime("12:00:00");
      setFinishWindowMinutes(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add start");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-zinc-950/80"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-xl border border-zinc-200 bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:border-zinc-800 dark:bg-zinc-950 sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <DialogTitle
              as="h2"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Add start
            </DialogTitle>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Record a new race start. Race No will be {nextId}.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="add-start-division"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Division <span className="text-red-500">*</span>
                </label>
                <select
                  id="add-start-division"
                  required
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
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

              <div>
                <label
                  htmlFor="add-start-date"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Date
                </label>
                <input
                  id="add-start-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="add-start-time"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Start time
                </label>
                <input
                  id="add-start-time"
                  type="time"
                  step="1"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="add-start-finish-window"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Finish window (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  id="add-start-finish-window"
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={finishWindowMinutes}
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = v === "" ? NaN : parseInt(v, 10);
                    setFinishWindowMinutes(Number.isNaN(n) ? 0 : Math.max(0, n));
                  }}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Minutes allowed to finish after the first boat crosses the line.
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {submitting ? "Adding…" : "Add start"}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
