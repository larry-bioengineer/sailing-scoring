"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEvents, discardSummary, type Event } from "@/lib/api";

export default function ResultsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getEvents()
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="py-8 px-0 sm:px-8 lg:px-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Results
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          View and export results by event. Click an event to see its CSV result.
        </p>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <p className="p-6 text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : events.length === 0 ? (
          <p className="p-6 text-zinc-500 dark:text-zinc-400">
            No events. Create an event first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    Event name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    Discard
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    Actions
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
                      {ev.name?.trim() || "—"}
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
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <Link
                        href={`/results/${ev.id}`}
                        className="font-medium text-zinc-900 underline dark:text-zinc-50"
                      >
                        View result
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
