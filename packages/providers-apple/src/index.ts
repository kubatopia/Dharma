import type { TimeSlot } from "@dharma/types";
import type { CalendarProvider } from "@dharma/calendar-core";
import { createDAVClient } from "tsdav";

export class AppleCalendarProvider implements CalendarProvider {
  constructor(
    private readonly appleId: string,
    private readonly appPassword: string
  ) {}

  async getEvents(start: Date, end: Date): Promise<TimeSlot[]> {
    const client = await createDAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: {
        username: this.appleId,
        password: this.appPassword,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    const calendars = await client.fetchCalendars();
    const slots: TimeSlot[] = [];

    for (const calendar of calendars) {
      const objects = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });

      for (const obj of objects) {
        const icalData = obj.data as string | undefined;
        if (!icalData) continue;
        slots.push(...parseICalEvents(icalData));
      }
    }

    return slots;
  }
}

// ── iCal parser ───────────────────────────────────────────────────────────────
// Parses raw VCALENDAR strings returned by tsdav.
// Handles the three common DTSTART/DTEND formats:
//   20241201T140000Z   (UTC)
//   20241201T140000    (floating / calendar-local time)
//   20241201           (all-day date)

function parseICalEvents(icalData: string): TimeSlot[] {
  // Unfold lines: iCal allows splitting long lines with CRLF + space/tab
  const unfolded = icalData
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "");

  const vevents = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  const slots: TimeSlot[] = [];

  for (const vevent of vevents) {
    // Skip transparent (free/non-blocking) events
    if (/^TRANSP:TRANSPARENT/m.test(vevent)) continue;

    const startLine = vevent.match(/^DTSTART(?:;[^\r\n:]*)?:([^\r\n]+)/m)?.[1]?.trim();
    const endLine = vevent.match(/^DTEND(?:;[^\r\n:]*)?:([^\r\n]+)/m)?.[1]?.trim();

    if (!startLine || !endLine) continue;

    const start = parseICalDate(startLine);
    const end = parseICalDate(endLine);
    if (start && end) slots.push({ start, end });
  }

  return slots;
}

function parseICalDate(str: string): Date | null {
  const s = str.trim();

  // 20241201T140000Z — UTC datetime
  if (/^\d{8}T\d{6}Z$/.test(s)) {
    return new Date(
      `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`
    );
  }

  // 20241201T140000 — floating datetime (no timezone)
  if (/^\d{8}T\d{6}$/.test(s)) {
    return new Date(
      `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}`
    );
  }

  // 20241201 — all-day event
  if (/^\d{8}$/.test(s)) {
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
  }

  return null;
}
