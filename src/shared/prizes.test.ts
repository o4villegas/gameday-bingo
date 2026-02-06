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

// =====================================================================
// EDGE CASE: Player with empty picks array
// Failure mode: .filter() or .some() on empty array throws or
// returns unexpected values.
// =====================================================================
describe("Edge Case: Player with empty picks array", () => {
  it("scores 0 correct and 0 shells without crashing", () => {
    const player: Player = { name: "NoPicks", ts: 1000, tiebreaker: "", picks: [] };
    const eventState: EventState = { q1_opening_kick_td: true };

    const result = getPlayerScore(player, eventState);
    expect(result.correctCount).toBe(0);
    expect(result.quarterShells).toBe(0);
    expect(result.prizes).toEqual([]);
  });
});

// =====================================================================
// EDGE CASE: Player picks contain event IDs not in EVENTS constant
// Failure mode: eventPeriodMap.get(pickId) returns undefined, causing
// the .some() comparison `undefined === qtr` to never match. Player
// loses quarter shell credit for that pick. correctCount still works
// because it uses eventState[p] directly.
// =====================================================================
describe("Edge Case: Player picks with orphaned/unknown event IDs", () => {
  it("counts correctCount from eventState but not quarter shells for unknown IDs", () => {
    const player: Player = {
      name: "Orphan",
      ts: 1000,
      tiebreaker: "",
      picks: [
        "deleted_event_1", "deleted_event_2", // not in EVENTS
        "q2_pick_six", "q2_tied_halftime",
        "q3_first_drive_td", "q3_safety",
        "q4_overtime", "q4_pick_six",
        "fg_gatorade_orange", "fg_margin_3",
      ],
    };

    const eventState: EventState = {
      deleted_event_1: true, // truthy in state but not in EVENTS
      q2_pick_six: true,
    };

    const result = getPlayerScore(player, eventState);
    // deleted_event_1 is in eventState so correctCount includes it
    expect(result.correctCount).toBe(2);
    // But deleted_event_1 has no period mapping, so no shell for it
    // Only Q2 gets a shell from q2_pick_six
    expect(result.quarterShells).toBe(1);
  });

  it("does not crash when all picks are unknown IDs", () => {
    const player: Player = {
      name: "AllUnknown",
      ts: 1000,
      tiebreaker: "",
      picks: ["fake_1", "fake_2", "fake_3", "fake_4", "fake_5",
              "fake_6", "fake_7", "fake_8", "fake_9", "fake_10"],
    };

    const result = getPlayerScore(player, { fake_1: true, fake_5: true });
    expect(result.correctCount).toBe(2);
    expect(result.quarterShells).toBe(0);
  });
});

// =====================================================================
// EDGE CASE: eventState has `false` values explicitly set
// Failure mode: eventState[pickId] returns false (falsy), which is
// correct. But what if code checks `pickId in eventState` vs
// `eventState[pickId]`? The implementation uses `eventState[p]` which
// correctly handles explicit false.
// =====================================================================
describe("Edge Case: eventState with explicit false values", () => {
  it("does not count explicitly-false events as correct", () => {
    const player = makePlayer(fullPicks());
    const eventState: EventState = {
      q1_opening_kick_td: false,
      q1_first_score_fg: false,
      q2_pick_six: true,
    };

    const result = getPlayerScore(player, eventState);
    expect(result.correctCount).toBe(1); // only q2_pick_six
    expect(result.quarterShells).toBe(1); // only Q2
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

// =====================================================================
// EDGE CASE: Empty players array in rankPlayers
// Failure mode: Sorting or iterating empty array throws.
// =====================================================================
describe("Edge Case: rankPlayers with empty array", () => {
  it("returns empty array", () => {
    expect(rankPlayers([], {})).toEqual([]);
  });

  it("returns empty array even with populated eventState", () => {
    expect(rankPlayers([], { q1_opening_kick_td: true })).toEqual([]);
  });
});

// =====================================================================
// EDGE CASE: All players tied at 0 correct — nobody gets rank
// Failure mode: Rank is assigned despite correctCount being 0.
// The guard at prizes.ts:71 prevents this.
// =====================================================================
describe("Edge Case: All players at 0 correct", () => {
  it("assigns no ranks, no discounts, no prizes to anyone", () => {
    const players = [
      makePlayer(fullPicks(), "A", 1000),
      makePlayer(fullPicks(), "B", 2000),
      makePlayer(fullPicks(), "C", 3000),
    ];

    const result = rankPlayers(players, {});
    for (const p of result) {
      expect(p.rank).toBeNull();
      expect(p.tabDiscount).toBe(0);
      expect(p.prizes).toEqual([]);
      expect(p.correctCount).toBe(0);
      expect(p.quarterShells).toBe(0);
    }
  });
});

// =====================================================================
// EDGE CASE: Mixed ranking — some 0-correct among ranked players
// Failure mode: 0-correct player gets rank because they sort before
// a player with hits (e.g., earlier timestamp).
// =====================================================================
describe("Edge Case: Mixed ranking with 0-correct players", () => {
  it("only ranks players who have correctCount > 0", () => {
    const players = [
      // ZeroPicks submitted FIRST but picked events that won't hit
      makePlayer([
        "q1_safety_first_play", "q1_first_score_fg",
        "q2_tied_halftime", "q2_halftime_margin_14",
        "q3_no_points", "q3_lead_change",
        "q4_overtime", "q4_gw_field_goal",
        "fg_gatorade_blue", "fg_blowout",
      ], "ZeroPicks", 500),
      makePlayer(fullPicks(), "OnePick", 1000),
    ];

    const eventState: EventState = { q1_opening_kick_td: true };
    const result = rankPlayers(players, eventState);

    const onePick = result.find((p) => p.name === "OnePick")!;
    const zeroPick = result.find((p) => p.name === "ZeroPicks")!;

    expect(onePick.rank).toBe(1);
    expect(onePick.tabDiscount).toBe(20);
    expect(zeroPick.rank).toBeNull();
    expect(zeroPick.tabDiscount).toBe(0);
  });
});

// =====================================================================
// EDGE CASE: Single player with perfect score (all 10 correct)
// Failure mode: Counting overflows or prize string is malformed.
// =====================================================================
describe("Edge Case: Perfect score (all 10 picks correct)", () => {
  it("counts all 10 correct with 4 quarter shells", () => {
    const picks = fullPicks();
    const player = makePlayer(picks, "Perfect", 1000);

    const eventState: EventState = {};
    for (const p of picks) {
      eventState[p] = true;
    }

    const result = getPlayerScore(player, eventState);
    expect(result.correctCount).toBe(10);
    expect(result.quarterShells).toBe(4); // Q1+Q2+Q3+Q4 but NOT FG
  });
});
