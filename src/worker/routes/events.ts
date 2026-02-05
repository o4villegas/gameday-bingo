import { Hono } from "hono";
import { adminAuth } from "../middleware/adminAuth";
import { getEvents, setEvents } from "../lib/kv";
import { EVENTS } from "../../shared/constants";

const app = new Hono<{ Bindings: Env }>();

app.get("/events", async (c) => {
  const events = await getEvents(c.env.GAME_KV);
  return c.json(events);
});

app.put("/events/:id", adminAuth, async (c) => {
  const id = c.req.param("id");
  const valid = EVENTS.some((e) => e.id === id);
  if (!valid) {
    return c.json({ error: "Invalid event ID" }, 400);
  }

  const state = await getEvents(c.env.GAME_KV);
  state[id] = !state[id];
  await setEvents(c.env.GAME_KV, state);
  return c.json(state);
});

export { app as eventsRoutes };
