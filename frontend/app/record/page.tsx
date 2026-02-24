"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEvents, getRaces, getFinishes, type Event, type Race, type Finish } from "@/lib/api";

export default function RecordPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [finishesLoading, setFinishesLoading] = useState(false);

  useEffect(() => {
    getEvents().then(setEvents).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const id = eventFilter === "" ? undefined : eventFilter;
    getRaces(id)
      .then((data) => {
        setRaces(data);
        if (selectedRace && !data.some((r) => r._id === selectedRace._id)) {
          setSelectedRace(null);
        }
      })
      .catch(() => setRaces([]))
      .finally(() => setLoading(false));
  }, [eventFilter]);

  useEffect(() => {
    if (!selectedRace) {
      setFinishes([]);
      return;
    }
    setFinishesLoading(true);
    getFinishes(selectedRace.race_id, undefined)
      .then(setFinishes)
      .catch(() => setFinishes([]))
      .finally(() => setFinishesLoading(false));
  }, [selectedRace?.race_id, selectedRace?._id]);

  return (
    <div className="py-8 px-6 sm:px-8 lg:px-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Record
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Record scores and data. Click a race to see finishes.
          </p>
        </div>
        <Link
          href="/record/enter"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Enter finish data
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <span>Event:</span>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Event ID
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Race ID
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Start time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Loading…
                  </td>
                </tr>
              ) : races.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                  >
                    No races. Create races for an event first.
                  </td>
                </tr>
              ) : (
                races.map((race) => (
                  <tr
                    key={race._id}
                    onClick={() => setSelectedRace(race)}
                    className={`cursor-pointer bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${
                      selectedRace?._id === race._id
                        ? "bg-zinc-100 dark:bg-zinc-800/50"
                        : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                      {String(race.event_id)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                      {race.race_id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {race.start_time}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRace && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Scores for race {selectedRace.race_id} (event {String(selectedRace.event_id)})
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                    >
                      Sail number
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                    >
                      Finish time
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                    >
                      rc_scoring
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {finishesLoading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                        Loading…
                      </td>
                    </tr>
                  ) : finishes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                      >
                        No finish data. Use “Enter finish data” to add.
                      </td>
                    </tr>
                  ) : (
                    finishes.map((f) => (
                      <tr
                        key={f._id}
                        className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                          {f.sail_number}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {f.finish_time}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {f.rc_scoring ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
