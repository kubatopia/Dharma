import type { TimeSlot, SchedulingRequest } from "@dharma/types";

export interface CalendarProvider {
  getEvents(start: Date, end: Date): Promise<TimeSlot[]>;
}

export async function getAvailableSlots(
  provider: CalendarProvider,
  request: SchedulingRequest
): Promise<{ slots: TimeSlot[] }> {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const busySlots = await provider.getEvents(now, twoWeeksOut);

  // Generate candidate slots (9am-5pm, weekdays only)
  const candidates: TimeSlot[] = [];
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(9);

  while (cursor < twoWeeksOut && candidates.length < 20) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const slotEnd = new Date(cursor.getTime() + request.durationMinutes * 60 * 1000);
      const overlaps = busySlots.some(
        (b) => cursor < b.end && slotEnd > b.start
      );
      if (!overlaps && slotEnd.getHours() <= 17) {
        candidates.push({ start: new Date(cursor), end: slotEnd });
      }
    }
    cursor.setTime(cursor.getTime() + 60 * 60 * 1000); // advance 1 hour
    if (cursor.getHours() >= 17) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(9, 0, 0, 0);
    }
  }

  return { slots: candidates };
}
