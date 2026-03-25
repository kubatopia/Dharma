import type { TimeSlot } from "@dharma/types";
import type { CalendarProvider } from "@dharma/calendar-core";

// Real Google Calendar provider — uses stored OAuth tokens to fetch actual events
export class RealGoogleProvider implements CalendarProvider {
  constructor(private email: string) {}

  async getEvents(start: Date, end: Date): Promise<TimeSlot[]> {
    // TODO: implement real Google Calendar API call using this.email
    // For now falls back to empty (no busy blocks = all slots open)
    console.log(`[RealGoogleProvider] Fetching events for ${this.email} from ${start} to ${end}`);
    return [];
  }
}
