"use client";

import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

const FORMAT_HINT =
  "Please use HH:MM:SS (e.g. 14:00:00), HH:MM (e.g. 14:00), 4 digits (e.g. 1400), or 6 digits (e.g. 140000).";

function isValidTime(h: number, m: number, s: number): boolean {
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
}

function formatStartTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already HH:MM:SS
  const fullMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (fullMatch) {
    const [, h, m, s] = fullMatch.map(Number);
    if (isValidTime(h, m, s)) return trimmed;
    return null;
  }

  // HH:MM → HH:MM:00
  const shortMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (shortMatch) {
    const [, h, m] = shortMatch.map(Number);
    if (isValidTime(h, m, 0))
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    return null;
  }

  // 6 digits: 140000 → 14:00:00
  if (/^\d{6}$/.test(trimmed)) {
    const h = Number(trimmed.slice(0, 2));
    const m = Number(trimmed.slice(2, 4));
    const s = Number(trimmed.slice(4, 6));
    if (isValidTime(h, m, s))
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return null;
  }

  // 4 digits: 1400 → 14:00:00
  if (/^\d{4}$/.test(trimmed)) {
    const h = Number(trimmed.slice(0, 2));
    const m = Number(trimmed.slice(2, 4));
    if (isValidTime(h, m, 0))
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    return null;
  }

  // 3 digits: 930 → 09:30:00
  if (/^\d{3}$/.test(trimmed)) {
    const h = Number(trimmed.slice(0, 1));
    const m = Number(trimmed.slice(1, 3));
    if (isValidTime(h, m, 0))
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    return null;
  }

  return null;
}

export type CreateRaceModalProps = {
  open: boolean;
  onClose: () => void;
  raceId: string;
  onRaceIdChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  /** When provided, modal shows as "Edit race" with Update button instead of Create. */
  title?: string;
  submitLabel?: string;
  submittingLabel?: string;
};

export function CreateRaceModal({
  open,
  onClose,
  raceId,
  onRaceIdChange,
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  error,
  submitting,
  onSubmit,
  title: titleProp,
  submitLabel: submitLabelProp,
  submittingLabel: submittingLabelProp,
}: CreateRaceModalProps) {
  const title = titleProp ?? "Create race";
  const submitLabel = submitLabelProp ?? "Create race";
  const submittingLabel = submittingLabelProp ?? "Creating…";
  const [formatError, setFormatError] = useState<string | null>(null);

  const handleStartTimeBlur = () => {
    const trimmed = startTime.trim();
    if (!trimmed) {
      setFormatError(null);
      return;
    }
    const formatted = formatStartTime(startTime);
    if (formatted !== null) {
      onStartTimeChange(formatted);
      setFormatError(null);
    } else {
      setFormatError(FORMAT_HINT);
      alert(FORMAT_HINT);
    }
  };

  const handleStartTimeChange = (value: string) => {
    setFormatError(null);
    onStartTimeChange(value);
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
            className="relative transform overflow-hidden rounded-xl border border-zinc-200 bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:border-zinc-800 dark:bg-zinc-950 sm:my-8 sm:w-full sm:max-w-md sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <div>
              <DialogTitle
                as="h2"
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
              >
                {title}
              </DialogTitle>
              {error && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}
              <form
                onSubmit={onSubmit}
                className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                  Race ID
                  <input
                    type="text"
                    value={raceId}
                    onChange={(e) => onRaceIdChange(e.target.value)}
                    placeholder="e.g. 1"
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                  Date
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                  Start time
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    onBlur={handleStartTimeBlur}
                    placeholder="e.g. 10:00:00, 10:00, 1400, or 140000"
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  {formatError && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {formatError}
                    </p>
                  )}
                </label>
                <div className="flex gap-2 sm:ml-auto">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {submitting ? submittingLabel : submitLabel}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
