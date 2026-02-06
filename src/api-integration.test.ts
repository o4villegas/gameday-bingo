import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE = "http://localhost:5199";
const ADMIN_CODE = "kava60";

function adminHeaders(): Record<string, string> {
  return { "X-Admin-Code": ADMIN_CODE };
}

async function resetGame() {
  await fetch(`${BASE}/api/reset`, {
    method: "POST",
    headers: adminHeaders(),
  });
}

// Valid 10-pick array: exactly 2 per period (Q1, Q2, Q3, Q4, FG)
const VALID_PICKS = [
  "q1_opening_kick_td",
  "q1_first_score_fg",
  "q2_pick_six",
  "q2_50yd_fg",
  "q3_first_drive_td",
  "q3_no_points",
  "q4_2pt_attempted",
  "q4_overtime",
  "fg_gatorade_orange",
  "fg_margin_3",
];

describe("API Integration Tests", () => {
  beforeAll(async () => {
    // Ensure clean state
    await resetGame();
  });

  afterAll(async () => {
    await resetGame();
  });

  // ===== GET /api/events =====
  describe("GET /api/events", () => {
    it("returns empty object initially", async () => {
      const res = await fetch(`${BASE}/api/events`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({});
    });
  });

  // ===== GET /api/players =====
  describe("GET /api/players", () => {
    it("returns empty array initially", async () => {
      const res = await fetch(`${BASE}/api/players`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });
  });

  // ===== POST /api/players =====
  describe("POST /api/players", () => {
    afterAll(async () => {
      await resetGame();
    });

    it("creates a player with valid picks", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TestPlayer",
          picks: VALID_PICKS,
          tiebreaker: "Chiefs 28, Eagles 24",
        }),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as {
        success: boolean;
        player: { name: string; picks: string[]; tiebreaker: string; ts: number };
      };
      expect(data.success).toBe(true);
      expect(data.player.name).toBe("TestPlayer");
      expect(data.player.picks).toHaveLength(10);
      expect(data.player.tiebreaker).toBe("Chiefs 28, Eagles 24");
      expect(data.player.ts).toBeGreaterThan(0);
    });

    it("rejects duplicate player names with 409", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TestPlayer",
          picks: VALID_PICKS,
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(409);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Name already taken");
    });

    it("rejects case-insensitive duplicate names", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TESTPLAYER",
          picks: VALID_PICKS,
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(409);
    });

    it("rejects empty name with 400", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "  ",
          picks: VALID_PICKS,
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects wrong number of picks with 400", async () => {
      // Too few: only 2 picks
      const res2 = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TooFewPicks",
          picks: ["q1_opening_kick_td", "q2_pick_six"],
          tiebreaker: "",
        }),
      });
      expect(res2.status).toBe(400);

      // Still wrong: 5 picks (old max)
      const res5 = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "FivePicks",
          picks: [
            "q1_opening_kick_td",
            "q1_first_score_fg",
            "q2_pick_six",
            "q2_50yd_fg",
            "q3_first_drive_td",
          ],
          tiebreaker: "",
        }),
      });
      expect(res5.status).toBe(400);
    });

    it("rejects invalid pick IDs with 400", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "BadPicks",
          picks: [
            "q1_opening_kick_td",
            "q1_first_score_fg",
            "q2_pick_six",
            "q2_50yd_fg",
            "q3_first_drive_td",
            "q3_no_points",
            "q4_2pt_attempted",
            "q4_overtime",
            "fg_gatorade_orange",
            "invalid_id",
          ],
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Invalid pick ID");
    });

    it("trims player name whitespace", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "  Alice  ",
          picks: VALID_PICKS,
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as { player: { name: string } };
      expect(data.player.name).toBe("Alice");
    });

    it("handles optional tiebreaker (empty string)", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "NoTiebreaker",
          picks: VALID_PICKS,
        }),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as { player: { tiebreaker: string } };
      expect(data.player.tiebreaker).toBe("");
    });

    it("rejects duplicate pick IDs with 400", async () => {
      // 10 picks but with duplicates — same ID repeated in each period
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "DupePicks",
          picks: [
            "q1_opening_kick_td",
            "q1_opening_kick_td",
            "q2_pick_six",
            "q2_pick_six",
            "q3_first_drive_td",
            "q3_first_drive_td",
            "q4_2pt_attempted",
            "q4_2pt_attempted",
            "fg_gatorade_orange",
            "fg_gatorade_orange",
          ],
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Duplicate");
    });

    it("rejects wrong picks-per-period count with 400", async () => {
      // 10 picks total but 3 from Q1, 1 from Q2, 2 from Q3, 2 from Q4, 2 from FG
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "BadPeriodCounts",
          picks: [
            "q1_opening_kick_td",
            "q1_first_score_fg",
            "q1_no_points",       // 3rd Q1 pick — too many
            "q2_pick_six",         // only 1 Q2 pick — too few
            "q3_first_drive_td",
            "q3_no_points",
            "q4_2pt_attempted",
            "q4_overtime",
            "fg_gatorade_orange",
            "fg_margin_3",
          ],
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("per period");
    });
  });

  // ===== PUT /api/events/:id =====
  describe("PUT /api/events/:id", () => {
    afterAll(async () => {
      await resetGame();
    });

    it("toggles an event ON with admin code", async () => {
      const res = await fetch(`${BASE}/api/events/q4_overtime`, {
        method: "PUT",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, boolean>;
      expect(data.q4_overtime).toBe(true);
    });

    it("toggles the same event OFF", async () => {
      const res = await fetch(`${BASE}/api/events/q4_overtime`, {
        method: "PUT",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, boolean>;
      expect(data.q4_overtime).toBe(false);
    });

    it("rejects toggle without admin code (401)", async () => {
      const res = await fetch(`${BASE}/api/events/q4_overtime`, {
        method: "PUT",
      });
      expect(res.status).toBe(401);
    });

    it("rejects toggle with wrong admin code (401)", async () => {
      const res = await fetch(`${BASE}/api/events/q4_overtime`, {
        method: "PUT",
        headers: { "X-Admin-Code": "wrong-code" },
      });
      expect(res.status).toBe(401);
    });

    it("rejects invalid event ID (400)", async () => {
      const res = await fetch(`${BASE}/api/events/invalid_event`, {
        method: "PUT",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(400);
    });

    it("persists event state across requests", async () => {
      await fetch(`${BASE}/api/events/q3_safety`, {
        method: "PUT",
        headers: adminHeaders(),
      });
      await fetch(`${BASE}/api/events/q4_pick_six`, {
        method: "PUT",
        headers: adminHeaders(),
      });

      const res = await fetch(`${BASE}/api/events`);
      const data = (await res.json()) as Record<string, boolean>;
      expect(data.q3_safety).toBe(true);
      expect(data.q4_pick_six).toBe(true);
    });
  });

  // ===== DELETE /api/players/:name =====
  describe("DELETE /api/players/:name", () => {
    beforeAll(async () => {
      await resetGame();
      await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "ToDelete",
          picks: VALID_PICKS,
          tiebreaker: "",
        }),
      });
    });

    it("deletes a player with admin code", async () => {
      const res = await fetch(
        `${BASE}/api/players/${encodeURIComponent("ToDelete")}`,
        {
          method: "DELETE",
          headers: adminHeaders(),
        }
      );
      expect(res.status).toBe(200);

      // Verify player is gone
      const playersRes = await fetch(`${BASE}/api/players`);
      const players = (await playersRes.json()) as { name: string }[];
      expect(players.find((p) => p.name === "ToDelete")).toBeUndefined();
    });

    it("rejects delete without admin code (401)", async () => {
      const res = await fetch(`${BASE}/api/players/SomeName`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });
  });

  // ===== POST /api/reset =====
  describe("POST /api/reset", () => {
    beforeAll(async () => {
      // Add some data
      await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "ResetTestPlayer",
          picks: VALID_PICKS,
          tiebreaker: "",
        }),
      });
      await fetch(`${BASE}/api/events/q4_overtime`, {
        method: "PUT",
        headers: adminHeaders(),
      });
    });

    it("rejects reset without admin code (401)", async () => {
      const res = await fetch(`${BASE}/api/reset`, { method: "POST" });
      expect(res.status).toBe(401);
    });

    it("clears all data with admin code", async () => {
      const res = await fetch(`${BASE}/api/reset`, {
        method: "POST",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);

      const eventsRes = await fetch(`${BASE}/api/events`);
      const events = await eventsRes.json();
      expect(events).toEqual({});

      const playersRes = await fetch(`${BASE}/api/players`);
      const players = await playersRes.json();
      expect(players).toEqual([]);
    });
  });

  // ===== Verification Endpoints =====
  describe("Verification Endpoints", () => {
    // These tests verify the endpoints exist and require admin auth.
    // Full AI verification testing requires Workers AI binding (not available in test).

    it("POST /api/verify requires admin auth", async () => {
      const res = await fetch(`${BASE}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: "Q1" }),
      });
      expect(res.status).toBe(401);
    });

    it("GET /api/verify/status requires admin auth", async () => {
      const res = await fetch(`${BASE}/api/verify/status`);
      expect(res.status).toBe(401);
    });

    it("POST /api/verify/approve requires admin auth", async () => {
      const res = await fetch(`${BASE}/api/verify/approve`, {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });

    it("POST /api/verify/dismiss requires admin auth", async () => {
      const res = await fetch(`${BASE}/api/verify/dismiss`, {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });
  });
});
