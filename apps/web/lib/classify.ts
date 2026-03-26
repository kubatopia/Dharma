async function callClaude(prompt: string, maxTokens = 80): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) return "";
  const data = (await response.json()) as { content: Array<{ text: string }> };
  return data.content[0]?.text ?? "";
}

function parseJSON<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export async function classifyEmail(
  subject: string,
  body: string
): Promise<{
  isSchedulingRequest: boolean;
  isTimeConfirmation: boolean;
  durationMinutes: number;
}> {
  const text = await callClaude(
    `Classify this email:\n\nSubject: ${subject}\nBody:\n${body.slice(0, 800)}\n\nReply with JSON only:\n{"isSchedulingRequest": boolean, "isTimeConfirmation": boolean, "durationMinutes": 30|60|90}\n\n- isSchedulingRequest: true if asking to schedule a meeting/call\n- isTimeConfirmation: true if confirming or agreeing to a specific time for a meeting`,
    100
  );

  return (
    parseJSON<{ isSchedulingRequest: boolean; isTimeConfirmation: boolean; durationMinutes: number }>(text) ?? {
      isSchedulingRequest: false,
      isTimeConfirmation: false,
      durationMinutes: 60,
    }
  );
}

export async function extractConfirmedTime(
  subject: string,
  body: string,
  todayISO: string
): Promise<{ startISO: string; endISO: string; title: string } | null> {
  const text = await callClaude(
    `Today's date is ${todayISO}. Extract the confirmed meeting time from this email.\n\nSubject: ${subject}\nBody:\n${body.slice(0, 800)}\n\nReply with JSON only (no explanation):\n{"startISO": "ISO8601 datetime with timezone offset", "endISO": "ISO8601 datetime with timezone offset", "title": "short meeting title"}\n\nIf no specific time can be extracted, reply: {"startISO": null}`,
    150
  );

  const parsed = parseJSON<{ startISO: string | null; endISO: string; title: string }>(text);
  if (!parsed?.startISO) return null;

  // Validate the dates
  const start = new Date(parsed.startISO);
  const end = new Date(parsed.endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  return { startISO: parsed.startISO, endISO: parsed.endISO, title: parsed.title };
}
