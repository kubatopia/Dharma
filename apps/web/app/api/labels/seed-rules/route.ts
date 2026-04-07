import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { createGmailLabel } from "../../../../lib/gmail";

// Default keyword rules per label name.
// Each rule only gets added if the label has zero rules already.
const DEFAULT_RULES: Record<string, Array<{ field: string; operator: string; value: string }>> = {
  Legal: [
    { field: "subject", operator: "contains", value: "contract" },
    { field: "subject", operator: "contains", value: "agreement" },
    { field: "subject", operator: "contains", value: "NDA" },
    { field: "subject", operator: "contains", value: "legal" },
    { field: "subject", operator: "contains", value: "compliance" },
    { field: "subject", operator: "contains", value: "W-9" },
    { field: "subject", operator: "contains", value: "invoice" },
    { field: "subject", operator: "contains", value: "filing" },
    { field: "body",    operator: "contains", value: "pursuant to" },
    { field: "body",    operator: "contains", value: "signature required" },
  ],
  "Follow-up": [
    { field: "subject", operator: "contains", value: "follow up" },
    { field: "subject", operator: "contains", value: "following up" },
    { field: "subject", operator: "contains", value: "checking in" },
    { field: "subject", operator: "contains", value: "touching base" },
    { field: "subject", operator: "contains", value: "circling back" },
    { field: "subject", operator: "contains", value: "reminder" },
    { field: "body",    operator: "contains", value: "just checking in" },
  ],
  Urgent: [
    { field: "subject", operator: "contains", value: "urgent" },
    { field: "subject", operator: "contains", value: "ASAP" },
    { field: "subject", operator: "contains", value: "time-sensitive" },
    { field: "subject", operator: "contains", value: "deadline" },
    { field: "subject", operator: "contains", value: "action required" },
    { field: "subject", operator: "contains", value: "immediately" },
  ],
  Closing: [
    { field: "subject", operator: "contains", value: "closing" },
    { field: "subject", operator: "contains", value: "final agreement" },
    { field: "subject", operator: "contains", value: "signed" },
    { field: "subject", operator: "contains", value: "executed" },
    { field: "body",    operator: "contains", value: "deal closed" },
    { field: "body",    operator: "contains", value: "contract signed" },
  ],
  Communications: [
    { field: "from",    operator: "contains", value: "gemini" },
    { field: "from",    operator: "contains", value: "calendar-notification" },
    { field: "from",    operator: "contains", value: "no-reply@google.com" },
    { field: "subject", operator: "starts_with", value: "Notes:" },
    { field: "subject", operator: "contains", value: "meeting notes" },
    { field: "subject", operator: "contains", value: "transcript" },
    { field: "subject", operator: "contains", value: "Accepted:" },
    { field: "subject", operator: "contains", value: "Invitation:" },
    { field: "subject", operator: "contains", value: "Updated invitation" },
  ],
};

const COLOR_MAP: Record<string, { colorKey: string; color: string }> = {
  Communications: { colorKey: "teal", color: "#a0f5c8" },
};

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // Ensure #Communications label exists
  const commLabel = await prisma.label.upsert({
    where: { userId_name: { userId, name: "Communications" } },
    update: {},
    create: {
      userId,
      name: "Communications",
      description: "Meeting notes, calendar summaries, and automated digests",
      color: COLOR_MAP.Communications.color,
      order: 10,
      enabled: true,
    },
    include: { rules: true },
  });

  // Create Gmail label for Communications if missing
  if (!commLabel.gmailLabelId) {
    const gmailLabelId = await createGmailLabel(userId, "#Communications", COLOR_MAP.Communications.colorKey);
    if (gmailLabelId) {
      await prisma.label.update({ where: { id: commLabel.id }, data: { gmailLabelId } });
    }
  }

  // Load all labels (including newly created Communications)
  const labels = await prisma.label.findMany({
    where: { userId },
    include: { rules: true },
  });

  let rulesAdded = 0;

  for (const label of labels) {
    const defaults = DEFAULT_RULES[label.name];
    if (!defaults) continue;
    // Only seed if the label currently has no rules
    if (label.rules.length > 0) continue;

    await prisma.labelRule.createMany({
      data: defaults.map((r) => ({ labelId: label.id, ...r })),
      skipDuplicates: true,
    });
    rulesAdded += defaults.length;
  }

  return NextResponse.json({ rulesAdded });
}
