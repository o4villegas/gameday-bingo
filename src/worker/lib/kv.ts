import type { EventState, Player } from "../../shared/types";

export async function getEvents(kv: KVNamespace): Promise<EventState> {
  const raw = await kv.get("sb-events");
  return raw ? JSON.parse(raw) : {};
}

export async function setEvents(kv: KVNamespace, state: EventState): Promise<void> {
  await kv.put("sb-events", JSON.stringify(state));
}

export async function getPlayers(kv: KVNamespace): Promise<Player[]> {
  const raw = await kv.get("sb-players");
  return raw ? JSON.parse(raw) : [];
}

export async function setPlayers(kv: KVNamespace, players: Player[]): Promise<void> {
  await kv.put("sb-players", JSON.stringify(players));
}
