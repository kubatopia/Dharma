import type { TimeSlot } from "@dharma/types";
import type { CalendarProvider } from "@dharma/calendar-core";

// Mock provider returns a fixed set of busy slots for demo/testing
export class MockGoogleProvider implements CalendarProvider {
  async getEvents(_start: Date, _end: Date): Promise<TimeSlot[]> {
    const now = new Date();
    // Simulate a couple of busy blocks so the algo has something to work around
    return [
      {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0),
      },
      {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 15, 30),
      },
    ];
  }
}

export { RealGoogleProvider } from "./real";
