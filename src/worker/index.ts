import { Hono } from "hono";
import { eventsRoutes } from "./routes/events";
import { playersRoutes } from "./routes/players";
import { adminRoutes } from "./routes/admin";
import { verifyRoutes } from "./routes/verify";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", eventsRoutes);
app.route("/api", playersRoutes);
app.route("/api", adminRoutes);
app.route("/api", verifyRoutes);

export default app;
