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

// Maps common timezone abbreviations and city hints to IANA timezone strings.
// Uses regex rather than a Claude call to keep this fast and free.
export function detectTimezoneFromText(text: string): string {
  const t = text.toLowerCase();

  // Explicit abbreviations (check before city names to avoid false positives)
  if (/\b(et|est|edt|eastern time|eastern)\b/.test(t)) return "America/New_York";
  if (/\b(ct|cst|cdt|central time|central)\b/.test(t)) return "America/Chicago";
  if (/\b(mt|mst|mdt|mountain time|mountain)\b/.test(t)) return "America/Denver";
  if (/\b(pt|pst|pdt|pacific time|pacific)\b/.test(t)) return "America/Los_Angeles";
  if (/\b(at|ast|adt|atlantic time|atlantic)\b/.test(t)) return "America/Halifax";
  if (/\b(akt|akst|akdt|alaska)\b/.test(t)) return "America/Anchorage";
  if (/\b(hst|hawaii)\b/.test(t)) return "Pacific/Honolulu";
  if (/\b(gmt|utc)\b/.test(t)) return "UTC";
  if (/\b(bst|london|uk)\b/.test(t)) return "Europe/London";
  if (/\b(cet|amsterdam|paris|berlin|rome|amsterdam)\b/.test(t)) return "Europe/Paris";

  // City / region hints
  if (/san francisco|los angeles|seattle|portland|las vegas|san diego/.test(t)) return "America/Los_Angeles";
  if (/new york|boston|miami|atlanta|philadelphia|toronto|montreal/.test(t)) return "America/New_York";
  if (/chicago|dallas|houston|minneapolis|austin|new orleans/.test(t)) return "America/Chicago";
  if (/denver|salt lake|albuquerque|phoenix/.test(t)) return "America/Denver";

  return "America/New_York"; // default — owner is Eastern
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

// If the email proposes a specific meeting time (e.g. "does next tuesday 11AM ET work?"),
// returns that time so the poller can check it directly instead of suggesting slots.
export async function extractProposedTime(
  subject: string,
  body: string,
  todayISO: string
): Promise<{ startISO: string; endISO: string; durationMinutes: number } | null> {
  const text = await callClaude(
    `Today is ${todayISO}. Does this email propose a specific meeting time for the recipient to accept or decline?\n\nSubject: ${subject}\nBody:\n${body.slice(0, 600)}\n\nIf YES (a concrete date+time is named), reply JSON:\n{"startISO": "ISO8601 with tz offset", "endISO": "ISO8601 with tz offset", "durationMinutes": 30|60|90}\n\nIf the email only asks for general availability (no specific time given), reply:\n{"startISO": null}\n\nJSON only, no explanation.`,
    150
  );

  const parsed = parseJSON<{ startISO: string | null; endISO: string; durationMinutes: number }>(text);
  if (!parsed?.startISO) return null;

  const start = new Date(parsed.startISO);
  const end = new Date(parsed.endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  return { startISO: parsed.startISO, endISO: parsed.endISO, durationMinutes: parsed.durationMinutes ?? 30 };
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
