import type { EventState, Player, VerificationResult, VerificationState, Period } from "../../shared/types";

const API_BASE = "/api";

export async function fetchEvents(): Promise<EventState> {
  const res = await fetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export async function fetchPlayers(): Promise<Player[]> {
  const res = await fetch(`${API_BASE}/players`);
  if (!res.ok) throw new Error("Failed to fetch players");
  return res.json();
}

export async function submitPicks(data: {
  name: string;
  picks: string[];
  tiebreaker: string;
}): Promise<{ success?: boolean; player?: Player; error?: string }> {
  const res = await fetch(`${API_BASE}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json() as { success?: boolean; player?: Player; error?: string };
  if (!res.ok) {
    throw new Error(json.error || "Failed to submit picks");
  }
  return json;
}

export async function toggleEvent(
  eventId: string,
  adminCode: string
): Promise<EventState> {
  const res = await fetch(`${API_BASE}/events/${eventId}`, {
    method: "PUT",
    headers: { "X-Admin-Code": adminCode },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to toggle event");
  return res.json();
}

export async function removePlayer(
  name: string,
  adminCode: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/players/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
      headers: { "X-Admin-Code": adminCode },
    }
  );
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to remove player");
}

export async function resetGame(adminCode: string): Promise<void> {
  const res = await fetch(`${API_BASE}/reset`, {
    method: "POST",
    headers: { "X-Admin-Code": adminCode },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to reset game");
}

export async function triggerVerification(
  period: Period,
  adminCode: string,
  manualText?: string,
): Promise<VerificationResult> {
  const res = await fetch(`${API_BASE}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Code": adminCode,
    },
    body: JSON.stringify({ period, manualText }),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  const json = (await res.json()) as VerificationResult & { error?: string };
  if (!res.ok) throw new Error((json as { error?: string }).error || "Verification failed");
  return json;
}

export async function getVerificationStatus(
  adminCode: string,
): Promise<VerificationState> {
  const res = await fetch(`${API_BASE}/verify/status`, {
    headers: { "X-Admin-Code": adminCode },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to get status");
  return res.json();
}

export async function approveVerification(
  adminCode: string,
): Promise<EventState> {
  const res = await fetch(`${API_BASE}/verify/approve`, {
    method: "POST",
    headers: { "X-Admin-Code": adminCode },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to approve");
  return res.json();
}

export async function dismissVerification(
  adminCode: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/verify/dismiss`, {
    method: "POST",
    headers: { "X-Admin-Code": adminCode },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to dismiss");
}

export async function fetchGameLockStatus(): Promise<{ locked: boolean; periodsVerified: Period[] }> {
  const res = await fetch(`${API_BASE}/game-state`);
  if (!res.ok) throw new Error("Failed to fetch game state");
  return res.json();
}

export async function toggleGameLock(
  adminCode: string,
): Promise<{ locked: boolean }> {
  const res = await fetch(`${API_BASE}/lock`, {
    method: "POST",
    headers: { "X-Admin-Code": adminCode },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to toggle lock");
  return res.json();
}
