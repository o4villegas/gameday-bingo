import { Hono } from "hono";
import { adminAuth } from "../middleware/adminAuth";
import { getEvents, setEvents, getVerificationState, setVerificationState, getGameState, setGameState } from "../lib/kv";
import { fetchGameData } from "../lib/espn";
import { verifyPeriod } from "../lib/ai-verify";
import type { Period } from "../../shared/types";

const VALID_PERIODS: Period[] = ["Q1", "Q2", "Q3", "Q4", "FG"];

const app = new Hono<{ Bindings: Env }>();

app.post("/verify", adminAuth, async (c) => {
  let body: { period?: string; manualText?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const rawPeriod = body.period;

  if (!rawPeriod || !VALID_PERIODS.includes(rawPeriod as Period)) {
    return c.json({ error: "Invalid period. Use Q1, Q2, Q3, Q4, or FG" }, 400);
  }
  const period = rawPeriod as Period;

  const state = await getVerificationState(c.env.GAME_KV);
  if (state.pendingApproval) {
    return c.json({
      error: "A verification result is pending approval. Approve or dismiss it first.",
      pending: state.pendingApproval,
    }, 409);
  }

  let gameData: string;
  if (body.manualText?.trim()) {
    gameData = body.manualText.trim();
  } else {
    try {
      gameData = await fetchGameData();
    } catch (err) {
      return c.json({
        error: "Failed to fetch ESPN data. Use manualText fallback.",
        details: err instanceof Error ? err.message : "Unknown error",
      }, 502);
    }
  }

  const result = await verifyPeriod(c.env.AI, period, gameData);

  state.pendingApproval = result;
  await setVerificationState(c.env.GAME_KV, state);

  return c.json(result);
});

app.get("/verify/status", adminAuth, async (c) => {
  const state = await getVerificationState(c.env.GAME_KV);
  return c.json(state);
});

app.post("/verify/approve", adminAuth, async (c) => {
  const state = await getVerificationState(c.env.GAME_KV);

  if (!state.pendingApproval) {
    return c.json({ error: "No pending verification to approve" }, 404);
  }

  const currentEvents = await getEvents(c.env.GAME_KV);
  const result = state.pendingApproval;

  // Safety: only set events to true, never false
  for (const ev of result.events) {
    if (ev.occurred && ev.confidence !== "low") {
      currentEvents[ev.eventId] = true;
    }
  }

  await setEvents(c.env.GAME_KV, currentEvents);

  state.appliedResults.push(result);
  state.pendingApproval = null;
  await setVerificationState(c.env.GAME_KV, state);

  // Track which periods have been verified
  const gameState = await getGameState(c.env.GAME_KV);
  if (!gameState.periodsVerified.includes(result.period)) {
    gameState.periodsVerified.push(result.period);
    await setGameState(c.env.GAME_KV, gameState);
  }

  return c.json(currentEvents);
});

app.post("/verify/dismiss", adminAuth, async (c) => {
  const state = await getVerificationState(c.env.GAME_KV);
  state.pendingApproval = null;
  await setVerificationState(c.env.GAME_KV, state);
  return c.json({ success: true });
});

export { app as verifyRoutes };
