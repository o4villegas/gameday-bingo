import { Hono } from "hono";
import { adminAuth } from "../middleware/adminAuth";
import { setEvents, setPlayers } from "../lib/kv";

const app = new Hono<{ Bindings: Env }>();

app.post("/reset", adminAuth, async (c) => {
  await setEvents(c.env.GAME_KV, {});
  await setPlayers(c.env.GAME_KV, []);
  return c.json({ success: true });
});

export { app as adminRoutes };
