"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy enter page: redirects to the race-scoped flow.
 * - No eventId → /record
 * - eventId present → /record/[eventId] (user picks a race, then enters)
 */
function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") ?? "";

  useEffect(() => {
    if (eventId.trim()) {
      router.replace(`/record/${encodeURIComponent(eventId.trim())}`);
    } else {
      router.replace("/record");
    }
  }, [eventId, router]);

  return (
    <div className="py-8 px-0 sm:px-8 lg:px-10">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Redirecting… Select an event and race to enter finish data.
      </p>
    </div>
  );
}

export default function RecordEnterRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 px-0 sm:px-8 lg:px-10">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Redirecting…
          </p>
        </div>
      }
    >
      <RedirectContent />
    </Suspense>
  );
}
