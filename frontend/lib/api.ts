const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000";

// ---------- Types ----------

export interface Event {
  id: string;
  name?: string;
  discard: number[];
}

export function discardSummary(count: number): string {
  if (count === 0) return "No scores excluded";
  if (count === 1) return "1 worst score excluded";
  return `${count} worst scores excluded`;
}

export interface Entry {
  _id: string;
  event_id: string;
  sail_number: string;
  name?: string;
  division_ids?: string[];
}

export interface Division {
  _id: string;
  event_id: string;
  name: string;
}

export interface Race {
  _id: string;
  event_id: string;
  race_id: string;
  start_time: string;
  notes?: string;
}

export interface Finish {
  _id: string;
  sail_number: string;
  race_id: string;
  finish_time: string;
  rc_scoring?: string;
}

export interface ResultRow {
  sail_number: string;
  name?: string;
  rank: number;
  rank_display: string;
  scores: [number | null, boolean, string | null][];
  total: number;
  net: number;
}

// ---------- Helpers ----------

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.statusText || "Request failed");
  return res.text();
}

// ---------- Events ----------

export async function getEvents(): Promise<Event[]> {
  return fetchJson<Event[]>(`${API_BASE}/api/events`);
}

export async function getEvent(eventId: string): Promise<Event> {
  return fetchJson<Event>(
    `${API_BASE}/api/events/${encodeURIComponent(eventId)}`
  );
}

export async function createEvent(payload: {
  name?: string;
  discard: number[] | string;
}): Promise<Event> {
  const body: { name?: string; discard: number[] | string } =
    typeof payload.discard === "string"
      ? { discard: payload.discard }
      : { discard: payload.discard };
  if (payload.name !== undefined && payload.name !== "") body.name = payload.name;
  return fetchJson<Event>(`${API_BASE}/api/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateEvent(
  eventId: string,
  payload: { name?: string; discard: number[] | string }
): Promise<Event> {
  const body: { name?: string; discard: number[] | string } =
    typeof payload.discard === "string"
      ? { discard: payload.discard }
      : { discard: payload.discard };
  if (payload.name !== undefined) body.name = payload.name;
  return fetchJson<Event>(
    `${API_BASE}/api/events/${encodeURIComponent(eventId)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}

export async function deleteEvent(eventId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ---------- Entries ----------

export async function getEntries(eventId?: string): Promise<Entry[]> {
  const url =
    eventId != null && eventId !== ""
      ? `${API_BASE}/api/entries?event_id=${encodeURIComponent(eventId)}`
      : `${API_BASE}/api/entries`;
  return fetchJson<Entry[]>(url);
}

export async function createEntry(payload: {
  event_id: string;
  sail_number: string;
  name?: string;
  division_ids?: string[];
}): Promise<Entry> {
  return fetchJson<Entry>(`${API_BASE}/api/entries`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEntry(
  entryId: string,
  payload: { sail_number?: string; name?: string; division_ids?: string[] }
): Promise<Entry> {
  return fetchJson<Entry>(
    `${API_BASE}/api/entries/${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteEntry(entryId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/entries/${encodeURIComponent(entryId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ---------- Divisions ----------

export async function getDivisions(eventId?: string): Promise<Division[]> {
  const url =
    eventId != null && eventId !== ""
      ? `${API_BASE}/api/divisions?event_id=${encodeURIComponent(eventId)}`
      : `${API_BASE}/api/divisions`;
  return fetchJson<Division[]>(url);
}

export async function createDivision(payload: {
  event_id: string;
  name: string;
}): Promise<Division> {
  return fetchJson<Division>(`${API_BASE}/api/divisions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDivision(
  divisionId: string,
  payload: { name: string }
): Promise<Division> {
  return fetchJson<Division>(
    `${API_BASE}/api/divisions/${encodeURIComponent(divisionId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteDivision(divisionId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/divisions/${encodeURIComponent(divisionId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ---------- Races ----------

export async function getRaces(eventId?: string): Promise<Race[]> {
  const url =
    eventId != null && eventId !== ""
      ? `${API_BASE}/api/races?event_id=${encodeURIComponent(eventId)}`
      : `${API_BASE}/api/races`;
  return fetchJson<Race[]>(url);
}

export async function createRace(payload: {
  event_id: string;
  race_id: string;
  start_time: string;
}): Promise<Race> {
  return fetchJson<Race>(`${API_BASE}/api/races`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRace(
  raceMongoId: string,
  payload: { notes?: string }
): Promise<Race> {
  return fetchJson<Race>(
    `${API_BASE}/api/races/${encodeURIComponent(raceMongoId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteRace(raceMongoId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/races/${encodeURIComponent(raceMongoId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ---------- Finishes ----------

export async function getFinishes(raceId?: string, eventId?: string): Promise<Finish[]> {
  const params = new URLSearchParams();
  if (raceId != null && raceId !== "") params.set("race_id", raceId);
  if (eventId != null && eventId !== "") params.set("event_id", eventId);
  const qs = params.toString();
  const url = qs ? `${API_BASE}/api/finishes?${qs}` : `${API_BASE}/api/finishes`;
  return fetchJson<Finish[]>(url);
}

export async function createFinish(payload: {
  sail_number: string;
  race_id: string;
  finish_time: string;
  rc_scoring?: string;
}): Promise<Finish> {
  return fetchJson<Finish>(`${API_BASE}/api/finishes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteFinish(finishId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/finishes/${encodeURIComponent(finishId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ---------- Results ----------

export async function getResultRows(
  eventId: string,
  divisionId?: string
): Promise<ResultRow[]> {
  let url = `${API_BASE}/api/results/${encodeURIComponent(eventId)}`;
  if (divisionId != null && divisionId !== "") {
    url += `?division_id=${encodeURIComponent(divisionId)}`;
  }
  return fetchJson<ResultRow[]>(url);
}

export async function getResultCsv(
  eventId: string,
  divisionId?: string
): Promise<string> {
  let url = `${API_BASE}/api/results/${encodeURIComponent(eventId)}/csv`;
  if (divisionId != null && divisionId !== "") {
    url += `?division_id=${encodeURIComponent(divisionId)}`;
  }
  return fetchText(url);
}
