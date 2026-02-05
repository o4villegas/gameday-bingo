import type { EventState, Player } from "../../shared/types";

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
