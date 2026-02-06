import { Hono } from "hono";
import { adminAuth } from "../middleware/adminAuth";
import { getPlayer, addPlayer, removePlayer, listPlayers, getGameState } from "../lib/kv";
import { EVENTS, MAX_PICKS, MAX_PICKS_PER_PERIOD, MAX_NAME_LENGTH, MAX_TIEBREAKER_LENGTH } from "../../shared/constants";

const app = new Hono<{ Bindings: Env }>();

app.get("/players", async (c) => {
  const players = await listPlayers(c.env.GAME_KV);
  return c.json(players);
});

app.post("/players", async (c) => {
  let body: { name?: string; picks?: string[]; tiebreaker?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const gameState = await getGameState(c.env.GAME_KV);
  if (gameState.locked) {
    return c.json({ error: "Submissions are closed" }, 403);
  }

  const name = body.name?.trim();
  if (!name) {
    return c.json({ error: "Name is required" }, 400);
  }

  if (name.length > MAX_NAME_LENGTH) {
    return c.json({ error: `Name must be ${MAX_NAME_LENGTH} characters or less` }, 400);
  }

  const picks = body.picks;
  if (!Array.isArray(picks) || picks.length !== MAX_PICKS) {
    return c.json({ error: `Exactly ${MAX_PICKS} picks required` }, 400);
  }

  if (new Set(picks).size !== picks.length) {
    return c.json({ error: "Duplicate picks not allowed" }, 400);
  }

  const eventMap = new Map(EVENTS.map((e) => [e.id, e]));
  for (const pick of picks) {
    if (!eventMap.has(pick)) {
      return c.json({ error: `Invalid pick ID: ${pick}` }, 400);
    }
  }

  // Enforce 2 picks per period
  const periodCounts = new Map<string, number>();
  for (const pick of picks) {
    const period = eventMap.get(pick)!.period;
    periodCounts.set(period, (periodCounts.get(period) || 0) + 1);
  }
  for (const [period, count] of periodCounts) {
    if (count !== MAX_PICKS_PER_PERIOD) {
      return c.json({ error: `Exactly ${MAX_PICKS_PER_PERIOD} picks required per period (${period} has ${count})` }, 400);
    }
  }

  const trimmedTiebreaker = body.tiebreaker?.trim() || "";
  if (trimmedTiebreaker.length > MAX_TIEBREAKER_LENGTH) {
    return c.json({ error: `Tiebreaker must be ${MAX_TIEBREAKER_LENGTH} characters or less` }, 400);
  }

  const existing = await getPlayer(c.env.GAME_KV, name);
  if (existing) {
    return c.json({ error: "Name already taken" }, 409);
  }

  const player = {
    name,
    picks,
    tiebreaker: trimmedTiebreaker,
    ts: Date.now(),
  };

  await addPlayer(c.env.GAME_KV, player);
  return c.json({ success: true, player }, 201);
});

app.delete("/players/:name", adminAuth, async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  await removePlayer(c.env.GAME_KV, name);
  return c.json({ success: true });
});

export { app as playersRoutes };
