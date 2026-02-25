"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getEvents, discardSummary, type Event } from "@/lib/api";

export default function RecordPage() {
  const router = useRouter();
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
          Record
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Select an event to view and manage its race records and finishes.
        </p>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <p className="p-6 text-zinc-500 dark:text-zinc-400">Loading…</p>
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
                    Scoring
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                    >
                      No events yet. Create an event on the Events page first.
                    </td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr
                      key={ev.id}
                      onClick={() => router.push(`/record/${ev.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/record/${ev.id}`);
                        }
                      }}
                      className="cursor-pointer bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {ev.name?.trim() || "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {discardSummary(ev.discard?.length ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          View records →
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
