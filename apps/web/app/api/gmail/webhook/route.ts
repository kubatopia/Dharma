import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getNewMessageIds, getMessage, createDraft, applyGmailLabels } from "../../../../lib/gmail";
import { classifyEmail, classifyEmailLabels } from "../../../../lib/classify";
import { getAvailableSlots } from "@dharma/calendar-core";
import { RealGoogleProvider } from "@dharma/providers-google";
import { generateReply, generateAIReply } from "@dharma/reply-generation";
import type { SchedulingRequest } from "@dharma/types";

// Pub/Sub sends a verification token in the URL when the subscription is created.
// Set PUBSUB_VERIFICATION_TOKEN to the same value used when creating the subscription.
function verifyToken(req: NextRequest): boolean {
  const expected = process.env.PUBSUB_VERIFICATION_TOKEN;
  if (!expected) return true; // token check disabled if env var not set
  return req.nextUrl.searchParams.get("token") === expected;
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Always return 200 to Pub/Sub — failures are logged and retries are prevented
  // by updating historyId before processing.
  let body: { message?: { data?: string } };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("OK", { status: 200 });
  }

  const messageData = body?.message?.data;
  if (!messageData) return new NextResponse("OK", { status: 200 });

  let notification: { emailAddress?: string; historyId?: string | number };
  try {
    const decoded = Buffer.from(messageData, "base64").toString("utf-8");
    notification = JSON.parse(decoded);
  } catch {
    return new NextResponse("OK", { status: 200 });
  }

  const emailAddress = notification.emailAddress;
  const newHistoryId = String(notification.historyId ?? "");

  if (!emailAddress || !newHistoryId) return new NextResponse("OK", { status: 200 });

  const googleCred = await prisma.googleCredential.findUnique({
    where: { email: emailAddress },
  });

  if (!googleCred?.gmailHistoryId) {
    console.warn(`[gmail/webhook] No historyId stored for ${emailAddress} — skipping`);
    return new NextResponse("OK", { status: 200 });
  }

  const startHistoryId = googleCred.gmailHistoryId;

  // Advance historyId immediately so retries don't reprocess the same messages
  await prisma.googleCredential.update({
    where: { email: emailAddress },
    data: { gmailHistoryId: newHistoryId },
  });

  let messageIds: string[];
  try {
    messageIds = await getNewMessageIds(
      googleCred.accessToken,
      googleCred.refreshToken,
      startHistoryId
    );
  } catch (err) {
    console.error("[gmail/webhook] history.list failed:", err);
    return new NextResponse("OK", { status: 200 });
  }

  console.log(`[gmail/webhook] ${messageIds.length} new message(s) for ${emailAddress}`);

  for (const messageId of messageIds) {
    try {
      const msg = await getMessage(
        googleCred.accessToken,
        googleCred.refreshToken,
        messageId,
        emailAddress
      );

      if (!msg) continue; // sent by the user themselves

      // Apply matching Gmail labels (rules first, then AI for labels without rules)
      try {
        const labels = await prisma.label.findMany({
          where: { userId: googleCred.userId, enabled: true, gmailLabelId: { not: null } },
          include: { rules: true },
        });

        const ruleMatches = labels.filter(
          (l) => l.rules.length > 0 && l.rules.some((rule) => matchesRule(rule, msg))
        );
        const labelsWithoutRules = labels.filter((l) => l.rules.length === 0);
        let aiMatches: typeof labels = [];
        if (labelsWithoutRules.length > 0 && process.env.ANTHROPIC_API_KEY) {
          const aiNames = await classifyEmailLabels(
            msg.subject, msg.from, msg.body,
            labelsWithoutRules.map((l) => ({ name: l.name, description: l.description }))
          );
          aiMatches = labelsWithoutRules.filter((l) => aiNames.includes(l.name));
        }

        const gmailIds = [...ruleMatches, ...aiMatches].map((l) => l.gmailLabelId!);
        if (gmailIds.length > 0) {
          await applyGmailLabels(googleCred.accessToken, googleCred.refreshToken, messageId, gmailIds);
          console.log(`[gmail/webhook] Labeled message ${messageId}:`, gmailIds);
        }
      } catch (err) {
        console.error("[gmail/webhook] Label application failed:", err);
      }

      const { isSchedulingRequest, durationMinutes } = await classifyEmail(
        msg.subject,
        msg.body
      );

      if (!isSchedulingRequest) {
        console.log(`[gmail/webhook] Not a scheduling request: "${msg.subject}"`);
        continue;
      }

      console.log(`[gmail/webhook] Scheduling request detected: "${msg.subject}" from ${msg.from}`);

      const request: SchedulingRequest = { rawText: msg.body, durationMinutes };

      const provider = new RealGoogleProvider(
        emailAddress,
        {
          accessToken: googleCred.accessToken,
          refreshToken: googleCred.refreshToken,
          expiresAt: googleCred.expiresAt,
        },
        async ({ accessToken, expiresAt }) => {
          await prisma.googleCredential.update({
            where: { email: emailAddress },
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
        } catch (err) {
          console.error("[gmail/webhook] AI reply failed, using template:", err);
          replyBody = generateReply(suggestedSlots);
        }
      } else {
        replyBody = generateReply(suggestedSlots);
      }

      await createDraft(googleCred.accessToken, googleCred.refreshToken, {
        from: emailAddress,
        to: msg.from,
        subject: msg.subject,
        body: replyBody,
        threadId: msg.threadId,
        inReplyTo: msg.messageIdHeader,
        references: msg.references,
      });

      console.log(`[gmail/webhook] Draft created for "${msg.subject}"`);
    } catch (err) {
      console.error(`[gmail/webhook] Failed to process message ${messageId}:`, err);
    }
  }

  return new NextResponse("OK", { status: 200 });
}

function matchesRule(
  rule: { field: string; operator: string; value: string },
  msg: { subject: string; from: string; body: string }
): boolean {
  const haystack = (() => {
    switch (rule.field) {
      case "subject": return msg.subject.toLowerCase();
      case "from":    return msg.from.toLowerCase();
      case "body":    return msg.body.toLowerCase();
      default:        return "";
    }
  })();
  const needle = rule.value.toLowerCase();
  switch (rule.operator) {
    case "contains":     return haystack.includes(needle);
    case "not_contains": return !haystack.includes(needle);
    case "starts_with":  return haystack.startsWith(needle);
    case "is":           return haystack === needle;
    default:             return false;
  }
}
