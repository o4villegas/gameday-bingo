import { describe, it, expect } from "vitest";
import { getPlayerPrizes } from "./prizes";
import type { Player, EventState } from "./types";

function makePlayer(picks: string[], name = "Test", tiebreaker = ""): Player {
  return { name, picks, tiebreaker, ts: Date.now() };
}

describe("getPlayerPrizes", () => {
  it("returns 0 correct and no prizes when no events hit", () => {
    const player = makePlayer(["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"]);
    const eventState: EventState = {};

    const result = getPlayerPrizes(player, eventState);

    expect(result.correctCount).toBe(0);
    expect(result.prizes).toEqual([]);
    expect(result.tabDiscount).toBe(0);
    expect(result.freeShells).toBe(0);
    expect(result.shells3).toBe(0);
  });

  it("calculates Tier 4 hit as 50% tab discount", () => {
    const player = makePlayer(["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"]);
    const eventState: EventState = { t4_overtime: true };

    const result = getPlayerPrizes(player, eventState);

    expect(result.correctCount).toBe(1);
    expect(result.tabDiscount).toBe(50);
    expect(result.prizes).toContain("50% off tab");
  });

  it("calculates Tier 3 hit as 20% tab discount", () => {
    const player = makePlayer(["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"]);
    const eventState: EventState = { t3_blocked_punt: true };

    const result = getPlayerPrizes(player, eventState);

    expect(result.correctCount).toBe(1);
    expect(result.tabDiscount).toBe(20);
    expect(result.prizes).toContain("20% off tab");
  });

  it("calculates Tier 2 hit as 1 free shell", () => {
    const player = makePlayer(["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"]);
    const eventState: EventState = { t2_safety: true };

    const result = getPlayerPrizes(player, eventState);

    expect(result.correctCount).toBe(1);
    expect(result.freeShells).toBe(1);
    expect(result.prizes).toContain("1 free YCI shell");
  });

  it("calculates Tier 1 hit as 1 $3 shell", () => {
    const player = makePlayer(["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"]);
    const eventState: EventState = { t1_pick_six: true };

    const result = getPlayerPrizes(player, eventState);

    expect(result.correctCount).toBe(1);
    expect(result.shells3).toBe(1);
    expect(result.prizes).toContain("1\u00D7 $3 YCI shell");
  });

  it("caps tab discount at 50% even with multiple tier 4 + tier 3 hits", () => {
    const player = makePlayer(["t4_overtime", "t4_punt_return_td", "t3_blocked_punt", "t2_safety", "t1_pick_six"]);
    const eventState: EventState = {
      t4_overtime: true,
      t4_punt_return_td: true,
      t3_blocked_punt: true,
    };

    const result = getPlayerPrizes(player, eventState);

    // 50 + 50 + 20 = 120, capped at 50
    expect(result.tabDiscount).toBe(50);
    expect(result.correctCount).toBe(3);
    expect(result.prizes).toContain("50% off tab");
  });

  it("stacks prizes from multiple tiers", () => {
    const player = makePlayer(["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"]);
    const eventState: EventState = {
      t4_overtime: true,
      t2_safety: true,
      t1_pick_six: true,
      t1_blowout: true,
    };

    const result = getPlayerPrizes(player, eventState);

    expect(result.correctCount).toBe(4);
    expect(result.tabDiscount).toBe(50);
    expect(result.freeShells).toBe(1);
    expect(result.shells3).toBe(2);
    expect(result.prizes).toHaveLength(3);
  });

  it("pluralizes shells correctly (2+ free shells)", () => {
    const player = makePlayer(["t2_safety", "t2_blocked_fg", "t2_margin_7", "t1_pick_six", "t1_blowout"]);
    const eventState: EventState = {
      t2_safety: true,
      t2_blocked_fg: true,
    };

    const result = getPlayerPrizes(player, eventState);

    expect(result.freeShells).toBe(2);
    expect(result.prizes).toContain("2 free YCI shells");
  });

  it("pluralizes $3 shells correctly (2+)", () => {
    const player = makePlayer(["t1_pick_six", "t1_blowout", "t1_missed_fg", "t2_safety", "t4_overtime"]);
    const eventState: EventState = {
      t1_pick_six: true,
      t1_blowout: true,
      t1_missed_fg: true,
    };

    const result = getPlayerPrizes(player, eventState);

    expect(result.shells3).toBe(3);
    expect(result.prizes).toContain("3\u00D7 $3 YCI shells");
  });

  it("only counts events the player actually picked", () => {
    const player = makePlayer(["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"]);
    // t4_ejection is hit but the player didn't pick it
    const eventState: EventState = {
      t4_ejection: true,
      t2_margin_7: true,
    };

    const result = getPlayerPrizes(player, eventState);

    expect(result.correctCount).toBe(0);
    expect(result.prizes).toEqual([]);
  });

  it("handles all 5 picks correct", () => {
    const player = makePlayer(["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"]);
    const eventState: EventState = {
      t4_overtime: true,
      t3_blocked_punt: true,
      t2_safety: true,
      t1_pick_six: true,
      t1_blowout: true,
    };

    const result = getPlayerPrizes(player, eventState);

    expect(result.correctCount).toBe(5);
    expect(result.tabDiscount).toBe(50); // 50+20 capped at 50
    expect(result.freeShells).toBe(1);
    expect(result.shells3).toBe(2);
  });

  it("preserves original player fields in result", () => {
    const player = makePlayer(
      ["t4_overtime", "t3_blocked_punt", "t2_safety", "t1_pick_six", "t1_blowout"],
      "Alice",
      "Chiefs 28, Eagles 21"
    );

    const result = getPlayerPrizes(player, {});

    expect(result.name).toBe("Alice");
    expect(result.tiebreaker).toBe("Chiefs 28, Eagles 21");
    expect(result.picks).toEqual(player.picks);
    expect(result.ts).toBe(player.ts);
  });
});
