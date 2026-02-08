/**
 * Edge Case Tests for Worker API Routes
 *
 * Tests the Hono API routes using app.request() with mocked KV/AI bindings.
 * Each test targets a specific failure mode identified from code review.
 */
import { describe, it, expect, beforeEach } from "vitest";
import app from "./index";

// ---------------------------------------------------------------------------
// Mock KV namespace — in-memory Map backing store
// ---------------------------------------------------------------------------
function createMockKV(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(initial));
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async (opts?: { prefix?: string | null }) => {
      const prefix = opts?.prefix || "";
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
    getWithMetadata: async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: null,
      cacheStatus: null,
    }),
  } as unknown as KVNamespace;
}

// ---------------------------------------------------------------------------
// Valid 10-pick set (2 per period) for reuse
// ---------------------------------------------------------------------------
const VALID_PICKS = [
  "q1_opening_kick_td", "q1_safety_first_play",
  "q2_50yd_fg", "q2_pick_six",
  "q3_first_drive_td", "q3_no_points",
  "q4_2pt_attempted", "q4_failed_2pt",
  "fg_gatorade_orange", "fg_margin_3",
];

const ADMIN_HEADERS = { "X-Admin-Code": "kava60" };

let mockKV: KVNamespace;

function env() {
  return { GAME_KV: mockKV, ANTHROPIC_API_KEY: "test-key" };
}

function jsonPost(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  }, env());
}

function jsonPut(path: string, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "PUT",
    headers,
  }, env());
}

function jsonGet(path: string, headers: Record<string, string> = {}) {
  return app.request(path, { headers }, env());
}

function jsonDelete(path: string, headers: Record<string, string> = {}) {
  return app.request(path, { method: "DELETE", headers }, env());
}

beforeEach(() => {
  mockKV = createMockKV();
});

// =====================================================================
// EDGE CASE 11: POST /api/players with malformed (non-JSON) body
// Failure mode: c.req.json() throws on non-JSON body.
// Fix: try/catch around c.req.json() returns clean 400.
// =====================================================================
describe("Edge Case 11: POST /api/players with malformed body", () => {
  it("returns 400 when body is not valid JSON", async () => {
    const res = await app.request("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "this is not json {{{",
    }, env());

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("Invalid JSON");
  });

  it("returns 400 when body is empty", async () => {
    const res = await app.request("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    }, env());

    expect(res.status).toBe(400);
  });
});

// =====================================================================
// EDGE CASE 12: POST /api/players with whitespace-only name
// Failure mode: name.trim() returns "", but the check `!name`
// should catch it. If not, a player with empty name gets created.
// =====================================================================
describe("Edge Case 12: POST /api/players with whitespace-only name", () => {
  it("rejects name that is only spaces", async () => {
    const res = await jsonPost("/api/players", {
      name: "   ",
      picks: VALID_PICKS,
      tiebreaker: "test",
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("Name is required");
  });

  it("rejects name that is only tabs and newlines", async () => {
    const res = await jsonPost("/api/players", {
      name: "\t\n\r",
      picks: VALID_PICKS,
      tiebreaker: "",
    });

    expect(res.status).toBe(400);
  });

  it("rejects undefined name", async () => {
    const res = await jsonPost("/api/players", {
      picks: VALID_PICKS,
      tiebreaker: "",
    });

    expect(res.status).toBe(400);
  });
});

// =====================================================================
// EDGE CASE 13: POST /api/players with wrong picks per period
// Failure mode: Sending 3 picks for Q1 and 1 for Q2 (total still 10)
// should be rejected. The validation at players.ts:46-54 checks that
// each represented period has exactly 2 picks.
// =====================================================================
describe("Edge Case 13: Wrong picks per period distribution", () => {
  it("rejects 3 picks in Q1 and 1 in Q2", async () => {
    const badPicks = [
      "q1_opening_kick_td", "q1_safety_first_play", "q1_first_score_fg", // 3 Q1
      "q2_50yd_fg",                                                       // 1 Q2
      "q3_first_drive_td", "q3_no_points",
      "q4_2pt_attempted", "q4_failed_2pt",
      "fg_gatorade_orange", "fg_margin_3",
    ];

    const res = await jsonPost("/api/players", {
      name: "BadDistribution",
      picks: badPicks,
      tiebreaker: "",
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/picks required per period/i);
  });

  it("rejects when a period has 0 picks (4 in another)", async () => {
    const badPicks = [
      "q1_opening_kick_td", "q1_safety_first_play",
      "q1_first_score_fg", "q1_first_score_def_td", // 4 Q1 total
      // 0 Q2
      "q3_first_drive_td", "q3_no_points",
      "q4_2pt_attempted", "q4_failed_2pt",
      "fg_gatorade_orange", "fg_margin_3",
    ];

    const res = await jsonPost("/api/players", {
      name: "MissingPeriod",
      picks: badPicks,
      tiebreaker: "",
    });

    expect(res.status).toBe(400);
  });
});

// =====================================================================
// EDGE CASE 14: POST /api/players with duplicate pick IDs
// Failure mode: Same event selected twice. The Set size check at
// players.ts:34 catches this.
// =====================================================================
describe("Edge Case 14: Duplicate pick IDs", () => {
  it("rejects picks with duplicate event IDs", async () => {
    const dupes = [
      "q1_opening_kick_td", "q1_opening_kick_td", // duplicate!
      "q2_50yd_fg", "q2_pick_six",
      "q3_first_drive_td", "q3_no_points",
      "q4_2pt_attempted", "q4_failed_2pt",
      "fg_gatorade_orange", "fg_margin_3",
    ];

    const res = await jsonPost("/api/players", {
      name: "Duper",
      picks: dupes,
      tiebreaker: "",
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("Duplicate picks");
  });
});

// =====================================================================
// EDGE CASE 15: POST /api/players with invalid event IDs
// Failure mode: Pick IDs that don't exist in EVENTS should be rejected.
// The check at players.ts:39-42 validates against eventMap.
// =====================================================================
describe("Edge Case 15: Invalid event IDs in picks", () => {
  it("rejects picks containing non-existent event IDs", async () => {
    const badPicks = [
      "q1_nonexistent", "q1_safety_first_play", // q1_nonexistent doesn't exist
      "q2_50yd_fg", "q2_pick_six",
      "q3_first_drive_td", "q3_no_points",
      "q4_2pt_attempted", "q4_failed_2pt",
      "fg_gatorade_orange", "fg_margin_3",
    ];

    const res = await jsonPost("/api/players", {
      name: "BadIDs",
      picks: badPicks,
      tiebreaker: "",
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("Invalid pick ID");
  });
});

// =====================================================================
// EDGE CASE 16: POST /api/players with case-insensitive duplicate name
// Failure mode: "Alice" and "alice" should be treated as the same name.
// players.ts:58-59 compares .toLowerCase().
// =====================================================================
describe("Edge Case 16: Case-insensitive duplicate player name", () => {
  it("rejects 'alice' when 'Alice' already exists", async () => {
    // First submission succeeds
    const res1 = await jsonPost("/api/players", {
      name: "Alice",
      picks: VALID_PICKS,
      tiebreaker: "",
    });
    expect(res1.status).toBe(201);

    // Second submission with different case should fail
    const res2 = await jsonPost("/api/players", {
      name: "alice",
      picks: VALID_PICKS,
      tiebreaker: "",
    });
    expect(res2.status).toBe(409);
    const json = await res2.json() as { error: string };
    expect(json.error).toContain("Name already taken");
  });

  it("rejects 'ALICE' when 'Alice' already exists", async () => {
    await jsonPost("/api/players", {
      name: "Alice",
      picks: VALID_PICKS,
      tiebreaker: "",
    });

    const res = await jsonPost("/api/players", {
      name: "ALICE",
      picks: VALID_PICKS,
      tiebreaker: "",
    });
    expect(res.status).toBe(409);
  });
});

// =====================================================================
// EDGE CASE 17: PUT /api/events/:id with invalid event ID
// Failure mode: Toggling a non-existent event ID should return 400,
// not silently add a new key to eventState.
// =====================================================================
describe("Edge Case 17: Toggle non-existent event ID", () => {
  it("returns 400 for invalid event ID", async () => {
    const res = await jsonPut("/api/events/not_a_real_event", ADMIN_HEADERS);

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("Invalid event ID");
  });
});

// =====================================================================
// EDGE CASE 18: Admin auth — missing or wrong X-Admin-Code header
// Failure mode: Admin endpoints accessible without proper auth.
// =====================================================================
describe("Edge Case 18: Admin authentication", () => {
  it("rejects toggle event without admin code", async () => {
    const res = await jsonPut("/api/events/q1_opening_kick_td");
    expect(res.status).toBe(401);
  });

  it("rejects toggle event with wrong admin code", async () => {
    const res = await jsonPut("/api/events/q1_opening_kick_td", {
      "X-Admin-Code": "wrong_code",
    });
    expect(res.status).toBe(401);
  });

  it("rejects reset without admin code", async () => {
    const res = await jsonPost("/api/reset", {});
    expect(res.status).toBe(401);
  });

  it("rejects player deletion without admin code", async () => {
    const res = await jsonDelete("/api/players/Alice");
    expect(res.status).toBe(401);
  });

  it("allows toggle event with correct admin code", async () => {
    const res = await jsonPut("/api/events/q1_opening_kick_td", ADMIN_HEADERS);
    expect(res.status).toBe(200);
  });
});

// =====================================================================
// EDGE CASE 19: POST /api/verify with pending approval already exists
// Failure mode: If there's already a pending verification result,
// triggering another verification should be blocked (409) to prevent
// overwriting the first result.
// =====================================================================
describe("Edge Case 19: Verify with pending approval", () => {
  it("rejects verification when one is already pending", async () => {
    // Seed a pending verification result
    const pendingState = {
      pendingApproval: {
        period: "Q1",
        timestamp: Date.now(),
        events: [],
        summary: "test",
        status: "completed",
      },
      appliedResults: [],
    };
    await mockKV.put("sb-verification", JSON.stringify(pendingState));

    const res = await jsonPost("/api/verify", { period: "Q2" }, ADMIN_HEADERS);

    expect(res.status).toBe(409);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("pending approval");
  });
});

// =====================================================================
// EDGE CASE 20: POST /api/verify/approve with no pending result
// Failure mode: Approving when nothing is pending should return 404,
// not silently succeed or crash.
// =====================================================================
describe("Edge Case 20: Approve with no pending verification", () => {
  it("returns 404 when no verification is pending", async () => {
    const res = await app.request("/api/verify/approve", {
      method: "POST",
      headers: ADMIN_HEADERS,
    }, env());

    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("No pending verification");
  });
});

// =====================================================================
// Additional edge cases for event toggle and reset
// =====================================================================
describe("Event toggle correctness", () => {
  it("toggles event from false to true", async () => {
    const res = await jsonPut("/api/events/q1_opening_kick_td", ADMIN_HEADERS);
    expect(res.status).toBe(200);
    const state = await res.json() as Record<string, boolean>;
    expect(state.q1_opening_kick_td).toBe(true);
  });

  it("toggles event from true back to false", async () => {
    // First toggle: false → true
    await jsonPut("/api/events/q1_opening_kick_td", ADMIN_HEADERS);
    // Second toggle: true → false
    const res = await jsonPut("/api/events/q1_opening_kick_td", ADMIN_HEADERS);
    expect(res.status).toBe(200);
    const state = await res.json() as Record<string, boolean>;
    expect(state.q1_opening_kick_td).toBe(false);
  });
});

describe("Reset clears all state", () => {
  it("clears events, per-player keys, verification, and game state", async () => {
    // Seed some data using per-player keys
    await mockKV.put("sb-events", JSON.stringify({ q1_opening_kick_td: true }));
    await mockKV.put("sb-player:alice", JSON.stringify({ name: "Alice", picks: [], tiebreaker: "", ts: 1000 }));
    await mockKV.put("sb-player:bob", JSON.stringify({ name: "Bob", picks: [], tiebreaker: "", ts: 1001 }));

    // Reset
    const res = await jsonPost("/api/reset", {}, ADMIN_HEADERS);
    expect(res.status).toBe(200);

    // Verify all cleared
    const events = await jsonGet("/api/events");
    expect(await events.json()).toEqual({});

    const players = await jsonGet("/api/players");
    expect(await players.json()).toEqual([]);
  });

  it("also cleans up legacy sb-players key", async () => {
    await mockKV.put("sb-players", JSON.stringify([{ name: "Legacy", picks: [], tiebreaker: "", ts: 1000 }]));

    const res = await jsonPost("/api/reset", {}, ADMIN_HEADERS);
    expect(res.status).toBe(200);

    // Legacy key should be deleted
    const raw = await mockKV.get("sb-players");
    expect(raw).toBeNull();
  });
});

// =====================================================================
// Verify/approve safety: only sets events to true, never false
// =====================================================================
describe("Verify approve safety mechanism", () => {
  it("only sets events to true, never reverts true to false", async () => {
    // Pre-set an event as true (manually toggled by admin)
    await mockKV.put("sb-events", JSON.stringify({ q1_opening_kick_td: true }));

    // Create a pending verification where AI says event did NOT occur
    const pendingState = {
      pendingApproval: {
        period: "Q1",
        timestamp: Date.now(),
        events: [
          {
            eventId: "q1_opening_kick_td",
            eventName: "Opening Kickoff Returned for TD",
            occurred: false, // AI says it didn't happen
            confidence: "high",
            reasoning: "No kickoff return TD",
          },
          {
            eventId: "q1_safety_first_play",
            eventName: "Safety on First Offensive Play",
            occurred: true,
            confidence: "high",
            reasoning: "Safety occurred",
          },
        ],
        summary: "test",
        status: "completed",
      },
      appliedResults: [],
    };
    await mockKV.put("sb-verification", JSON.stringify(pendingState));

    // Approve
    const res = await app.request("/api/verify/approve", {
      method: "POST",
      headers: ADMIN_HEADERS,
    }, env());
    expect(res.status).toBe(200);

    const state = await res.json() as Record<string, boolean>;
    // q1_opening_kick_td should STILL be true (not reverted)
    expect(state.q1_opening_kick_td).toBe(true);
    // q1_safety_first_play should now be true
    expect(state.q1_safety_first_play).toBe(true);
  });

  it("does not apply low-confidence events even if occurred=true", async () => {
    const pendingState = {
      pendingApproval: {
        period: "FG",
        timestamp: Date.now(),
        events: [
          {
            eventId: "fg_gatorade_orange",
            eventName: "Gatorade Bath Color Is ORANGE",
            occurred: true,
            confidence: "low", // low confidence — should NOT be applied
            reasoning: "Cannot determine from data",
          },
        ],
        summary: "test",
        status: "completed",
      },
      appliedResults: [],
    };
    await mockKV.put("sb-verification", JSON.stringify(pendingState));

    const res = await app.request("/api/verify/approve", {
      method: "POST",
      headers: ADMIN_HEADERS,
    }, env());
    expect(res.status).toBe(200);

    const state = await res.json() as Record<string, boolean>;
    // Low confidence should NOT be applied
    expect(state.fg_gatorade_orange).toBeUndefined();
  });
});

// =====================================================================
// Player name edge cases
// =====================================================================
describe("Player name boundary conditions", () => {
  it("accepts name at exactly MAX_NAME_LENGTH (40 chars)", async () => {
    const name = "A".repeat(40);
    const res = await jsonPost("/api/players", {
      name,
      picks: VALID_PICKS,
      tiebreaker: "",
    });
    expect(res.status).toBe(201);
  });

  it("rejects name exceeding MAX_NAME_LENGTH", async () => {
    const name = "A".repeat(41);
    const res = await jsonPost("/api/players", {
      name,
      picks: VALID_PICKS,
      tiebreaker: "",
    });
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("40 characters");
  });

  it("trims leading/trailing whitespace from name before length check", async () => {
    // "  Alice  " trims to "Alice" (5 chars) — should succeed
    const res = await jsonPost("/api/players", {
      name: "  Alice  ",
      picks: VALID_PICKS,
      tiebreaker: "",
    });
    expect(res.status).toBe(201);
    const json = await res.json() as { player: { name: string } };
    expect(json.player.name).toBe("Alice");
  });
});

// =====================================================================
// Picks array type edge cases
// =====================================================================
describe("Picks array validation", () => {
  it("rejects non-array picks", async () => {
    const res = await jsonPost("/api/players", {
      name: "Test",
      picks: "not an array",
      tiebreaker: "",
    });
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("picks required");
  });

  it("rejects picks with wrong count (9 instead of 10)", async () => {
    const res = await jsonPost("/api/players", {
      name: "Test",
      picks: VALID_PICKS.slice(0, 9), // only 9
      tiebreaker: "",
    });
    expect(res.status).toBe(400);
  });

  it("rejects picks with too many (11)", async () => {
    const res = await jsonPost("/api/players", {
      name: "Test",
      picks: [...VALID_PICKS, "q1_first_score_fg"], // 11, also wrong period count
      tiebreaker: "",
    });
    expect(res.status).toBe(400);
  });

  it("rejects empty picks array", async () => {
    const res = await jsonPost("/api/players", {
      name: "Test",
      picks: [],
      tiebreaker: "",
    });
    expect(res.status).toBe(400);
  });
});

// =====================================================================
// Verify period validation
// =====================================================================
describe("Verify period validation", () => {
  it("rejects invalid period string", async () => {
    const res = await jsonPost("/api/verify", { period: "Q5" }, ADMIN_HEADERS);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("Invalid period");
  });

  it("rejects lowercase period", async () => {
    const res = await jsonPost("/api/verify", { period: "q1" }, ADMIN_HEADERS);
    expect(res.status).toBe(400);
  });

  it("rejects missing period", async () => {
    const res = await jsonPost("/api/verify", {}, ADMIN_HEADERS);
    expect(res.status).toBe(400);
  });
});

// =====================================================================
// GET endpoints return correct empty defaults
// =====================================================================
describe("Empty state defaults", () => {
  it("GET /api/events returns {} when KV is empty", async () => {
    const res = await jsonGet("/api/events");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("GET /api/players returns [] when KV is empty", async () => {
    const res = await jsonGet("/api/players");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

// =====================================================================
// Player delete is case-insensitive
// =====================================================================
describe("Player deletion", () => {
  it("deletes player by case-insensitive name match", async () => {
    // Add a player
    await jsonPost("/api/players", {
      name: "Alice",
      picks: VALID_PICKS,
      tiebreaker: "",
    });

    // Delete with different case
    const res = await jsonDelete(
      `/api/players/${encodeURIComponent("alice")}`,
      ADMIN_HEADERS,
    );
    expect(res.status).toBe(200);

    // Verify player is gone
    const playersRes = await jsonGet("/api/players");
    const players = await playersRes.json() as { name: string }[];
    expect(players).toHaveLength(0);
  });

  it("succeeds even when player doesn't exist (no-op)", async () => {
    const res = await jsonDelete(
      `/api/players/${encodeURIComponent("NonExistent")}`,
      ADMIN_HEADERS,
    );
    // Should succeed (filter produces same array, no error)
    expect(res.status).toBe(200);
  });
});

// =====================================================================
// Tiebreaker handling
// =====================================================================
describe("Tiebreaker edge cases", () => {
  it("stores trimmed tiebreaker", async () => {
    const res = await jsonPost("/api/players", {
      name: "Tiebreaker",
      picks: VALID_PICKS,
      tiebreaker: "  Chiefs 28, Eagles 24  ",
    });
    expect(res.status).toBe(201);
    const json = await res.json() as { player: { tiebreaker: string } };
    expect(json.player.tiebreaker).toBe("Chiefs 28, Eagles 24");
  });

  it("stores empty string when tiebreaker is omitted", async () => {
    const res = await jsonPost("/api/players", {
      name: "NoTiebreaker",
      picks: VALID_PICKS,
    });
    expect(res.status).toBe(201);
    const json = await res.json() as { player: { tiebreaker: string } };
    expect(json.player.tiebreaker).toBe("");
  });
});

// =====================================================================
// Per-Player KV Key Tests (P0 Race Condition Fix)
// =====================================================================
describe("Per-player KV atomicity", () => {
  it("concurrent submissions with different names both succeed", async () => {
    // Simulate concurrent submissions — both fire before either completes
    const [res1, res2] = await Promise.all([
      jsonPost("/api/players", {
        name: "Alice",
        picks: VALID_PICKS,
        tiebreaker: "Chiefs 28",
      }),
      jsonPost("/api/players", {
        name: "Bob",
        picks: VALID_PICKS,
        tiebreaker: "Eagles 24",
      }),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    // Both should appear in the player list
    const listRes = await jsonGet("/api/players");
    const players = await listRes.json() as { name: string }[];
    const names = players.map((p) => p.name.toLowerCase()).sort();
    expect(names).toEqual(["alice", "bob"]);
  });

  it("GET /api/players returns all players from per-player keys", async () => {
    // Submit 3 players through the API
    await jsonPost("/api/players", { name: "Alice", picks: VALID_PICKS, tiebreaker: "" });
    await jsonPost("/api/players", { name: "Bob", picks: VALID_PICKS, tiebreaker: "" });
    await jsonPost("/api/players", { name: "Charlie", picks: VALID_PICKS, tiebreaker: "" });

    const res = await jsonGet("/api/players");
    expect(res.status).toBe(200);
    const players = await res.json() as { name: string }[];
    expect(players).toHaveLength(3);
  });

  it("admin reset clears all per-player keys", async () => {
    // Submit players
    await jsonPost("/api/players", { name: "Alice", picks: VALID_PICKS, tiebreaker: "" });
    await jsonPost("/api/players", { name: "Bob", picks: VALID_PICKS, tiebreaker: "" });

    // Verify they exist
    let res = await jsonGet("/api/players");
    let players = await res.json() as { name: string }[];
    expect(players).toHaveLength(2);

    // Reset
    await jsonPost("/api/reset", {}, ADMIN_HEADERS);

    // Verify cleared
    res = await jsonGet("/api/players");
    players = await res.json() as { name: string }[];
    expect(players).toHaveLength(0);
  });

  it("delete removes only the targeted player key", async () => {
    await jsonPost("/api/players", { name: "Alice", picks: VALID_PICKS, tiebreaker: "" });
    await jsonPost("/api/players", { name: "Bob", picks: VALID_PICKS, tiebreaker: "" });

    // Delete Alice
    await jsonDelete(`/api/players/${encodeURIComponent("Alice")}`, ADMIN_HEADERS);

    // Bob should still exist
    const res = await jsonGet("/api/players");
    const players = await res.json() as { name: string }[];
    expect(players).toHaveLength(1);
    expect(players[0].name).toBe("Bob");
  });
});

// =====================================================================
// Submission lock tests
// =====================================================================
describe("Submission lock", () => {
  it("POST /api/players returns 403 when game is locked", async () => {
    await mockKV.put("sb-game-state", JSON.stringify({ gameId: "", periodsVerified: [], locked: true }));

    const res = await jsonPost("/api/players", {
      name: "Latecomer",
      picks: VALID_PICKS,
      tiebreaker: "",
    });
    expect(res.status).toBe(403);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("Submissions are closed");
  });

  it("POST /api/players succeeds when game is not locked", async () => {
    await mockKV.put("sb-game-state", JSON.stringify({ gameId: "", periodsVerified: [], locked: false }));

    const res = await jsonPost("/api/players", {
      name: "EarlyBird",
      picks: VALID_PICKS,
      tiebreaker: "",
    });
    expect(res.status).toBe(201);
  });

  it("POST /api/players succeeds when no game-state exists in KV (backwards compat)", async () => {
    const res = await jsonPost("/api/players", {
      name: "Default",
      picks: VALID_PICKS,
      tiebreaker: "",
    });
    expect(res.status).toBe(201);
  });

  it("POST /api/lock toggles lock state", async () => {
    // Start unlocked (no KV entry)
    const res1 = await jsonPost("/api/lock", {}, ADMIN_HEADERS);
    expect(res1.status).toBe(200);
    const json1 = await res1.json() as { locked: boolean };
    expect(json1.locked).toBe(true);

    // Toggle back
    const res2 = await jsonPost("/api/lock", {}, ADMIN_HEADERS);
    expect(res2.status).toBe(200);
    const json2 = await res2.json() as { locked: boolean };
    expect(json2.locked).toBe(false);
  });

  it("POST /api/lock requires admin auth", async () => {
    const res = await jsonPost("/api/lock", {});
    expect(res.status).toBe(401);
  });

  it("GET /api/game-state returns locked status without admin auth", async () => {
    await mockKV.put("sb-game-state", JSON.stringify({ gameId: "", periodsVerified: [], locked: true }));

    const res = await jsonGet("/api/game-state");
    expect(res.status).toBe(200);
    const json = await res.json() as { locked: boolean };
    expect(json.locked).toBe(true);
  });

  it("GET /api/game-state returns unlocked when no KV entry exists", async () => {
    const res = await jsonGet("/api/game-state");
    expect(res.status).toBe(200);
    const json = await res.json() as { locked: boolean };
    expect(json.locked).toBe(false);
  });

  it("Reset clears the lock", async () => {
    await mockKV.put("sb-game-state", JSON.stringify({ gameId: "", periodsVerified: [], locked: true }));

    await jsonPost("/api/reset", {}, ADMIN_HEADERS);

    const res = await jsonGet("/api/game-state");
    const json = await res.json() as { locked: boolean };
    expect(json.locked).toBe(false);
  });
});

// =====================================================================
// Tiebreaker length validation
// =====================================================================
describe("Tiebreaker length validation", () => {
  it("rejects tiebreaker exceeding MAX_TIEBREAKER_LENGTH", async () => {
    const res = await jsonPost("/api/players", {
      name: "LongTiebreaker",
      picks: VALID_PICKS,
      tiebreaker: "A".repeat(101),
    });
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("100 characters");
  });

  it("accepts tiebreaker at exactly MAX_TIEBREAKER_LENGTH", async () => {
    const res = await jsonPost("/api/players", {
      name: "ExactLength",
      picks: VALID_PICKS,
      tiebreaker: "A".repeat(100),
    });
    expect(res.status).toBe(201);
  });
});
