"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { updateRace, type Race, type Division } from "@/lib/api";

/** Ensure time string is HH:MM:SS (e.g. "12:00" -> "12:00:00"). */
function normalizeTimeToHHMMSS(t: string): string {
  const s = (t ?? "").trim();
  if (!s) return "12:00:00";
  const parts = s.split(":");
  if (parts.length === 3) return s;
  if (parts.length === 2) return `${s}:00`;
  return s.length <= 5 ? `${s}:00` : s;
}

export type EditStartModalProps = {
  open: boolean;
  onClose: () => void;
  race: Race | null;
  divisions: Division[];
  onSaved: () => void;
};

export function EditStartModal({
  open,
  onClose,
  race,
  divisions,
  onSaved,
}: EditStartModalProps) {
  const [divisionId, setDivisionId] = useState("");
  const [course, setCourse] = useState("");
  const [raceId, setRaceId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [finishWindowMinutes, setFinishWindowMinutes] = useState(30);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (race) {
      setDivisionId(race.division_id ?? "");
      setCourse(race.course ?? "");
      setRaceId(race.race_id ?? "");
      setDate(race.date ?? new Date().toISOString().slice(0, 10));
      setStartTime(normalizeTimeToHHMMSS(race.start_time ?? "12:00:00"));
      setFinishWindowMinutes(
        typeof race.finish_window_minutes === "number" && race.finish_window_minutes >= 0
          ? race.finish_window_minutes
          : 30
      );
      setNotes(race.notes ?? "");
    }
  }, [race, open]);

  const finishWindowValid =
    Number.isInteger(finishWindowMinutes) && finishWindowMinutes >= 0;
  const canSubmit =
    divisionId.trim() !== "" &&
    raceId.trim() !== "" &&
    date.trim() !== "" &&
    startTime.trim() !== "" &&
    finishWindowValid &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !race) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateRace(race._id, {
        division_id: divisionId.trim(),
        race_id: raceId.trim(),
        date: date.trim(),
        start_time: startTime.trim(),
        finish_window_minutes: finishWindowMinutes,
        course: course.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update start");
    } finally {
      setSubmitting(false);
    }
  };

  if (!race) return null;

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
              Edit start
            </DialogTitle>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Update division, race number, date and start time.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="edit-start-division"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Division <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-start-division"
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
                  htmlFor="edit-start-race-id"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Race No <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-start-race-id"
                  type="text"
                  required
                  value={raceId}
                  onChange={(e) => setRaceId(e.target.value)}
                  placeholder="e.g. 1"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-start-date"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Date
                </label>
                <input
                  id="edit-start-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-start-time"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Start time
                </label>
                <input
                  id="edit-start-time"
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
                  htmlFor="edit-start-course"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Course
                </label>
                <input
                  id="edit-start-course"
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. Triangle, Windward-Leeward"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-start-finish-window"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Finish window (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-start-finish-window"
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

              <div>
                <label
                  htmlFor="edit-start-notes"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Notes
                </label>
                <input
                  id="edit-start-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
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
                  {submitting ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
