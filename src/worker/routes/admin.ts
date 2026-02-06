import { Hono } from "hono";
import { adminAuth } from "../middleware/adminAuth";
import { setEvents, setPlayers, setVerificationState, setGameState } from "../lib/kv";

const app = new Hono<{ Bindings: Env }>();

app.post("/reset", adminAuth, async (c) => {
  await setEvents(c.env.GAME_KV, {});
  await setPlayers(c.env.GAME_KV, []);
  await setVerificationState(c.env.GAME_KV, { pendingApproval: null, appliedResults: [] });
  await setGameState(c.env.GAME_KV, { gameId: "", periodsVerified: [] });
  return c.json({ success: true });
});

export { app as adminRoutes };
