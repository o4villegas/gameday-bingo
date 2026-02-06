import type { EventState, Player, VerificationState, GameState, Period } from "../../shared/types";

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

export async function getVerificationState(kv: KVNamespace): Promise<VerificationState> {
  const raw = await kv.get("sb-verification");
  return raw ? JSON.parse(raw) : { pendingApproval: null, appliedResults: [] };
}

export async function setVerificationState(kv: KVNamespace, state: VerificationState): Promise<void> {
  await kv.put("sb-verification", JSON.stringify(state));
}

export async function getGameState(kv: KVNamespace): Promise<GameState> {
  const raw = await kv.get("sb-game-state");
  return raw ? JSON.parse(raw) : { gameId: "", periodsVerified: [] as Period[] };
}

export async function setGameState(kv: KVNamespace, state: GameState): Promise<void> {
  await kv.put("sb-game-state", JSON.stringify(state));
}
