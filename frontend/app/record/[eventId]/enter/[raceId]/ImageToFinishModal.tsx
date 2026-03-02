"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ArrowLeftIcon, ArrowPathIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";
import { extractSailNumbersFromImage } from "@/lib/api";
import type { Entry } from "@/lib/api";

function normalizeSailNumber(s: string): string {
  return s.trim().replace(/\s+/g, "");
}

const ACCEPT_IMAGE = "image/png,image/jpeg,image/webp";

export type ImageToFinishModalProps = {
  open: boolean;
  onClose: () => void;
  entries: Entry[];
  onAppend: (sailNumbers: string[]) => void;
  onReplace: (sailNumbers: string[]) => void;
};

export function ImageToFinishModal({
  open,
  onClose,
  entries,
  onAppend,
  onReplace,
}: ImageToFinishModalProps) {
  const [step, setStep] = useState<"upload" | "verify">("upload");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [extractedSailNumbers, setExtractedSailNumbers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  const validSailNumbersSet = new Set(
    entries.map((e) => normalizeSailNumber(e.sail_number))
  );

  const isSailInvalid = useCallback(
    (value: string) => {
      const n = normalizeSailNumber(value);
      return n.length > 0 && !validSailNumbersSet.has(n);
    },
    [validSailNumbersSet]
  );

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setStep("upload");
      setImageFile(null);
      setImagePreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
      setExtractedSailNumbers([]);
      setError(null);
      setZoom(1);
      setImageNaturalSize(null);
      setContainerSize(null);
    }
  }, [open]);

  // Clean up object URL on unmount or when URL changes
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const handleFile = useCallback(
    (file: File | null) => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
      }
      setImageFile(file);
      if (file) {
        setImagePreviewUrl(URL.createObjectURL(file));
      }
    },
    [imagePreviewUrl]
  );

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const runExtract = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await extractSailNumbersFromImage(dataUrl);
      setExtractedSailNumbers(result.sail_numbers ?? []);
      setStep("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to extract sail numbers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === "upload" && imageFile && !loading) {
      runExtract(imageFile);
    }
  }, [step, imageFile, loading, runExtract]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const updateSailNumber = useCallback((index: number, value: string) => {
    setExtractedSailNumbers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const removeSailNumber = useCallback((index: number) => {
    setExtractedSailNumbers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const applySailNumbers = useCallback(
    (mode: "append" | "replace") => {
      const list = extractedSailNumbers.filter((s) => s.trim().length > 0);
      if (mode === "append") {
        onAppend(list);
      } else {
        onReplace(list);
      }
      onClose();
    },
    [extractedSailNumbers, onAppend, onReplace, onClose]
  );

  const goBack = useCallback(() => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setStep("upload");
    setImageFile(null);
    setImagePreviewUrl(null);
    setExtractedSailNumbers([]);
    setError(null);
    setZoom(1);
    setImageNaturalSize(null);
    setContainerSize(null);
  }, [imagePreviewUrl]);

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.25;
  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  }, []);
  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  }, []);
  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (img && img.naturalWidth) {
      setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  // Track image container size for fit-to-container
  useEffect(() => {
    const el = imageContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {};
      if (width != null && height != null) setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  // Ctrl/Cmd + wheel to zoom (non-passive so we can preventDefault)
  useEffect(() => {
    const el = imageContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY < 0) setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
      else if (e.deltaY > 0) setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step]);

  const fittedSize =
    imageNaturalSize && containerSize
      ? (() => {
          const { w: cw, h: ch } = containerSize;
          const { w: iw, h: ih } = imageNaturalSize;
          const scale = Math.min(cw / iw, ch / ih, 1);
          return { w: iw * scale, h: ih * scale };
        })()
      : null;

  if (!open) return null;

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
            className={`relative transform overflow-hidden rounded-xl border border-zinc-200 bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:border-zinc-800 dark:bg-zinc-950 sm:my-8 sm:w-full sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95 ${
              step === "verify" ? "sm:max-w-4xl sm:max-h-[90vh] sm:flex sm:flex-col" : "sm:max-w-lg"
            }`}
          >
            <DialogTitle
              as="h3"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {step === "upload" ? "Import finish list from image" : "Verify and apply"}
            </DialogTitle>

            {step === "upload" && (
              <>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Upload an image of the finish list (e.g. photo or screenshot). Sail numbers will be extracted in order.
                </p>
                {error && (
                  <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </p>
                )}
                {loading ? (
                  <div className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50/50 py-10 dark:border-zinc-600 dark:bg-zinc-900/30">
                    <ArrowPathIcon aria-hidden className="size-10 w-10 shrink-0 animate-spin text-zinc-400 dark:text-zinc-500" />
                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                      Extracting sail numbers…
                    </p>
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50/50 py-10 dark:border-zinc-600 dark:bg-zinc-900/30"
                  >
                    <PhotoIcon className="h-10 w-10 text-zinc-400 dark:text-zinc-500" />
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      Drag and drop an image, or
                    </p>
                    <label className="mt-2 cursor-pointer rounded-md bg-white px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:bg-zinc-800 dark:text-indigo-400 dark:hover:bg-zinc-700">
                      <input
                        type="file"
                        accept={ACCEPT_IMAGE}
                        onChange={handleFileInputChange}
                        className="sr-only"
                      />
                      Choose file
                    </label>
                  </div>
                )}
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="cursor-pointer rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {step === "verify" && (
              <>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Review the extracted sail numbers. Edit or remove rows that don’t match event entries (highlighted). Then append to or replace the current list.
                </p>
                <div className="mt-4 flex min-h-[280px] flex-col gap-4 sm:min-h-[360px] sm:flex-1 sm:flex-row sm:overflow-hidden">
                  {imagePreviewUrl && (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Image</span>
                        <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50 p-0.5">
                          <button
                            type="button"
                            onClick={zoomOut}
                            disabled={zoom <= ZOOM_MIN}
                            aria-label="Zoom out"
                            className="cursor-pointer rounded p-1.5 text-zinc-600 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700"
                          >
                            <MagnifyingGlassMinusIcon className="h-4 w-4" />
                          </button>
                          <span className="min-w-[3rem] px-1 text-center text-xs text-zinc-600 dark:text-zinc-400">
                            {Math.round(zoom * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={zoomIn}
                            disabled={zoom >= ZOOM_MAX}
                            aria-label="Zoom in"
                            className="cursor-pointer rounded p-1.5 text-zinc-600 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700"
                          >
                            <MagnifyingGlassPlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div
                        ref={imageContainerRef}
                        className="mt-1 flex min-h-[200px] min-w-0 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50"
                      >
                        {imageNaturalSize && fittedSize ? (
                          <div
                            className="inline-block p-2"
                            style={{
                              width: fittedSize.w * zoom,
                              height: fittedSize.h * zoom,
                            }}
                          >
                            <img
                              ref={imageRef}
                              src={imagePreviewUrl}
                              alt="Uploaded finish list"
                              onLoad={handleImageLoad}
                              width={imageNaturalSize.w}
                              height={imageNaturalSize.h}
                              className="block object-contain"
                              style={{
                                transform: `scale(${(fittedSize.w / imageNaturalSize.w) * zoom})`,
                                transformOrigin: "0 0",
                                width: imageNaturalSize.w,
                                height: imageNaturalSize.h,
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex h-full min-h-[200px] w-full items-center justify-center p-2">
                            <img
                              ref={imageRef}
                              src={imagePreviewUrl}
                              alt="Uploaded finish list"
                              onLoad={handleImageLoad}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Extracted sail numbers ({extractedSailNumbers.length})
                    </span>
                    <div className="mt-1 min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
                        {extractedSailNumbers.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                            No sail numbers extracted. Use Back to try another image.
                          </li>
                        ) : (
                          extractedSailNumbers.map((value, index) => (
                            <li
                              key={index}
                              className="flex items-center gap-2 px-3 py-1.5"
                            >
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => updateSailNumber(index, e.target.value)}
                                className={`min-w-0 flex-1 rounded border bg-white px-2 py-1 text-sm dark:bg-zinc-900 dark:text-zinc-50 ${
                                  isSailInvalid(value)
                                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/50"
                                    : "border-zinc-300 focus:border-indigo-500 focus:ring-indigo-500/50 dark:border-zinc-600"
                                }`}
                                placeholder="Sail #"
                              />
                              <button
                                type="button"
                                onClick={() => removeSailNumber(index)}
                                aria-label="Remove row"
                                className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="cursor-pointer rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => applySailNumbers("append")}
                    className="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Append to list
                  </button>
                  <button
                    type="button"
                    onClick={() => applySailNumbers("replace")}
                    className="cursor-pointer rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Replace list
                  </button>
                </div>
              </>
            )}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
