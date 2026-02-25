"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

export type CreateRaceModalProps = {
  open: boolean;
  onClose: () => void;
  raceId: string;
  onRaceIdChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

export function CreateRaceModal({
  open,
  onClose,
  raceId,
  onRaceIdChange,
  startTime,
  onStartTimeChange,
  error,
  submitting,
  onSubmit,
}: CreateRaceModalProps) {
  const handleStartTimeBlur = () => {
    const trimmed = startTime.trim();
    if (!trimmed) return;
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      onStartTimeChange(`${trimmed}:00`);
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
            className="relative transform overflow-hidden rounded-xl border border-zinc-200 bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:border-zinc-800 dark:bg-zinc-950 sm:my-8 sm:w-full sm:max-w-md sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <div>
              <DialogTitle
                as="h2"
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
              >
                Create race
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
                  Start time
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => onStartTimeChange(e.target.value)}
                    onBlur={handleStartTimeBlur}
                    placeholder="e.g. 10:00:00 or 10:00"
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <div className="flex gap-2 sm:ml-auto">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {submitting ? "Creating…" : "Create race"}
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
