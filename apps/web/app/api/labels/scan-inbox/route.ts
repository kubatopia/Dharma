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

  const messages = await listRecentInboxMessages(
    googleCred.accessToken,
    googleCred.refreshToken,
    40
  );

  let labeled = 0;

  for (const msg of messages) {
    // First try keyword rules
    const ruleMatches = labels.filter((label) =>
      label.rules.some((rule) => {
        const haystack = (() => {
          switch (rule.field) {
            case "subject": return msg.subject.toLowerCase();
            case "from":    return msg.from.toLowerCase();
            case "body":    return msg.snippet.toLowerCase();
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
      })
    );

    // For labels without rules, use AI classification
    const labelsWithoutRules = labels.filter(
      (l) => !ruleMatches.find((m) => m.id === l.id) && l.rules.length === 0
    );

    let aiMatches: typeof labels = [];
    if (labelsWithoutRules.length > 0 && process.env.ANTHROPIC_API_KEY) {
      const aiLabelNames = await classifyEmailLabels(
        msg.subject,
        msg.from,
        msg.snippet,
        labelsWithoutRules.map((l) => ({ name: l.name, description: l.description }))
      );
      aiMatches = labelsWithoutRules.filter((l) => aiLabelNames.includes(l.name));
    }

    const allMatches = [...ruleMatches, ...aiMatches];
    const gmailIds = allMatches.map((l) => l.gmailLabelId!);

    if (gmailIds.length > 0) {
      try {
        await applyGmailLabels(googleCred.accessToken, googleCred.refreshToken, msg.id, gmailIds);
        labeled++;
      } catch (err) {
        console.error(`[scan-inbox] Failed to label message ${msg.id}:`, err);
      }
    }
  }

  return NextResponse.json({ scanned: messages.length, labeled });
}
