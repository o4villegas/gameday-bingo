import type { Period, EventVerification, VerificationResult } from "../../shared/types";
import { EVENTS } from "../../shared/constants";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

/**
 * Run AI verification for a game period.
 * Takes ESPN game data (or manual text) and determines which events occurred.
 */
export async function verifyPeriod(
  ai: Ai,
  period: Period,
  gameData: string,
): Promise<VerificationResult> {
  const periodEvents = EVENTS.filter((e) => e.period === period);

  const eventsListText = periodEvents
    .map((e, i) => `${i + 1}. [${e.id}] ${e.name}`)
    .join("\n");

  const systemPrompt = `You are a Super Bowl LX verification agent. Your job is to determine which prediction events have occurred based on the provided game data.

RULES:
1. Analyze the game data carefully and match it against each event.
2. For each event, determine if it occurred (true/false) with a confidence level.
3. If the data does not clearly confirm an event, mark it as NOT occurred with "low" confidence.
4. Do NOT guess. Only mark events as occurred if the data supports it.
5. Respond with ONLY a valid JSON object — no markdown, no explanation outside the JSON.

You are verifying period: ${period}

Events to check:
${eventsListText}

Respond in this exact JSON format:
{
  "events": [
    { "eventId": "the_event_id", "eventName": "Event Name", "occurred": false, "confidence": "high", "reasoning": "Brief explanation" }
  ],
  "summary": "Brief summary of relevant game activity for this period."
}`;

  try {
    const response = await ai.run(MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here is the game data:\n\n${gameData}` },
      ],
      max_tokens: 4096,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    // Workers AI response can be: string | { response: string | object } | { request_id: string }
    // The response.response field may be a string OR an already-parsed object
    let text: string;
    if (typeof response === "string") {
      text = response;
    } else if (response && typeof response === "object" && "response" in response) {
      const inner = (response as Record<string, unknown>).response;
      text = typeof inner === "string" ? inner : JSON.stringify(inner);
    } else {
      text = JSON.stringify(response);
    }
    return parseAiResponse(text, period, periodEvents);
  } catch (err) {
    return {
      period,
      timestamp: Date.now(),
      events: [],
      summary: "AI inference failed",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown AI error",
    };
  }
}

function parseAiResponse(
  text: string,
  period: Period,
  periodEvents: { id: string; name: string }[],
): VerificationResult {
  try {
    // Extract JSON from response (model may wrap in markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        period,
        timestamp: Date.now(),
        events: [],
        summary: "AI did not return valid JSON",
        status: "error",
        error: `Raw response: ${text.substring(0, 500)}`,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validIds = new Set(periodEvents.map((e) => e.id));

    const events: EventVerification[] = (parsed.events || [])
      .filter((e: Record<string, unknown>) => validIds.has(String(e.eventId || "")))
      .map((e: Record<string, unknown>) => ({
        eventId: String(e.eventId),
        eventName: String(e.eventName || ""),
        occurred: Boolean(e.occurred),
        confidence: (["high", "medium", "low"].includes(String(e.confidence))
          ? String(e.confidence)
          : "low") as "high" | "medium" | "low",
        reasoning: String(e.reasoning || "No reasoning provided"),
      }));

    const missing = periodEvents.length - events.length;
    const summaryNote = missing > 0
      ? ` [WARNING: AI returned ${events.length}/${periodEvents.length} events — ${missing} not analyzed]`
      : "";

    return {
      period,
      timestamp: Date.now(),
      events,
      summary: String(parsed.summary || "") + summaryNote,
      status: "completed",
    };
  } catch (err) {
    return {
      period,
      timestamp: Date.now(),
      events: [],
      summary: "Failed to parse AI response",
      status: "error",
      error: err instanceof Error ? err.message : "Parse error",
    };
  }
}
