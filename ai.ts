import type { TimeSlot } from "../../types/src";
import { formatSlot } from "./index";

/**
 * generateAIReply
 *
 * Calls the Anthropic Messages API to produce a natural, tone-matched
 * reply to a scheduling request.
 *
 * The prompt is designed to:
 *  1. Give Claude the original request verbatim (so it can mirror tone/formality)
 *  2. Give it the formatted available slots as facts to embed
 *  3. Constrain the output to just the email body — no subject, no preamble
 *
 * Streaming design:
 *  This function returns an async generator that yields text chunks as they
 *  arrive from the API. The API route pipes this directly into a
 *  ReadableStream so the UI can display the reply word-by-word rather than
 *  waiting for the full response.
 *
 * Graceful degradation:
 *  If ANTHROPIC_API_KEY is missing, throws so the caller can fall back to
 *  the template reply. We never silently swallow the error — callers decide.
 */
export async function* generateAIReply(
  slots: TimeSlot[],
  schedulingRequest: string,
  timezone = "America/New_York"
): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const formattedSlots = slots.map((s) => `• ${formatSlot(s, timezone)}`).join("\n");

  const systemPrompt = `You write email replies on behalf of the user.

Rules:
- Write ONLY the email body. No subject line. No "Here is a reply:" preamble.
- Mirror the tone of the incoming request: casual request → casual reply, formal → formal.
- Keep it short — 2 to 4 sentences maximum.
- Include all the available time slots naturally in the text.
- End with a friendly call to action (e.g. "let me know what works").
- Do not sign off with a name — the user will add their own signature.`;

  const userMessage = `The person sent me this scheduling request:

"${schedulingRequest}"

I'm available at these times:
${formattedSlots}

Write a reply.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  // Parse the SSE stream and yield only the text delta chunks
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;

      try {
        const event = JSON.parse(data) as AnthropicStreamEvent;
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      } catch {
        // Malformed JSON in stream — skip and continue
      }
    }
  }
}

// ── Anthropic SSE event types (minimal subset we need) ────────────────────────

interface AnthropicStreamEvent {
  type: string;
  delta?: {
    type: string;
    text: string;
  };
}
