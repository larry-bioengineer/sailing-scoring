"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getResultCsv, getDivisions, type Division } from "@/lib/api";

/** Trigger download of text as a CSV file. */
function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse CSV string into rows of cells (handles \r\n and trims). */
function parseCsv(csv: string): string[][] {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
}

function ResultTable({ csv }: { csv: string }) {
  const rows = parseCsv(csv);
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full min-w-[600px] text-left text-sm text-zinc-800 dark:text-zinc-200">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
            {header.map((cell, i) => (
              <th
                key={i}
                className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ResultEventPage() {
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const [divisions, setDivisions] = useState<Division[]>([]);
  /** Empty string = "All"; otherwise division _id */
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("");
  const [csv, setCsv] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    getDivisions(eventId)
      .then(setDivisions)
      .catch(() => setDivisions([]));
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    const divisionId =
      selectedDivisionId != null && selectedDivisionId !== ""
        ? selectedDivisionId
        : undefined;
    getResultCsv(eventId, divisionId)
      .then(setCsv)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load result");
        setCsv(null);
      })
      .finally(() => setLoading(false));
  }, [eventId, selectedDivisionId]);

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

      {(divisions.length > 0 || selectedDivisionId !== "" || csv) ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
          {(divisions.length > 0 || selectedDivisionId !== "") && (
            <>
              <label
                htmlFor="division-select"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Division:
              </label>
              <select
                id="division-select"
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">All entries</option>
                {divisions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {selectedDivisionId === ""
                  ? "Showing result for: All"
                  : `Showing result for: ${
                      divisions.find((d) => d._id === selectedDivisionId)?.name ?? "—"
                    }`}
              </span>
            </>
          )}
          {csv && (
            <button
              type="button"
              onClick={() => {
                const divisionName =
                  selectedDivisionId !== ""
                    ? divisions.find((d) => d._id === selectedDivisionId)?.name ?? "division"
                    : "all";
                const safeName = divisionName.replace(/[^a-zA-Z0-9-_]/g, "-");
                downloadCsv(csv, `result-event-${eventId}-${safeName}.csv`);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 1 0-1.09-1.03l-2.955 3.129V2.75Z" />
                <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
              </svg>
              Download as CSV
            </button>
          )}
        </div>
      ) : null}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : error ? (
        <p className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      ) : csv ? (
        <ResultTable csv={csv} />
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
