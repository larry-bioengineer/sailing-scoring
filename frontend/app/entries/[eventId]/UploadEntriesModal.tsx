"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import { createEntry, deleteEntry, type Entry } from "@/lib/api";
import { parseCsv } from "@/lib/csv";

const PREVIEW_ROWS = 10;
const CSV_ACCEPT = ".csv,text/csv,application/csv";

function normalizeSail(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

export type UploadEntriesModalProps = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  existingEntries: Entry[];
  onImported: () => void;
};

export function UploadEntriesModal({
  open,
  onClose,
  eventId,
  existingEntries,
  onImported,
}: UploadEntriesModalProps) {
  const [parsedRows, setParsedRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [sailColumnIndex, setSailColumnIndex] = useState(0);
  const [nameColumnIndex, setNameColumnIndex] = useState(-1); // -1 = None
  const [confirmedOverride, setConfirmedOverride] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = parsedRows?.[0] ?? [];
  const dataRows = parsedRows ? parsedRows.slice(1) : [];
  const hasMapping = headers.length > 0;

  const resetState = useCallback(() => {
    setParsedRows(null);
    setFileName(null);
    setParseError(null);
    setSailColumnIndex(0);
    setNameColumnIndex(-1);
    setConfirmedOverride(false);
    setImporting(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const readFile = useCallback((file: File) => {
    setParseError(null);
    setError(null);
    const name = file.name.toLowerCase();
    const type = (file.type ?? "").toLowerCase();
    const isCsv =
      name.endsWith(".csv") ||
      type === "text/csv" ||
      type === "application/csv";
    if (!isCsv) {
      setParseError("Please upload a CSV file.");
      setParsedRows(null);
      setFileName(null);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseCsv(text);
        if (rows.length === 0) {
          setParseError("CSV file is empty.");
          setParsedRows(null);
          return;
        }
        setParsedRows(rows);
        setSailColumnIndex(0);
        setNameColumnIndex((rows[0]?.length ?? 0) > 1 ? 1 : -1);
      } catch {
        setParseError("Could not parse CSV.");
        setParsedRows(null);
      }
    };
    reader.onerror = () => {
      setParseError("Could not read file.");
      setParsedRows(null);
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) readFile(file);
      e.target.value = "";
    },
    [readFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (file) readFile(file);
    },
    [readFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Strip leading/trailing whitespace from mapped values so accidental spaces are not stored
  const mappedRows = dataRows.map((row) => {
    const rawSail = sailColumnIndex >= 0 && sailColumnIndex < row.length ? row[sailColumnIndex] ?? "" : "";
    const rawName = nameColumnIndex >= 0 && nameColumnIndex < row.length ? row[nameColumnIndex] ?? "" : "";
    const sail = typeof rawSail === "string" ? rawSail.trim() : "";
    const name = typeof rawName === "string" ? rawName.trim() : "";
    return { sail_number: sail, name };
  }).filter((r) => r.sail_number !== "");

  const duplicateSailError = (() => {
    const seen = new Set<string>();
    for (const r of mappedRows) {
      const norm = normalizeSail(r.sail_number);
      if (seen.has(norm)) return "CSV contains duplicate sail numbers.";
      seen.add(norm);
    }
    return null;
  })();

  const previewRows = mappedRows.slice(0, PREVIEW_ROWS);
  const canImport =
    hasMapping &&
    mappedRows.length > 0 &&
    sailColumnIndex >= 0 &&
    confirmedOverride &&
    !duplicateSailError &&
    !importing;

  const handleImport = async () => {
    if (!canImport || !eventId) return;
    setError(null);
    setImporting(true);
    try {
      for (const entry of existingEntries) {
        await deleteEntry(entry._id);
      }
      for (const row of mappedRows) {
        await createEntry({
          event_id: eventId,
          sail_number: row.sail_number.trim(), // trim again at save time (values already trimmed when mapping)
          name: (row.name || "").trim() || undefined,
        });
      }
      onImported();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-zinc-950/80"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-xl border border-zinc-200 bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:border-zinc-800 dark:bg-zinc-950 sm:my-8 sm:w-full sm:max-w-2xl sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <DialogTitle
              as="h2"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Import entries from CSV
            </DialogTitle>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Upload a CSV file and map columns to Sail number and Name. Leading and trailing spaces in cells are removed automatically. Importing will replace all existing entries for this event.
            </p>

            {/* Drop zone */}
            <div className="mt-4">
              <label
                htmlFor="upload-entries-csv"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50/50 py-8 px-4 cursor-pointer hover:border-zinc-400 hover:bg-zinc-100/50 dark:border-zinc-600 dark:bg-zinc-800/50 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <DocumentArrowUpIcon className="mx-auto size-10 text-zinc-400 dark:text-zinc-500" aria-hidden />
                <span className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Drop CSV here or click to choose
                </span>
                <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  CSV only
                </span>
                <input
                  id="upload-entries-csv"
                  type="file"
                  accept={CSV_ACCEPT}
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
              {fileName && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  File: {fileName}
                </p>
              )}
              {parseError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {parseError}
                </p>
              )}
            </div>

            {/* Column mapping */}
            {hasMapping && (
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                  Sail number (required)
                  <select
                    value={sailColumnIndex}
                    onChange={(e) => setSailColumnIndex(Number(e.target.value))}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                  Name
                  <select
                    value={nameColumnIndex}
                    onChange={(e) => setNameColumnIndex(Number(e.target.value))}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    <option value={-1}>— None —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* Preview table */}
            {mappedRows.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Preview — showing {previewRows.length} of {mappedRows.length} rows
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-50">Sail number</th>
                        <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-50">Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="bg-white dark:bg-zinc-950">
                          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-50">{row.sail_number}</td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{row.name || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Warning and confirmation */}
            {hasMapping && mappedRows.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Importing will replace all existing entries for this event with the data from this file. This cannot be undone.
                </p>
                {existingEntries.length > 0 && (
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    You currently have {existingEntries.length} entries; they will all be removed and replaced by {mappedRows.length} rows from the CSV.
                  </p>
                )}
                <label className="mt-3 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedOverride}
                    onChange={(e) => setConfirmedOverride(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                  <span className="text-sm text-amber-800 dark:text-amber-200">
                    I understand that existing entries will be replaced
                  </span>
                </label>
              </div>
            )}

            {duplicateSailError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {duplicateSailError}
              </p>
            )}
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3 sm:mt-6">
              <button
                type="button"
                onClick={handleImport}
                disabled={!canImport}
                className="cursor-pointer inline-flex justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {importing ? "Importing…" : "Import"}
              </button>
              <button
                type="button"
                data-autofocus
                onClick={handleClose}
                disabled={importing}
                className="cursor-pointer inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-xs ring-1 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50"
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
