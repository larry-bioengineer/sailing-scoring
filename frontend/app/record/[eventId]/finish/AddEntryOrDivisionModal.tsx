"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { MultiSelect } from "react-multi-select-component";
import {
  createEntry,
  updateEntry,
  getDivisions,
  type Division,
  type Entry,
} from "@/lib/api";

type DivisionOption = { label: string; value: string };

export type AddEntryOrDivisionModalProps = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  sailNumber: string;
  existingEntry: Entry | null; // null = no entry; non-null = entry exists but may have no division_ids
  divisions: Division[];
  onSuccess: () => void;
};

export function AddEntryOrDivisionModal({
  open,
  onClose,
  eventId,
  sailNumber,
  existingEntry,
  divisions,
  onSuccess,
}: AddEntryOrDivisionModalProps) {
  const divisionOptions: DivisionOption[] = useMemo(
    () => divisions.map((d) => ({ label: d.name, value: d._id })),
    [divisions]
  );

  const [selectedOptions, setSelectedOptions] = useState<DivisionOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const ids = existingEntry?.division_ids ?? [];
      setSelectedOptions(
        ids
          .map((id) => divisionOptions.find((o) => o.value === id))
          .filter(Boolean) as DivisionOption[]
      );
      setError(null);
    }
  }, [open, existingEntry?.division_ids, divisions]);

  const isNoEntry = existingEntry == null;
  const divisionIds = selectedOptions.map((o) => o.value);
  const canSubmit = divisionIds.length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      if (isNoEntry) {
        await createEntry({
          event_id: eventId,
          sail_number: sailNumber.trim(),
          division_ids: divisionIds,
        });
      } else {
        await updateEntry(existingEntry._id, { division_ids: divisionIds });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
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
              {isNoEntry
                ? "Add sail number to entries"
                : "Assign division to entry"}
            </DialogTitle>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {isNoEntry
                ? "This sail number is not in the event entries. Add it with at least one division so you can record finishes."
                : "This entry has no division assigned. Assign at least one division so you can choose a race for the finish."}
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Sail No.
                </label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100 font-mono">
                  {sailNumber || "—"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Division(s) <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <MultiSelect
                    options={divisionOptions}
                    value={selectedOptions}
                    onChange={setSelectedOptions}
                    labelledBy="Select divisions"
                    overrideStrings={{
                      selectSomeItems: "Select division(s)...",
                      allItemsSelected: "All selected",
                      selectAll: "Select all",
                      search: "Search",
                    }}
                  />
                </div>
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
                  {submitting
                    ? "Saving…"
                    : isNoEntry
                      ? "Add to entries"
                      : "Assign division"}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
