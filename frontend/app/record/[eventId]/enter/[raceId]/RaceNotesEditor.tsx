"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowPathIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { updateRace } from "@/lib/api";

export type RaceNotesEditorProps = {
  raceMongoId: string;
  initialNotes: string;
  onSaved?: () => void;
};

export function RaceNotesEditor({
  raceMongoId,
  initialNotes,
  onSaved,
}: RaceNotesEditorProps) {
  const [value, setValue] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(initialNotes);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(initialNotes);
    lastSavedRef.current = initialNotes;
  }, [initialNotes]);

  useEffect(() => {
    if (value === lastSavedRef.current) return;
    const t = setTimeout(() => {
      setError(null);
      setSaving(true);
      updateRace(raceMongoId, { notes: value })
        .then(() => {
          lastSavedRef.current = value;
          setSaved(true);
          onSaved?.();
          if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
          savedTimeoutRef.current = setTimeout(() => {
            setSaved(false);
            savedTimeoutRef.current = null;
          }, 2000);
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Failed to save notes");
        })
        .finally(() => {
          setSaving(false);
        });
    }, 700);
    return () => clearTimeout(t);
  }, [value, raceMongoId]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notes
        </span>
        <span className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          {saving && (
            <>
              <ArrowPathIcon
                aria-hidden
                className="size-4 animate-spin"
              />
              <span>Saving…</span>
            </>
          )}
          {saved && !saving && (
            <>
              <CheckCircleIcon
                aria-hidden
                className="size-4 text-green-600 dark:text-green-400"
              />
              <span>Saved</span>
            </>
          )}
        </span>
      </div>
      <div className="p-6">
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}
        <textarea
          rows={30}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add notes for this race…"
          className="w-full resize-y rounded-lg  bg-white  text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          aria-label="Race notes"
        />
      </div>
    </div>
  );
}
