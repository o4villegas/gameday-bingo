import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { eventsRoutes } from "./routes/events";
import { playersRoutes } from "./routes/players";
import { adminRoutes } from "./routes/admin";
import { verifyRoutes } from "./routes/verify";

const app = new Hono<{ Bindings: Env }>();

// CORS: only allow same-origin in production, localhost in dev
app.use("/api/*", cors({
  origin: (origin) => {
    if (!origin) return origin; // same-origin requests (no Origin header)
    const allowed = [
      "https://gameday-bingo.lando555.workers.dev",
      "http://localhost:5173",
      "http://localhost:8787",
    ];
    return allowed.includes(origin) ? origin : "";
  },
  allowHeaders: ["Content-Type", "X-Admin-Code"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

// Body size limit: 64KB max for all API requests
app.use("/api/*", bodyLimit({ maxSize: 64 * 1024 }));

app.route("/api", eventsRoutes);
app.route("/api", playersRoutes);
app.route("/api", adminRoutes);
app.route("/api", verifyRoutes);

export default app;
