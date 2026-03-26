import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { decryptAppPassword } from "../../../lib/apple-crypto";
import { MockGoogleProvider } from "@dharma/providers-google";
import { RealGoogleProvider } from "@dharma/providers-google";
import { OutlookProvider } from "@dharma/providers-outlook";
import { AppleCalendarProvider } from "@dharma/providers-apple";
import { getAvailableSlots, MultiProvider, type CalendarProvider } from "@dharma/calendar-core";
import { generateReply, generateAIReply } from "@dharma/reply-generation";
import { prisma } from "../../../lib/prisma";
import type { SchedulingRequest } from "@dharma/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const request: SchedulingRequest = {
    rawText: body.rawText ?? "",
    durationMinutes: body.durationMinutes ?? 60,
  };

  // Load all credentials in parallel
  const [googleCred, microsoftCred, appleCred] = await Promise.all([
    prisma.googleCredential.findUnique({ where: { userId } }),
    prisma.microsoftCredential.findUnique({ where: { userId } }),
    prisma.appleCredential.findUnique({ where: { userId } }),
  ]);

  const providers: CalendarProvider[] = [];

  if (googleCred) {
    providers.push(
      new RealGoogleProvider(
        googleCred.email,
        {
          accessToken: googleCred.accessToken,
          refreshToken: googleCred.refreshToken,
          expiresAt: googleCred.expiresAt,
        },
        async ({ accessToken, expiresAt }) => {
          await prisma.googleCredential.update({
            where: { userId },
            data: { accessToken, expiresAt },
          });
        }
      )
    );
  }

  if (microsoftCred) {
    providers.push(
      new OutlookProvider(
        {
          accessToken: microsoftCred.accessToken,
          refreshToken: microsoftCred.refreshToken,
          expiresAt: microsoftCred.expiresAt,
        },
        async ({ accessToken, expiresAt }) => {
          await prisma.microsoftCredential.update({
            where: { userId },
            data: { accessToken, expiresAt },
          });
        }
      )
    );
  }

  if (appleCred) {
    try {
      const appPassword = decryptAppPassword(appleCred.encryptedAppPassword);
      providers.push(new AppleCalendarProvider(appleCred.appleId, appPassword));
    } catch (err) {
      console.error("[suggest-times] Failed to decrypt Apple credential:", err);
    }
  }

  const provider = providers.length > 0 ? new MultiProvider(providers) : new MockGoogleProvider();
  const isReal = providers.length > 0;

  const { slots } = await getAvailableSlots(provider, request);
  const suggestedSlots = slots.slice(0, 3);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      controller.enqueue(
        enc.encode(
          JSON.stringify({
            type: "slots",
            slots: suggestedSlots.map((s) => ({
              start: s.start.toISOString(),
              end: s.end.toISOString(),
            })),
            isReal,
          }) + "\n"
        )
      );

      const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

      if (hasApiKey && request.rawText.trim()) {
        try {
          for await (const chunk of generateAIReply(suggestedSlots, request.rawText)) {
            controller.enqueue(
              enc.encode(JSON.stringify({ type: "chunk", text: chunk }) + "\n")
            );
          }
        } catch (err) {
          console.error("[suggest-times] AI reply failed, using template:", err);
          const fallback = generateReply(suggestedSlots);
          controller.enqueue(
            enc.encode(JSON.stringify({ type: "chunk", text: fallback }) + "\n")
          );
        }
      } else {
        const template = generateReply(suggestedSlots);
        controller.enqueue(
          enc.encode(JSON.stringify({ type: "chunk", text: template }) + "\n")
        );
      }

      controller.enqueue(enc.encode(JSON.stringify({ type: "done" }) + "\n"));
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
