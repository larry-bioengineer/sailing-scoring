"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import type { Finish, Entry } from "@/lib/api";

function normalizeSailNumber(s: string): string {
  return s.trim().replace(/\s+/g, "");
}

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

export type EditFinishModalProps = {
  open: boolean;
  onClose: () => void;
  finish: Finish | null;
  entries: Entry[];
  onSave: (payload: {
    sail_number: string;
    finish_time: string;
    rc_scoring?: string;
  }) => void;
  submitting: boolean;
};

export function EditFinishModal({
  open,
  onClose,
  finish,
  entries,
  onSave,
  submitting,
}: EditFinishModalProps) {
  const [sailNumber, setSailNumber] = useState("");
  const [finishTime, setFinishTime] = useState("");
  const [rcScoring, setRcScoring] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (finish) {
      setSailNumber(finish.sail_number);
      setFinishTime(finish.finish_time);
      setRcScoring(finish.rc_scoring ?? "");
      setValidationError(null);
    }
  }, [finish, open]);

  const validSailNumbersSet = new Set(
    entries.map((e) => normalizeSailNumber(e.sail_number))
  );
  const isSailInvalid =
    sailNumber.trim().length > 0 &&
    !validSailNumbersSet.has(normalizeSailNumber(sailNumber));
  const isTimeInvalid =
    finishTime.trim().length > 0 &&
    parseFinishTimeToSeconds(finishTime.trim()) === null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const sn = sailNumber.trim();
    const ft = finishTime.trim();
    if (!sn) {
      setValidationError("Sail number is required.");
      return;
    }
    if (!validSailNumbersSet.has(normalizeSailNumber(sn))) {
      setValidationError("Sail number must match an event entry.");
      return;
    }
    if (!ft) {
      setValidationError("Finish time is required (e.g. 10:02:00).");
      return;
    }
    if (parseFinishTimeToSeconds(ft) === null) {
      setValidationError("Finish time must be H:MM:SS or HH:MM:SS.");
      return;
    }
    onSave({
      sail_number: sn,
      finish_time: ft,
      rc_scoring: rcScoring.trim(),
    });
  };

  if (!finish) return null;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-zinc-950/80"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-left sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-xl border border-zinc-200 bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:border-zinc-800 dark:bg-zinc-950 sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <DialogTitle
              as="h3"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Edit finish record
            </DialogTitle>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Update sail number, finish time, or score by RC.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {validationError && (
                <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {validationError}
                </p>
              )}
              <div>
                <label
                  htmlFor="edit-sail"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Sail #
                </label>
                <input
                  id="edit-sail"
                  type="text"
                  value={sailNumber}
                  onChange={(e) => setSailNumber(e.target.value)}
                  className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:text-zinc-50 ${
                    isSailInvalid
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/50"
                      : "border-zinc-300 focus:border-indigo-500 focus:ring-indigo-500/50 dark:border-zinc-600"
                  }`}
                  placeholder="e.g. 1"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-time"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Finish time
                </label>
                <input
                  id="edit-time"
                  type="text"
                  value={finishTime}
                  onChange={(e) => setFinishTime(e.target.value)}
                  className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:text-zinc-50 ${
                    isTimeInvalid
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/50"
                      : "border-zinc-300 focus:border-indigo-500 focus:ring-indigo-500/50 dark:border-zinc-600"
                  }`}
                  placeholder="e.g. 10:02:00"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-rc"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Score By RC (optional)
                </label>
                <input
                  id="edit-rc"
                  type="text"
                  value={rcScoring}
                  onChange={(e) => setRcScoring(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  placeholder="OCS, DNF, DSQ — leave empty to clear"
                />
              </div>
              <div className="mt-5 flex justify-end gap-3 sm:mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="cursor-pointer rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
