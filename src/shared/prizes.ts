import type { Player, EventState, PlayerWithScore, Period } from "./types";
import { EVENTS } from "./constants";

const QUARTER_PERIODS: Period[] = ["Q1", "Q2", "Q3", "Q4"];

/**
 * Calculate a single player's score and prizes.
 *
 * Quarter shells: For each game quarter (Q1-Q4), if ANY of the player's
 * picks in that quarter are hit, they earn 1× $3 YCI shell.
 * Max 1 shell per quarter = max 4 shells total. FG period does NOT
 * award quarter shells (only counts toward correctCount).
 *
 * Rank/tabDiscount are set to null/0 here — call rankPlayers() to assign
 * top-3 placement after all players are scored.
 */
export function getPlayerScore(player: Player, eventState: EventState): PlayerWithScore {
  const correctCount = player.picks.filter((p) => eventState[p]).length;

  // Build a lookup: eventId → period
  const eventPeriodMap = new Map<string, Period>();
  for (const ev of EVENTS) {
    eventPeriodMap.set(ev.id, ev.period);
  }

  // Count quarters where at least one pick hit
  let quarterShells = 0;
  for (const qtr of QUARTER_PERIODS) {
    const hasHitInQuarter = player.picks.some(
      (pickId) => eventPeriodMap.get(pickId) === qtr && eventState[pickId]
    );
    if (hasHitInQuarter) quarterShells++;
  }

  const prizes: string[] = [];
  if (quarterShells > 0) {
    prizes.push(`${quarterShells}\u00D7 $3 YCI shell${quarterShells > 1 ? "s" : ""}`);
  }

  return {
    ...player,
    correctCount,
    quarterShells,
    rank: null,
    tabDiscount: 0,
    prizes,
  };
}

/**
 * Score all players and assign top-3 rankings.
 * Sorted by correctCount DESC, then ts ASC (earlier submission wins ties).
 * 1st = 20% off tab, 2nd = 15%, 3rd = 10%.
 *
 * Note: The tiebreaker field (predicted final score) is a free-text string
 * that cannot be automatically resolved without knowing the actual final score.
 * It is displayed in the admin player list for manual tie resolution by the admin.
 * The ts-based tiebreaker (earlier submission wins) is the automated fallback.
 */
export function rankPlayers(players: Player[], eventState: EventState): PlayerWithScore[] {
  const scored = players.map((p) => getPlayerScore(p, eventState));

  scored.sort((a, b) => {
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    return a.ts - b.ts;
  });

  const discounts = [20, 15, 10];

  for (let i = 0; i < scored.length; i++) {
    if (i < 3 && scored[i].correctCount > 0) {
      scored[i].rank = i + 1;
      scored[i].tabDiscount = discounts[i];
      scored[i].prizes.push(`${discounts[i]}% off tab (${ordinal(i + 1)} place)`);
    }
  }

  return scored;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}
