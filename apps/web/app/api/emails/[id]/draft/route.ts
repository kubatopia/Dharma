import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { makeAuthForUser, createDraft } from "../../../../../lib/gmail";
import { google } from "googleapis";

const TONE_INSTRUCTIONS: Record<string, string> = {
  "My Tone":
    "Write in a natural, professional but personal tone — direct, warm, not overly formal. Mirror the style of someone who has worked in business for years and writes clearly without corporate jargon.",
  Concise:
    "Write a brief, direct reply. No filler words, no pleasantries beyond a quick greeting. Get to the point in 2-4 sentences.",
  "Formal / Legal":
    "Write in formal, precise language appropriate for legal or official correspondence. Use complete sentences, avoid contractions, and maintain a professional distance.",
  "Casual / Friendly":
    "Write in a warm, conversational tone. It's okay to be a little informal — use contractions, keep it light and approachable.",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: messageId } = await params;
  const { tone } = await req.json() as { tone?: string };

  const userId = session.user.id;
  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!googleCred) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

  const { auth: oauthClient } = await makeAuthForUser(userId);
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  // Fetch the full email
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const msg = res.data;
  const headers = msg.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const from = get("From");
  const subject = get("Subject") || "(no subject)";
  const messageIdHeader = get("Message-ID");
  const references = get("References");
  const threadId = msg.threadId ?? messageId;

  // Extract plain text body
  function extractBody(payload: typeof msg.payload): string {
    if (!payload) return "";
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        const text = extractBody(part);
        if (text) return text;
      }
    }
    return "";
  }

  const body = extractBody(msg.payload) || msg.snippet || "";
  const toneKey = tone ?? "Concise";
  const toneInstruction = TONE_INSTRUCTIONS[toneKey] ?? TONE_INSTRUCTIONS.Concise;

  // Generate reply with Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const prompt = `${toneInstruction}

You are drafting a reply on behalf of Finley Underwood. Read the email below and write an appropriate reply draft. Do not include a subject line. End with just the name "Finley" — do not include a sign-off like "Best" or "Sincerely".

Email from: ${from}
Subject: ${subject}
Body:
${body.slice(0, 1500)}

Reply draft:`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeRes.ok) return NextResponse.json({ error: "Claude failed" }, { status: 500 });
  const claudeData = await claudeRes.json() as { content: Array<{ text: string }> };
  const replyBody = claudeData.content[0]?.text?.trim() ?? "";

  // Save as Gmail draft
  await createDraft(googleCred.accessToken, googleCred.refreshToken, {
    from: googleCred.email,
    to: from,
    subject,
    body: replyBody,
    threadId,
    inReplyTo: messageIdHeader,
    references,
  });

  return NextResponse.json({ ok: true });
}
