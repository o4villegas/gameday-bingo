import Anthropic from "@anthropic-ai/sdk";
import type { Period, EventVerification, VerificationResult } from "../../shared/types";
import { EVENTS } from "../../shared/constants";

const MODEL = "claude-sonnet-4-5-20250929" as const;
const MAX_PAUSE_RETRIES = 3;

/**
 * Run AI verification for a game period using Claude API with web search.
 * Claude reads ESPN data, searches the web for supplementary info, then
 * calls submit_verification with structured results.
 */
export async function verifyPeriod(
  apiKey: string,
  period: Period,
  gameData: string,
): Promise<VerificationResult> {
  const periodEvents = EVENTS.filter((e) => e.period === period);

  const eventsListText = periodEvents
    .map((e, i) => `${i + 1}. [${e.id}] ${e.name}`)
    .join("\n");

  const systemPrompt = `You are a Super Bowl LX verification agent for a prediction game. Today is Super Bowl Sunday, February 8, 2026. The game is Seattle Seahawks vs New England Patriots (ESPN Game ID: 401772988).

Your job is to determine which prediction events have occurred based on:
1. The ESPN game data provided by the user
2. Your own web searches for additional real-time information

RULES:
1. FIRST, read the ESPN data provided. This is your primary source for scoring plays, quarter scores, and statistical events.
2. THEN, use web search to find information about events the ESPN data might miss (e.g., Gatorade bath color, fake punts, specific trick plays, onside kicks, blocked kicks).
3. For each event, determine if it occurred (true/false) with a confidence level:
   - "high" = confirmed by multiple sources or clearly in the data
   - "medium" = one source suggests it, or can be inferred with reasonable certainty
   - "low" = data is ambiguous, not found, or cannot be confirmed
4. If neither the ESPN data nor web search confirms an event, mark it as NOT occurred with "low" confidence.
5. Do NOT guess. Only mark events as occurred if data supports it.
6. After your research, you MUST call the submit_verification tool with your results.

You are verifying period: ${period}

Events to check:
${eventsListText}`;

  const submitVerificationTool: Anthropic.Messages.Tool = {
    name: "submit_verification",
    description:
      "Submit the verification results for all events in this period. Call this ONCE after researching all events.",
    input_schema: {
      type: "object" as const,
      properties: {
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              eventId: {
                type: "string",
                description: "The event ID (e.g., q1_first_score_fg)",
              },
              eventName: {
                type: "string",
                description: "The event display name",
              },
              occurred: {
                type: "boolean",
                description: "Whether the event occurred",
              },
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
                description: "Confidence level in the determination",
              },
              reasoning: {
                type: "string",
                description:
                  "Brief explanation of why this determination was made",
              },
            },
            required: [
              "eventId",
              "eventName",
              "occurred",
              "confidence",
              "reasoning",
            ],
          },
        },
        summary: {
          type: "string",
          description:
            "Brief summary of relevant game activity for this period",
        },
      },
      required: ["events", "summary"],
    },
  };

  const tools: Anthropic.Messages.Tool[] = [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5,
    } as unknown as Anthropic.Messages.Tool,
    submitVerificationTool,
  ];

  const userMessage = `Here is the ESPN game data:\n\n${gameData}\n\nPlease verify each event for period ${period}. Use web search for any events the ESPN data doesn't cover (especially things like Gatorade bath color, trick plays, fake punts, etc.), then call submit_verification with your results.`;

  try {
    const client = new Anthropic({ apiKey });

    const messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 16384,
      system: systemPrompt,
      messages,
      tools,
    });

    // Agentic loop: handle pause_turn (web search still running) and
    // end_turn (done without calling our tool — fallback to text parsing)
    for (let i = 0; i < MAX_PAUSE_RETRIES; i++) {
      if (response.stop_reason === "tool_use") {
        // Check if it's our submit_verification tool
        const toolBlock = response.content.find(
          (b): b is Anthropic.Messages.ToolUseBlock =>
            b.type === "tool_use" && b.name === "submit_verification",
        );
        if (toolBlock) {
          return extractFromToolUse(toolBlock, period, periodEvents);
        }
        // It called some other tool (shouldn't happen) — break out
        break;
      }

      if (response.stop_reason === "end_turn") {
        // Claude finished without calling submit_verification — try text fallback
        break;
      }

      if (response.stop_reason === "pause_turn") {
        // Web search still running — feed partial response back to continue
        messages.push({ role: "assistant", content: response.content });
        response = await client.messages.create({
          model: MODEL,
          max_tokens: 16384,
          system: systemPrompt,
          messages,
          tools,
        });
        continue;
      }

      // Unknown stop reason — break
      break;
    }

    // Check one more time for tool_use in final response
    const finalToolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === "submit_verification",
    );
    if (finalToolBlock) {
      return extractFromToolUse(finalToolBlock, period, periodEvents);
    }

    // Fallback: parse text content as JSON
    const textContent = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return parseJsonFallback(textContent, period, periodEvents);
  } catch (err) {
    return {
      period,
      timestamp: Date.now(),
      events: [],
      summary: "Claude API call failed",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown Claude API error",
    };
  }
}

function extractFromToolUse(
  toolBlock: Anthropic.Messages.ToolUseBlock,
  period: Period,
  periodEvents: { id: string; name: string }[],
): VerificationResult {
  const input = toolBlock.input as {
    events?: Array<{
      eventId: string;
      eventName: string;
      occurred: boolean;
      confidence: string;
      reasoning: string;
    }>;
    summary?: string;
  };

  const validIds = new Set(periodEvents.map((e) => e.id));

  const events: EventVerification[] = (input.events || [])
    .filter((e) => validIds.has(e.eventId))
    .map((e) => ({
      eventId: e.eventId,
      eventName: e.eventName,
      occurred: Boolean(e.occurred),
      confidence: (["high", "medium", "low"].includes(e.confidence)
        ? e.confidence
        : "low") as "high" | "medium" | "low",
      reasoning: e.reasoning || "No reasoning provided",
    }));

  const missing = periodEvents.length - events.length;
  const summaryNote =
    missing > 0
      ? ` [WARNING: AI returned ${events.length}/${periodEvents.length} events — ${missing} not analyzed]`
      : "";

  return {
    period,
    timestamp: Date.now(),
    events,
    summary: (input.summary || "") + summaryNote,
    status: "completed",
  };
}

function parseJsonFallback(
  text: string,
  period: Period,
  periodEvents: { id: string; name: string }[],
): VerificationResult {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        period,
        timestamp: Date.now(),
        events: [],
        summary:
          "Claude did not call submit_verification tool or return valid JSON",
        status: "error",
        error: `Raw response: ${text.substring(0, 500)}`,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validIds = new Set(periodEvents.map((e) => e.id));

    const events: EventVerification[] = (parsed.events || [])
      .filter((e: Record<string, unknown>) =>
        validIds.has(String(e.eventId || "")),
      )
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
    const summaryNote =
      missing > 0
        ? ` [WARNING: AI returned ${events.length}/${periodEvents.length} events — ${missing} not analyzed]`
        : "";

    return {
      period,
      timestamp: Date.now(),
      events,
      summary: String(parsed.summary || "") + summaryNote,
      status: "completed",
    };
  } catch {
    return {
      period,
      timestamp: Date.now(),
      events: [],
      summary: "Failed to parse Claude response",
      status: "error",
      error: "Neither tool use nor JSON fallback succeeded",
    };
  }
}
