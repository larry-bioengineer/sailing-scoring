"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getResultCsv } from "@/lib/api";

export default function ResultEventPage() {
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const [csv, setCsv] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    getResultCsv(eventId)
      .then(setCsv)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load result");
        setCsv(null);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  if (!eventId) {
    return (
      <div className="py-8 px-6 sm:px-8 lg:px-10">
        <p className="text-zinc-500 dark:text-zinc-400">Invalid event.</p>
        <Link href="/results" className="mt-4 inline-block text-sm underline">
          ← Back to Results
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 sm:px-8 lg:px-10">
      <header className="mb-8">
        <nav className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/results" className="hover:underline">
            Results
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">Event {eventId}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Result CSV — Event {eventId}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Series result as CSV (RANK, Sail Number, Name, R1, R2, …, TOTAL, NET).
        </p>
      </header>

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : error ? (
        <p className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      ) : csv ? (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <pre className="overflow-x-auto p-6 text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-mono">
            {csv}
          </pre>
        </div>
      ) : null}

      <div className="mt-6">
        <Link
          href="/results"
          className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
        >
          ← Back to Results
        </Link>
      </div>
    </div>
  );
}
