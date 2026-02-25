"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export type DeleteEventModalProps = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  onConfirm: () => void;
  submitting: boolean;
};

export function DeleteEventModal({
  open,
  onClose,
  eventId,
  onConfirm,
  submitting,
}: DeleteEventModalProps) {
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
            <div>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <ExclamationTriangleIcon
                  aria-hidden="true"
                  className="size-6 text-red-600 dark:text-red-400"
                />
              </div>
              <div className="mt-3 text-center sm:mt-5">
                <DialogTitle
                  as="h3"
                  className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Delete event
                </DialogTitle>
                <div className="mt-2">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Are you sure you want to delete event <strong>{eventId}</strong>?
                    All entries, divisions, races, and finish data for this event
                    will be permanently deleted. This cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                onClick={onConfirm}
                disabled={submitting}
                className="cursor-pointer inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 sm:col-start-2"
              >
                {submitting ? "Deleting…" : "Delete event"}
              </button>
              <button
                type="button"
                data-autofocus
                onClick={onClose}
                disabled={submitting}
                className="cursor-pointer mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-xs ring-1 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:bg-zinc-800 sm:col-start-1 sm:mt-0 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
