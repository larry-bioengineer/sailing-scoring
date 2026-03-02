"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  getRaces,
  getFinishes,
  createRace,
  updateRace,
  deleteRace,
  type Race,
  type Finish,
} from "@/lib/api";
import { CreateRaceModal } from "./CreateRaceModal";
import { DeleteRaceModal } from "./DeleteRaceModal";

export default function RecordEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const [races, setRaces] = useState<Race[]>([]);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [finishesLoading, setFinishesLoading] = useState(false);
  const today = () => new Date().toISOString().slice(0, 10);
  const [createRaceOpen, setCreateRaceOpen] = useState(false);
  const [newRaceId, setNewRaceId] = useState("");
  const [newDate, setNewDate] = useState(() => today());
  const [newStartTime, setNewStartTime] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [raceToDelete, setRaceToDelete] = useState<Race | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [raceToEdit, setRaceToEdit] = useState<Race | null>(null);
  const [editRaceId, setEditRaceId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const loadRaces = () => {
    if (!eventId) return;
    setLoading(true);
    getRaces(eventId)
      .then((data) => {
        setRaces(data);
        setSelectedRace(null);
      })
      .catch(() => setRaces([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRaces();
  }, [eventId]);

  const handleCreateRace = async (e: React.FormEvent) => {
    e.preventDefault();
    const raceId = newRaceId.trim();
    const date = newDate.trim();
    const startTime = newStartTime.trim();
    if (!raceId || !date || !startTime) {
      setCreateError("Race ID, date, and start time are required.");
      return;
    }
    setCreateError(null);
    setCreateSubmitting(true);
    try {
      await createRace({ event_id: eventId, race_id: raceId, start_time: startTime, date });
      setNewRaceId("");
      setNewDate(today());
      setNewStartTime("");
      setCreateRaceOpen(false);
      loadRaces();
      router.push(`/record/${eventId}/enter/${encodeURIComponent(raceId)}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create race");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleDeleteRace = async () => {
    if (!raceToDelete) return;
    setDeleteSubmitting(true);
    try {
      await deleteRace(raceToDelete._id);
      if (selectedRace?._id === raceToDelete._id) setSelectedRace(null);
      setRaceToDelete(null);
      loadRaces();
    } catch {
      // Keep modal open; user can retry or cancel
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openEditRace = (race: Race) => {
    setRaceToEdit(race);
    setEditRaceId(race.race_id);
    setEditDate(race.date ?? today());
    setEditStartTime(race.start_time);
    setEditError(null);
  };

  const handleUpdateRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raceToEdit) return;
    const raceId = editRaceId.trim();
    const date = editDate.trim();
    const startTime = editStartTime.trim();
    if (!raceId || !date || !startTime) {
      setEditError("Race ID, date, and start time are required.");
      return;
    }
    setEditError(null);
    setEditSubmitting(true);
    try {
      const updated = await updateRace(raceToEdit._id, {
        race_id: raceId,
        start_time: startTime,
        date,
      });
      setRaceToEdit(null);
      loadRaces();
      if (selectedRace?._id === raceToEdit._id) {
        setSelectedRace({
          ...selectedRace,
          race_id: updated.race_id,
          start_time: updated.start_time,
          date: updated.date,
        });
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update race");
    } finally {
      setEditSubmitting(false);
    }
  };

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

  if (!eventId) {
    return (
      <div className="py-8 px-0 sm:px-8 lg:px-10">
        <p className="text-zinc-500 dark:text-zinc-400">Invalid event.</p>
        <Link href="/record" className="mt-4 inline-block text-sm underline">
          Back to Record
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 px-0 sm:px-8 lg:px-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <nav className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/record" className="hover:underline">
              Record
            </Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-700 dark:text-zinc-300">
              Event {eventId}
            </span>
          </nav>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Records — {eventId}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create a race, then enter finish data for that race.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateRaceOpen((prev) => !prev);
            if (!createRaceOpen) setNewDate(today());
            setCreateError(null);
          }}
          className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Create race
        </button>
      </header>

      <CreateRaceModal
        open={createRaceOpen}
        onClose={() => {
          setCreateRaceOpen(false);
          setCreateError(null);
        }}
        raceId={newRaceId}
        onRaceIdChange={setNewRaceId}
        date={newDate}
        onDateChange={setNewDate}
        startTime={newStartTime}
        onStartTimeChange={setNewStartTime}
        error={createError}
        submitting={createSubmitting}
        onSubmit={handleCreateRace}
      />

      <DeleteRaceModal
        open={raceToDelete !== null}
        onClose={() => !deleteSubmitting && setRaceToDelete(null)}
        raceId={raceToDelete?.race_id ?? ""}
        onConfirm={handleDeleteRace}
        submitting={deleteSubmitting}
      />

      <CreateRaceModal
        open={raceToEdit !== null}
        onClose={() => {
          if (!editSubmitting) setRaceToEdit(null);
        }}
        raceId={editRaceId}
        onRaceIdChange={setEditRaceId}
        date={editDate}
        onDateChange={setEditDate}
        startTime={editStartTime}
        onStartTimeChange={setEditStartTime}
        error={editError}
        submitting={editSubmitting}
        onSubmit={handleUpdateRace}
        title="Edit race"
        submitLabel="Update race"
        submittingLabel="Updating…"
      />

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead>
              <tr>
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
                  Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Start time
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
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    Loading…
                  </td>
                </tr>
              ) : races.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                  >
                    No races. Create a race above first.
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
                      {race.race_id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {race.date ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {race.start_time}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <span className="flex items-center justify-end gap-2">
                        <Link
                          href={`/record/${eventId}/enter/${encodeURIComponent(race.race_id)}`}
                          title="Enter finish data"
                          className="inline-flex cursor-pointer rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                        >
                          <ClipboardDocumentListIcon className="h-5 w-5" aria-hidden />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditRace(race)}
                          title="Edit race info (ID and start time)"
                          className="inline-flex cursor-pointer rounded p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                        >
                          <PencilSquareIcon className="h-5 w-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRaceToDelete(race)}
                          title="Remove race"
                          className="inline-flex cursor-pointer rounded p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                        >
                          <TrashIcon className="h-5 w-5" aria-hidden />
                        </button>
                      </span>
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
            Scores for race {selectedRace.race_id}
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
                      <td
                        colSpan={3}
                        className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400"
                      >
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
