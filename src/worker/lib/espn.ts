import { ESPN_GAME_ID } from "../../shared/constants";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

/**
 * Fetch game summary from ESPN's semi-public JSON API.
 * Returns the full game summary including scoring, drives, and plays.
 */
export async function fetchGameData(gameId?: string): Promise<string> {
  const id = gameId || ESPN_GAME_ID;
  if (!id) {
    throw new Error("No ESPN game ID configured. Set ESPN_GAME_ID in constants.ts.");
  }

  const url = `${ESPN_BASE}/summary?event=${id}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`ESPN API returned ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  return extractRelevantData(data);
}

/**
 * Extract and compress the ESPN response into a format suitable for AI context.
 * Keeps scoring plays, quarter scores, key stats — drops unnecessary bulk.
 */
function extractRelevantData(data: Record<string, unknown>): string {
  const parts: string[] = [];

  // Scoring summary
  const scoringPlays = getNestedValue(data, "scoringPlays");
  if (Array.isArray(scoringPlays)) {
    parts.push("SCORING PLAYS:");
    for (const play of scoringPlays) {
      const p = play as Record<string, unknown>;
      const quarter = getNestedValue(p, "period.number") ?? "?";
      const clock = getNestedValue(p, "clock.displayValue") ?? "";
      const text = getNestedValue(p, "text") ?? getNestedValue(p, "shortText") ?? "";
      const score = getNestedValue(p, "homeScore") !== undefined
        ? `(${getNestedValue(p, "awayScore")}-${getNestedValue(p, "homeScore")})`
        : "";
      parts.push(`  Q${quarter} ${clock}: ${text} ${score}`);
    }
  }

  // Quarter-by-quarter scores
  const linescores = getNestedValue(data, "header.competitions.0.competitors");
  if (Array.isArray(linescores)) {
    parts.push("\nQUARTER SCORES:");
    for (const team of linescores) {
      const t = team as Record<string, unknown>;
      const name = getNestedValue(t, "team.abbreviation") ?? "???";
      const scores = getNestedValue(t, "linescores");
      if (Array.isArray(scores)) {
        const qScores = scores.map((s: unknown) => {
          const score = s as Record<string, unknown>;
          return getNestedValue(score, "displayValue") ?? "0";
        });
        parts.push(`  ${name}: ${qScores.join(" | ")} = ${getNestedValue(t, "score") ?? "?"}`);
      }
    }
  }

  // Game status
  const status = getNestedValue(data, "header.competitions.0.status.type.description");
  if (status) {
    parts.push(`\nGAME STATUS: ${status}`);
  }

  // Key stats / leaders
  const drives = getNestedValue(data, "drives.previous");
  if (Array.isArray(drives)) {
    parts.push(`\nTOTAL DRIVES: ${drives.length}`);
    const scoringDrives = drives.filter((d: unknown) => {
      const drive = d as Record<string, unknown>;
      return getNestedValue(drive, "isScore") === true;
    });
    parts.push(`SCORING DRIVES: ${scoringDrives.length}`);
  }

  if (parts.length === 0) {
    // Fallback: return raw JSON (truncated) if we couldn't parse structured data
    const raw = JSON.stringify(data);
    return raw.length > 12000 ? raw.substring(0, 12000) + "\n... [truncated]" : raw;
  }

  return parts.join("\n");
}

function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
