"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getRaces,
  getDivisions,
  getFinishes,
  getEntries,
  getEvent,
  deleteRace,
  type Race,
  type Division,
  type Finish,
  type Entry,
} from "@/lib/api";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { AddStartModal } from "./AddStartModal";
import { EditStartModal } from "./EditStartModal";

export default function RecordEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";

  const [eventName, setEventName] = useState<string>("");
  const [races, setRaces] = useState<Race[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addStartOpen, setAddStartOpen] = useState(false);
  const [raceToEdit, setRaceToEdit] = useState<Race | null>(null);

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [event, racesData, divisionsData, finishesData, entriesData] =
        await Promise.all([
          getEvent(eventId),
          getRaces(eventId),
          getDivisions(eventId),
          getFinishes(undefined, eventId),
          getEntries(eventId),
        ]);
      setEventName(event.name?.trim() ?? "");
      setRaces(racesData);
      setDivisions(divisionsData);
      setFinishes(finishesData);
      setEntries(entriesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const divisionNameById = new Map<string, string>(
    divisions.map((d) => [d._id, d.name])
  );

  const entryBySail = new Map<string, Entry>(
    entries.map((e) => [e.sail_number.trim().toLowerCase(), e])
  );

  const finishRows = finishes.map((f) => {
    const entry = entryBySail.get((f.sail_number || "").trim().toLowerCase());
    const divisionNames = (entry?.division_ids ?? [])
      .map((id) => divisionNameById.get(id) ?? id)
      .filter(Boolean);
    const divisionsDisplay =
      divisionNames.length > 0 ? divisionNames.join(", ") : "—";
    return {
      sail_number: f.sail_number,
      divisions: divisionsDisplay,
      race_id: f.race_id,
      finish_time: f.finish_time,
      rc_scoring: f.rc_scoring ?? "—",
    };
  });

  const noDivisions = divisions.length === 0;

  const handleDeleteRace = async (r: Race) => {
    if (!confirm("Delete this race? All finish records for this race will be removed.")) return;
    try {
      await deleteRace(r._id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete race");
    }
  };

  return (
    <div className="py-8 px-0 sm:px-8 lg:px-10">
      <header className="mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/record"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            ← Record
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {eventName || "Record"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Starts and finishes for this event.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : (
        <div className="space-y-10">
          {/* Start table */}
          <section>
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Start
              </h2>
              {noDivisions ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Create a division on the Divisions page first to add a start.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddStartOpen(true)}
                  className="cursor-pointer inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Add start
                </button>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Division
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Race No
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Start Time
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Finish window
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {races.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                        >
                          No starts yet. Add a start to record race times.
                        </td>
                      </tr>
                    ) : (
                      races.map((r) => (
                        <tr
                          key={r._id}
                          className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                            {r.division_id
                              ? divisionNameById.get(r.division_id) ?? "—"
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                            {r.race_id}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {r.date ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {r.start_time}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {typeof r.finish_window_minutes === "number"
                              ? `${r.finish_window_minutes} min`
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setRaceToEdit(r)}
                                title="Edit"
                                aria-label="Edit"
                                className="cursor-pointer rounded-lg border border-zinc-300 bg-white p-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                              >
                                <PencilSquareIcon className="size-5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRace(r)}
                                title="Delete"
                                aria-label="Delete"
                                className="cursor-pointer rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                              >
                                <TrashIcon className="size-5" aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Finish table */}
          <section>
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Finish
              </h2>
              <button
                type="button"
                onClick={() => router.push(`/record/${eventId}/finish`)}
                className="cursor-pointer inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Edit / Enter data
              </button>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Sail No.
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Divisions
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Race No
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Date Time
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                      >
                        Score by RC
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {finishRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                        >
                          No finishes yet. Use &quot;Edit / Enter data&quot; to add
                          finish records.
                        </td>
                      </tr>
                    ) : (
                      finishRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                            {row.sail_number}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.divisions}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.race_id}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.finish_time}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.rc_scoring}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      <AddStartModal
        open={addStartOpen}
        onClose={() => setAddStartOpen(false)}
        eventId={eventId}
        divisions={divisions}
        existingRaces={races}
        onAdded={load}
      />
      <EditStartModal
        open={raceToEdit !== null}
        onClose={() => setRaceToEdit(null)}
        race={raceToEdit}
        divisions={divisions}
        onSaved={load}
      />
    </div>
  );
}
