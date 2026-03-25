import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { MockGoogleProvider } from "../../../../packages/providers-google/src";
import { RealGoogleProvider } from "../../../../packages/providers-google/src/real";
import { getAvailableSlots } from "../../../../packages/calendar-core/src";
import { generateReply } from "../../../../packages/reply-generation/src";
import { generateAIReply } from "../../../../packages/reply-generation/src/ai";
import { prisma } from "../../../lib/prisma";
import type { SchedulingRequest } from "../../../../packages/types/src";

/**
 * POST /api/suggest-times
 *
 * Now session-aware. The credential lookup is scoped to session.user.id
 * so multiple users can use the app concurrently without seeing each
 * other's calendar data.
 *
 * If the user has no connected calendar we still return mock slots —
 * this lets them try the product before connecting.
 */
export async function POST(req: NextRequest) {
  // Auth guard — this route requires a signed-in session
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const request: SchedulingRequest = {
    rawText: body.rawText ?? "",
    durationMinutes: body.durationMinutes ?? 60,
  };

  // Scope credential lookup to this user
  const credential = await prisma.googleCredential.findUnique({
    where: { userId: session.user.id },
  });

  const provider = credential
    ? new RealGoogleProvider(credential.email)
    : new MockGoogleProvider();
  const isReal = !!credential;

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
