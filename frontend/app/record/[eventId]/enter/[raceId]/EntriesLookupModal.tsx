"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { getDivisions, type Entry, type Division } from "@/lib/api";

export type EntriesLookupModalProps = {
  open: boolean;
  onClose: () => void;
  entries: Entry[];
  eventId: string;
};

export function EntriesLookupModal({
  open,
  onClose,
  entries,
  eventId,
}: EntriesLookupModalProps) {
  const [search, setSearch] = useState("");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  useEffect(() => {
    if (!open || !eventId) return;
    setSearch("");
    setDivisionsLoading(true);
    getDivisions(eventId)
      .then(setDivisions)
      .catch(() => setDivisions([]))
      .finally(() => setDivisionsLoading(false));
  }, [open, eventId]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const sail = (e.sail_number ?? "").toLowerCase();
      const name = (e.name ?? "").toLowerCase();
      return sail.includes(q) || name.includes(q);
    });
  }, [entries, search]);

  const divisionNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of divisions) map.set(d._id, d.name);
    return map;
  }, [divisions]);

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
            className="relative transform overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:border-zinc-800 dark:bg-zinc-950 sm:my-8 sm:w-full sm:max-w-2xl sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <DialogTitle
              as="h3"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Event entries
            </DialogTitle>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sail number, divisions, and names. Use the search to filter by sail # or name.
            </p>

            <div className="mt-4">
              <label htmlFor="entries-search" className="sr-only">
                Search sail number and names
              </label>
              <div className="relative">
                <MagnifyingGlassIcon
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400"
                />
                <input
                  id="entries-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by sail # or name…"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                />
              </div>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              {divisionsLoading ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Loading…
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {entries.length === 0
                    ? "No entries for this event."
                    : "No entries match your search."}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                      >
                        Sail #
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                      >
                        Divisions
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                      >
                        Name
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredEntries.map((entry) => (
                      <tr
                        key={entry._id}
                        className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {entry.sail_number}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                          {(entry.division_ids ?? [])
                            .map((id) => divisionNames.get(id) ?? id)
                            .join(", ") || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                          {entry.name ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
