import { Hono } from "hono";
import { adminAuth } from "../middleware/adminAuth";
import { setEvents, clearPlayers, setVerificationState, getGameState, setGameState } from "../lib/kv";

const app = new Hono<{ Bindings: Env }>();

app.get("/game-state", async (c) => {
  const gameState = await getGameState(c.env.GAME_KV);
  return c.json({ locked: gameState.locked });
});

app.post("/lock", adminAuth, async (c) => {
  const gameState = await getGameState(c.env.GAME_KV);
  gameState.locked = !gameState.locked;
  await setGameState(c.env.GAME_KV, gameState);
  return c.json({ locked: gameState.locked });
});

app.post("/reset", adminAuth, async (c) => {
  await setEvents(c.env.GAME_KV, {});
  await clearPlayers(c.env.GAME_KV);
  // Clean up legacy aggregate key if it exists
  await c.env.GAME_KV.delete("sb-players");
  await setVerificationState(c.env.GAME_KV, { pendingApproval: null, appliedResults: [] });
  await setGameState(c.env.GAME_KV, { gameId: "", periodsVerified: [], locked: false });
  return c.json({ success: true });
});

export { app as adminRoutes };
