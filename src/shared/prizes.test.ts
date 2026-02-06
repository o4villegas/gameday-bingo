import { describe, it, expect } from "vitest";
import { getPlayerScore, rankPlayers } from "./prizes";
import type { Player, EventState } from "./types";

function makePlayer(picks: string[], name = "Test", ts = Date.now()): Player {
  return { name, picks, tiebreaker: "", ts };
}

// Helper: 2 picks per period (valid 10-pick set)
function fullPicks(): string[] {
  return [
    "q1_opening_kick_td", "q1_first_score_fg",
    "q2_pick_six", "q2_tied_halftime",
    "q3_first_drive_td", "q3_safety",
    "q4_overtime", "q4_pick_six",
    "fg_gatorade_orange", "fg_margin_3",
  ];
}

describe("getPlayerScore", () => {
  it("returns 0 correct and no prizes when no events hit", () => {
    const player = makePlayer(fullPicks());
    const result = getPlayerScore(player, {});

    expect(result.correctCount).toBe(0);
    expect(result.quarterShells).toBe(0);
    expect(result.prizes).toEqual([]);
    expect(result.rank).toBeNull();
    expect(result.tabDiscount).toBe(0);
  });

  it("awards 1 quarter shell when a Q1 pick hits", () => {
    const player = makePlayer(fullPicks());
    const eventState: EventState = { q1_opening_kick_td: true };

    const result = getPlayerScore(player, eventState);

    expect(result.correctCount).toBe(1);
    expect(result.quarterShells).toBe(1);
    expect(result.prizes).toContain("1\u00D7 $3 YCI shell");
  });

  it("awards only 1 shell per quarter even with 2 hits in same quarter", () => {
    const player = makePlayer(fullPicks());
    const eventState: EventState = {
      q1_opening_kick_td: true,
      q1_first_score_fg: true,
    };

    const result = getPlayerScore(player, eventState);

    expect(result.correctCount).toBe(2);
    expect(result.quarterShells).toBe(1); // still 1 — max 1 per quarter
  });

  it("awards shells across multiple quarters", () => {
    const player = makePlayer(fullPicks());
    const eventState: EventState = {
      q1_opening_kick_td: true,
      q2_pick_six: true,
      q3_safety: true,
      q4_overtime: true,
    };

    const result = getPlayerScore(player, eventState);

    expect(result.correctCount).toBe(4);
    expect(result.quarterShells).toBe(4); // max 4
    expect(result.prizes).toContain("4\u00D7 $3 YCI shells");
  });

  it("FG hits count for correctCount but NOT quarter shells", () => {
    const player = makePlayer(fullPicks());
    const eventState: EventState = {
      fg_gatorade_orange: true,
      fg_margin_3: true,
    };

    const result = getPlayerScore(player, eventState);

    expect(result.correctCount).toBe(2);
    expect(result.quarterShells).toBe(0); // FG doesn't award shells
    expect(result.prizes).toEqual([]);
  });

  it("only counts events the player actually picked", () => {
    const player = makePlayer(fullPicks());
    // Events that are hit but NOT in the player's picks
    const eventState: EventState = {
      q1_no_points: true,
      q2_halftime_margin_14: true,
    };

    const result = getPlayerScore(player, eventState);

    expect(result.correctCount).toBe(0);
    expect(result.quarterShells).toBe(0);
  });

  it("preserves original player fields", () => {
    const player = makePlayer(fullPicks(), "Alice", 1700000000000);
    player.tiebreaker = "Chiefs 28, Eagles 21";

    const result = getPlayerScore(player, {});

    expect(result.name).toBe("Alice");
    expect(result.tiebreaker).toBe("Chiefs 28, Eagles 21");
    expect(result.picks).toEqual(fullPicks());
    expect(result.ts).toBe(1700000000000);
  });

  it("pluralizes shells correctly for singular", () => {
    const player = makePlayer(fullPicks());
    const eventState: EventState = { q2_pick_six: true };

    const result = getPlayerScore(player, eventState);
    expect(result.prizes).toContain("1\u00D7 $3 YCI shell");
  });

  it("pluralizes shells correctly for plural", () => {
    const player = makePlayer(fullPicks());
    const eventState: EventState = {
      q1_opening_kick_td: true,
      q3_safety: true,
    };

    const result = getPlayerScore(player, eventState);
    expect(result.prizes).toContain("2\u00D7 $3 YCI shells");
  });
});

describe("rankPlayers", () => {
  it("ranks players by correctCount descending", () => {
    const eventState: EventState = {
      q1_opening_kick_td: true,
      q2_pick_six: true,
      q3_first_drive_td: true,
    };

    const players: Player[] = [
      makePlayer(["q1_opening_kick_td", "q1_first_score_fg", "q2_pick_six", "q2_tied_halftime", "q3_first_drive_td", "q3_safety", "q4_overtime", "q4_pick_six", "fg_gatorade_orange", "fg_margin_3"], "Alice", 1000),
      makePlayer(["q1_opening_kick_td", "q1_first_score_fg", "q2_pick_six", "q2_tied_halftime", "q3_safety", "q3_lead_change", "q4_overtime", "q4_pick_six", "fg_gatorade_orange", "fg_margin_3"], "Bob", 2000),
    ];

    const ranked = rankPlayers(players, eventState);

    // Alice has 3 correct (q1_opening_kick_td, q2_pick_six, q3_first_drive_td)
    // Bob has 2 correct (q1_opening_kick_td, q2_pick_six)
    expect(ranked[0].name).toBe("Alice");
    expect(ranked[0].correctCount).toBe(3);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].tabDiscount).toBe(20);

    expect(ranked[1].name).toBe("Bob");
    expect(ranked[1].correctCount).toBe(2);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[1].tabDiscount).toBe(15);
  });

  it("breaks ties by earlier timestamp", () => {
    const eventState: EventState = { q1_opening_kick_td: true };

    const players: Player[] = [
      makePlayer(["q1_opening_kick_td", "q1_first_score_fg", "q2_pick_six", "q2_tied_halftime", "q3_first_drive_td", "q3_safety", "q4_overtime", "q4_pick_six", "fg_gatorade_orange", "fg_margin_3"], "Late", 5000),
      makePlayer(["q1_opening_kick_td", "q1_first_score_fg", "q2_pick_six", "q2_tied_halftime", "q3_first_drive_td", "q3_safety", "q4_overtime", "q4_pick_six", "fg_gatorade_orange", "fg_margin_3"], "Early", 1000),
    ];

    const ranked = rankPlayers(players, eventState);

    expect(ranked[0].name).toBe("Early");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].name).toBe("Late");
    expect(ranked[1].rank).toBe(2);
  });

  it("assigns top 3 discounts correctly (20/15/10)", () => {
    const eventState: EventState = {
      q1_opening_kick_td: true,
      q2_pick_six: true,
      q3_first_drive_td: true,
    };

    const players: Player[] = [
      makePlayer(["q1_opening_kick_td", "q1_first_score_fg", "q2_pick_six", "q2_tied_halftime", "q3_first_drive_td", "q3_safety", "q4_overtime", "q4_pick_six", "fg_gatorade_orange", "fg_margin_3"], "First", 1000),
      makePlayer(["q1_opening_kick_td", "q1_first_score_fg", "q2_pick_six", "q2_tied_halftime", "q3_safety", "q3_lead_change", "q4_overtime", "q4_pick_six", "fg_gatorade_orange", "fg_margin_3"], "Second", 2000),
      makePlayer(["q1_opening_kick_td", "q1_first_score_fg", "q2_tied_halftime", "q2_no_turnovers_half", "q3_safety", "q3_lead_change", "q4_overtime", "q4_pick_six", "fg_gatorade_orange", "fg_margin_3"], "Third", 3000),
      makePlayer(["q1_first_score_fg", "q1_no_points", "q2_tied_halftime", "q2_no_turnovers_half", "q3_safety", "q3_lead_change", "q4_overtime", "q4_pick_six", "fg_gatorade_orange", "fg_margin_3"], "Fourth", 4000),
    ];

    const ranked = rankPlayers(players, eventState);

    expect(ranked[0].tabDiscount).toBe(20);
    expect(ranked[0].prizes).toContain("20% off tab (1st place)");

    expect(ranked[1].tabDiscount).toBe(15);
    expect(ranked[1].prizes).toContain("15% off tab (2nd place)");

    expect(ranked[2].tabDiscount).toBe(10);
    expect(ranked[2].prizes).toContain("10% off tab (3rd place)");

    expect(ranked[3].tabDiscount).toBe(0);
    expect(ranked[3].rank).toBeNull();
  });

  it("does not assign rank to players with 0 correct", () => {
    const eventState: EventState = {};
    const players: Player[] = [
      makePlayer(fullPicks(), "Nobody", 1000),
    ];

    const ranked = rankPlayers(players, eventState);

    expect(ranked[0].rank).toBeNull();
    expect(ranked[0].tabDiscount).toBe(0);
  });

  it("combines quarter shells and rank prizes in prizes array", () => {
    const eventState: EventState = {
      q1_opening_kick_td: true,
      q2_pick_six: true,
    };

    const players: Player[] = [
      makePlayer(["q1_opening_kick_td", "q1_first_score_fg", "q2_pick_six", "q2_tied_halftime", "q3_first_drive_td", "q3_safety", "q4_overtime", "q4_pick_six", "fg_gatorade_orange", "fg_margin_3"], "Winner", 1000),
    ];

    const ranked = rankPlayers(players, eventState);

    expect(ranked[0].prizes).toContain("2\u00D7 $3 YCI shells");
    expect(ranked[0].prizes).toContain("20% off tab (1st place)");
    expect(ranked[0].prizes).toHaveLength(2);
  });
});
