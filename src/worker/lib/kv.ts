import type { EventState, Player, VerificationState, GameState, Period } from "../../shared/types";

export async function getEvents(kv: KVNamespace): Promise<EventState> {
  const raw = await kv.get("sb-events");
  return raw ? JSON.parse(raw) : {};
}

export async function setEvents(kv: KVNamespace, state: EventState): Promise<void> {
  await kv.put("sb-events", JSON.stringify(state));
}

// --- Per-player KV key helpers (atomic read/write, no race conditions) ---

const PLAYER_PREFIX = "sb-player:";

function playerKey(name: string): string {
  return `${PLAYER_PREFIX}${name.toLowerCase()}`;
}

export async function getPlayer(kv: KVNamespace, name: string): Promise<Player | null> {
  const raw = await kv.get(playerKey(name));
  return raw ? JSON.parse(raw) : null;
}

export async function addPlayer(kv: KVNamespace, player: Player): Promise<void> {
  await kv.put(playerKey(player.name), JSON.stringify(player));
}

export async function removePlayer(kv: KVNamespace, name: string): Promise<void> {
  await kv.delete(playerKey(name));
}

export async function listPlayers(kv: KVNamespace): Promise<Player[]> {
  const result = await kv.list({ prefix: PLAYER_PREFIX });
  const players = await Promise.all(
    result.keys.map(async (k) => {
      const raw = await kv.get(k.name);
      return raw ? (JSON.parse(raw) as Player) : null;
    }),
  );
  return players.filter((p): p is Player => p !== null);
}

export async function clearPlayers(kv: KVNamespace): Promise<void> {
  const result = await kv.list({ prefix: PLAYER_PREFIX });
  await Promise.all(result.keys.map((k) => kv.delete(k.name)));
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
  if (!raw) return { gameId: "", periodsVerified: [] as Period[], locked: false };
  const parsed = JSON.parse(raw) as GameState;
  // Backwards-compat: existing KV data may not have `locked`
  if (typeof parsed.locked !== "boolean") parsed.locked = false;
  return parsed;
}

export async function setGameState(kv: KVNamespace, state: GameState): Promise<void> {
  await kv.put("sb-game-state", JSON.stringify(state));
}
