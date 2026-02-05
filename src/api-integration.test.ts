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
          picks: ["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"],
          tiebreaker: "Chiefs 28, Eagles 24",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as { success: boolean; player: { name: string; picks: string[]; tiebreaker: string; ts: number } };
      expect(data.success).toBe(true);
      expect(data.player.name).toBe("TestPlayer");
      expect(data.player.picks).toHaveLength(5);
      expect(data.player.tiebreaker).toBe("Chiefs 28, Eagles 24");
      expect(data.player.ts).toBeGreaterThan(0);
    });

    it("rejects duplicate player names with 409", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TestPlayer",
          picks: ["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"],
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(409);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Name already taken");
    });

    it("rejects case-insensitive duplicate names", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TESTPLAYER",
          picks: ["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"],
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
          picks: ["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"],
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects wrong number of picks with 400", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TooFewPicks",
          picks: ["t4_overtime", "t3_blocked_punt"],
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid pick IDs with 400", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "BadPicks",
          picks: ["t4_overtime", "t3_blocked_punt", "t2_safety", "invalid_id", "t1_blowout"],
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toContain("Invalid pick ID");
    });

    it("trims player name whitespace", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "  Alice  ",
          picks: ["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"],
          tiebreaker: "",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as { player: { name: string } };
      expect(data.player.name).toBe("Alice");
    });

    it("handles optional tiebreaker (empty string)", async () => {
      const res = await fetch(`${BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "NoTiebreaker",
          picks: ["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"],
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as { player: { tiebreaker: string } };
      expect(data.player.tiebreaker).toBe("");
    });
  });

  // ===== PUT /api/events/:id =====
  describe("PUT /api/events/:id", () => {
    afterAll(async () => {
      await resetGame();
    });

    it("toggles an event ON with admin code", async () => {
      const res = await fetch(`${BASE}/api/events/t4_overtime`, {
        method: "PUT",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, boolean>;
      expect(data.t4_overtime).toBe(true);
    });

    it("toggles the same event OFF", async () => {
      const res = await fetch(`${BASE}/api/events/t4_overtime`, {
        method: "PUT",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, boolean>;
      expect(data.t4_overtime).toBe(false);
    });

    it("rejects toggle without admin code (401)", async () => {
      const res = await fetch(`${BASE}/api/events/t4_overtime`, {
        method: "PUT",
      });
      expect(res.status).toBe(401);
    });

    it("rejects toggle with wrong admin code (401)", async () => {
      const res = await fetch(`${BASE}/api/events/t4_overtime`, {
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
      await fetch(`${BASE}/api/events/t2_safety`, {
        method: "PUT",
        headers: adminHeaders(),
      });
      await fetch(`${BASE}/api/events/t1_pick_six`, {
        method: "PUT",
        headers: adminHeaders(),
      });

      const res = await fetch(`${BASE}/api/events`);
      const data = await res.json() as Record<string, boolean>;
      expect(data.t2_safety).toBe(true);
      expect(data.t1_pick_six).toBe(true);
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
          picks: ["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"],
          tiebreaker: "",
        }),
      });
    });

    it("deletes a player with admin code", async () => {
      const res = await fetch(`${BASE}/api/players/${encodeURIComponent("ToDelete")}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);

      // Verify player is gone
      const playersRes = await fetch(`${BASE}/api/players`);
      const players = await playersRes.json() as { name: string }[];
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
          picks: ["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"],
          tiebreaker: "",
        }),
      });
      await fetch(`${BASE}/api/events/t4_overtime`, {
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
});
