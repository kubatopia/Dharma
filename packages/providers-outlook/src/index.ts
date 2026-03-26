import type { TimeSlot } from "@dharma/types";
import type { CalendarProvider } from "@dharma/calendar-core";

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface GraphEvent {
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  showAs?: string;
}

interface GraphResponse {
  value: GraphEvent[];
  "@odata.nextLink"?: string;
}

export class OutlookProvider implements CalendarProvider {
  private accessToken: string;

  constructor(
    private tokens: OutlookTokens,
    private readonly onTokenRefreshed?: (t: { accessToken: string; expiresAt: Date }) => Promise<void>
  ) {
    this.accessToken = tokens.accessToken;
  }

  private async ensureFreshToken(): Promise<void> {
    if (this.tokens.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) return;

    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          refresh_token: this.tokens.refreshToken,
          scope: "Calendars.Read User.Read offline_access",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Microsoft token refresh failed: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);
    this.tokens.expiresAt = newExpiry;

    if (this.onTokenRefreshed) {
      await this.onTokenRefreshed({ accessToken: this.accessToken, expiresAt: newExpiry });
    }
  }

  async getEvents(start: Date, end: Date): Promise<TimeSlot[]> {
    await this.ensureFreshToken();

    const slots: TimeSlot[] = [];
    let url: string | undefined =
      `https://graph.microsoft.com/v1.0/me/calendarView?` +
      new URLSearchParams({
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        $select: "start,end,showAs",
        $top: "100",
      }).toString();

    // Follow @odata.nextLink pages
    while (url) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Microsoft Graph error ${response.status}: ${text}`);
      }

      const data = await response.json() as GraphResponse;

      for (const event of data.value) {
        // Skip events marked as free
        if (event.showAs === "free") continue;

        // Graph returns ISO 8601 without a timezone offset — treat as UTC
        const startStr = event.start.dateTime;
        const endStr = event.end.dateTime;
        slots.push({
          start: new Date(startStr.endsWith("Z") ? startStr : `${startStr}Z`),
          end: new Date(endStr.endsWith("Z") ? endStr : `${endStr}Z`),
        });
      }

      url = data["@odata.nextLink"];
    }

    return slots;
  }
}
