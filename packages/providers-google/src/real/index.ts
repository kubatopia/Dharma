import type { TimeSlot } from "@dharma/types";
import type { CalendarProvider } from "@dharma/calendar-core";
import { google } from "googleapis";

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class RealGoogleProvider implements CalendarProvider {
  constructor(
    private readonly email: string,
    private readonly tokens: GoogleTokens,
    private readonly onTokenRefreshed?: (t: { accessToken: string; expiresAt: Date }) => Promise<void>
  ) {}

  async getEvents(start: Date, end: Date): Promise<TimeSlot[]> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: this.tokens.accessToken,
      refresh_token: this.tokens.refreshToken,
      expiry_date: this.tokens.expiresAt.getTime(),
    });

    // Persist new tokens whenever googleapis refreshes them automatically
    oauth2Client.on("tokens", async (newTokens) => {
      if (newTokens.access_token && this.onTokenRefreshed) {
        await this.onTokenRefreshed({
          accessToken: newTokens.access_token,
          expiresAt: new Date(newTokens.expiry_date ?? Date.now() + 3600 * 1000),
        });
      }
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busyPeriods = response.data.calendars?.["primary"]?.busy ?? [];

    return busyPeriods.map((period) => ({
      start: new Date(period.start!),
      end: new Date(period.end!),
    }));
  }
}
