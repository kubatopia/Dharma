import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getNewMessageIds, getMessage, createDraft } from "../../../../lib/gmail";
import { classifyEmail, extractConfirmedTime } from "../../../../lib/classify";
import { createCalendarEvent } from "../../../../lib/calendar";
import { getAvailableSlots } from "@dharma/calendar-core";
import { RealGoogleProvider } from "@dharma/providers-google";
import { generateReply, generateAIReply } from "@dharma/reply-generation";
import type { SchedulingRequest } from "@dharma/types";

// Protected by CRON_SECRET so only the poller script (or Vercel Cron) can call it
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all users with a Gmail watch set up
  const creds = await prisma.googleCredential.findMany({
    where: { gmailHistoryId: { not: null } },
  });

  const results: Array<{ email: string; draftsCreated: number; eventsCreated: number; error?: string }> = [];

  for (const googleCred of creds) {
    const email = googleCred.email;
    let draftsCreated = 0;
    let eventsCreated = 0;

    try {
      // Use Gmail history API to get messages since the last poll
      const messageIds = await getNewMessageIds(
        googleCred.accessToken,
        googleCred.refreshToken,
        googleCred.gmailHistoryId!
      );

      // Get the current historyId from Gmail so we advance it even if no messages
      // We do this by fetching the profile
      const { google } = await import("googleapis");
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!
      );
      auth.setCredentials({
        access_token: googleCred.accessToken,
        refresh_token: googleCred.refreshToken,
      });
      const gmail = google.gmail({ version: "v1", auth });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const latestHistoryId = String(profile.data.historyId ?? googleCred.gmailHistoryId);

      // Advance historyId so next poll only sees newer messages
      await prisma.googleCredential.update({
        where: { email },
        data: { gmailHistoryId: latestHistoryId },
      });

      console.log(`[poll] ${email}: ${messageIds.length} new message(s)`);

      for (const messageId of messageIds) {
        try {
          const msg = await getMessage(
            googleCred.accessToken,
            googleCred.refreshToken,
            messageId,
            email
          );

          if (!msg) continue;

          const { isSchedulingRequest, isTimeConfirmation, durationMinutes } = await classifyEmail(
            msg.subject,
            msg.body
          );

          // ── Time confirmation → create calendar event ──────────────────────
          if (isTimeConfirmation) {
            console.log(`[poll] Time confirmation detected: "${msg.subject}" from ${msg.from}`);
            console.log(`[poll] Email body: ${msg.body.slice(0, 200)}`);
            const todayISO = new Date().toISOString().slice(0, 10);
            const meeting = await extractConfirmedTime(msg.subject, msg.body, todayISO);
            console.log(`[poll] Extracted meeting:`, JSON.stringify(meeting));

            if (meeting) {
              const senderEmail = msg.from.match(/<([^>]+)>/)?.[1] ?? msg.from.trim();
              const meetLink = await createCalendarEvent(
                googleCred.accessToken,
                googleCred.refreshToken,
                {
                  title: meeting.title,
                  startISO: meeting.startISO,
                  endISO: meeting.endISO,
                  attendeeEmail: senderEmail,
                  organizerEmail: email,
                }
              );
              eventsCreated++;
              console.log(`[poll] Calendar event created${meetLink ? ` — Meet: ${meetLink}` : ""}`);
            } else {
              console.log(`[poll] Could not extract time from confirmation email`);
            }
            continue;
          }

          if (!isSchedulingRequest) continue;

          console.log(`[poll] Scheduling request: "${msg.subject}" from ${msg.from}`);

          const request: SchedulingRequest = { rawText: msg.body, durationMinutes };

          const provider = new RealGoogleProvider(
            email,
            {
              accessToken: googleCred.accessToken,
              refreshToken: googleCred.refreshToken,
              expiresAt: googleCred.expiresAt,
            },
            async ({ accessToken, expiresAt }) => {
              await prisma.googleCredential.update({
                where: { email },
                data: { accessToken, expiresAt },
              });
            }
          );

          const { slots } = await getAvailableSlots(provider, request);
          const suggestedSlots = slots.slice(0, 3);

          let replyBody: string;
          if (process.env.ANTHROPIC_API_KEY && msg.body.trim()) {
            let text = "";
            try {
              for await (const chunk of generateAIReply(suggestedSlots, msg.body)) {
                text += chunk;
              }
              replyBody = text;
            } catch {
              replyBody = generateReply(suggestedSlots);
            }
          } else {
            replyBody = generateReply(suggestedSlots);
          }

          await createDraft(googleCred.accessToken, googleCred.refreshToken, {
            from: email,
            to: msg.from,
            subject: msg.subject,
            body: replyBody,
            threadId: msg.threadId,
            inReplyTo: msg.messageIdHeader,
            references: msg.references,
          });

          draftsCreated++;
          console.log(`[poll] Draft created for "${msg.subject}"`);
        } catch (err) {
          console.error(`[poll] Failed to process message ${messageId}:`, err);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[poll] Error processing ${email}:`, msg);
      results.push({ email, draftsCreated, eventsCreated, error: msg });
      continue;
    }

    results.push({ email, draftsCreated, eventsCreated });
  }

  return NextResponse.json({ polled: creds.length, results });
}
