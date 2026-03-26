import type { TimeSlot } from "@dharma/types";
import { formatSlot } from "../index";

// Generates a short reply confirming a specific proposed time works.
export async function* generateConfirmationReply(
  slot: TimeSlot,
  originalRequest: string,
  timezone = "America/New_York"
): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const formatted = formatSlot(slot, timezone);

  const systemPrompt = `You write short email replies on behalf of the user.
Rules:
- Write ONLY the email body. No subject line. No preamble.
- Mirror the tone: casual request → casual reply, formal → formal.
- Confirm the proposed time works. Keep it 1–2 sentences.
- Do not sign off with a name.`;

  const userMessage = `The person proposed this time and asked if it works:\n\n"${originalRequest}"\n\nThe time ${formatted} is free on my calendar. Write a short reply confirming it works.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const event = JSON.parse(data) as { type: string; delta?: { type: string; text: string } };
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          yield event.delta.text;
        }
      } catch { /* skip malformed chunk */ }
    }
  }
}

export async function* generateAIReply(
  slots: TimeSlot[],
  schedulingRequest: string,
  timezone = "America/New_York",
  allOfferedTimesBusy = false
): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Always display the owner's available times in Eastern time so they read
  // naturally regardless of the sender's timezone.
  const ownerTimezone = "America/New_York";
  const formattedSlots = slots.map((s) => `• ${formatSlot(s, ownerTimezone)}`).join("\n");

  const systemPrompt = `You write email replies on behalf of the user.

Rules:
- Write ONLY the email body. No subject line. No "Here is a reply:" preamble.
- Mirror the tone of the incoming request: casual request → casual reply, formal → formal.
- Keep it short — 2 to 4 sentences maximum.
- Include all the available time slots naturally in the text. Times are in ET.
- End with a friendly call to action (e.g. "let me know what works").
- Do not sign off with a name — the user will add their own signature.
- NEVER claim the other person's proposed times "don't work" unless explicitly told they conflict.`;

  const conflict = allOfferedTimesBusy
    ? "Unfortunately those specific times don't work on my calendar, but"
    : "Here are some times that work on my end:";

  const userMessage = `The person sent me this scheduling request:\n\n"${schedulingRequest}"\n\n${conflict}\n${formattedSlots}\n\nWrite a reply.`;

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

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;

      try {
        const event = JSON.parse(data) as { type: string; delta?: { type: string; text: string } };
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          yield event.delta.text;
        }
      } catch {
        // malformed chunk — skip
      }
    }
  }
}
