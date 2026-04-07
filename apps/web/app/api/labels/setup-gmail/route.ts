import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { createGmailLabel, listGmailLabels } from "../../../../lib/gmail";

const COLOR_MAP: Record<string, string> = {
  Client: "blue", Prospect: "purple", Closing: "teal", "Follow-up": "yellow",
  Legal: "orange", Urgent: "red", "High Priority": "red",
  "Medium Priority": "yellow", "Low Priority": "gray", Communications: "teal",
};

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!googleCred) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

  // Fetch all labels already in Gmail so we can link dupes instead of failing
  const existingGmailLabels = await listGmailLabels(userId);
  const gmailByName = new Map(existingGmailLabels.map((l) => [l.name, l.id]));

  // Find DB labels that don't have a Gmail ID yet
  const labels = await prisma.label.findMany({ where: { userId, gmailLabelId: null } });

  let created = 0;
  for (const label of labels) {
    const gmailName = `#${label.name}`;
    const colorKey = COLOR_MAP[label.name] ?? "gray";

    // If Gmail already has a label with this name, link it
    let gmailLabelId = gmailByName.get(gmailName) ?? null;

    // Otherwise create it
    if (!gmailLabelId) {
      gmailLabelId = await createGmailLabel(userId, gmailName, colorKey);
    }

    if (gmailLabelId) {
      await prisma.label.update({ where: { id: label.id }, data: { gmailLabelId } });
      created++;
    }
  }

  return NextResponse.json({ created });
}
