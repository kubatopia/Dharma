import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { listRecentInboxMessages, applyGmailLabels } from "../../../../lib/gmail";
import { classifyEmailLabels } from "../../../../lib/classify";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [googleCred, labels] = await Promise.all([
    prisma.googleCredential.findUnique({ where: { userId } }),
    prisma.label.findMany({
      where: { userId, enabled: true, gmailLabelId: { not: null } },
      include: { rules: true },
    }),
  ]);

  if (!googleCred) return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  if (!labels.length) return NextResponse.json({ labeled: 0, scanned: 0 });

  const messages = await listRecentInboxMessages(userId, 40);
  let labeled = 0;

  for (const msg of messages) {
    // Rule-based matches first
    const ruleMatches = labels.filter(
      (label) => label.rules.length > 0 && label.rules.some((rule) => {
        const haystack = rule.field === "subject" ? msg.subject.toLowerCase()
          : rule.field === "from" ? msg.from.toLowerCase()
          : msg.snippet.toLowerCase();
        const needle = rule.value.toLowerCase();
        switch (rule.operator) {
          case "contains":     return haystack.includes(needle);
          case "not_contains": return !haystack.includes(needle);
          case "starts_with":  return haystack.startsWith(needle);
          case "is":           return haystack === needle;
          default:             return false;
        }
      })
    );

    // AI classification for labels without rules
    const labelsWithoutRules = labels.filter(
      (l) => l.rules.length === 0 && !ruleMatches.find((m) => m.id === l.id)
    );
    let aiMatches: typeof labels = [];
    if (labelsWithoutRules.length > 0 && process.env.ANTHROPIC_API_KEY) {
      const aiNames = await classifyEmailLabels(
        msg.subject, msg.from, msg.snippet,
        labelsWithoutRules.map((l) => ({ name: l.name, description: l.description }))
      );
      aiMatches = labelsWithoutRules.filter((l) => aiNames.includes(l.name));
    }

    const gmailIds = [...ruleMatches, ...aiMatches].map((l) => l.gmailLabelId!);
    if (gmailIds.length > 0) {
      try {
        await applyGmailLabels(userId, msg.id, gmailIds);
        labeled++;
      } catch (err) {
        console.error(`[scan-inbox] Failed to label ${msg.id}:`, err);
      }
    }
  }

  return NextResponse.json({ scanned: messages.length, labeled });
}
