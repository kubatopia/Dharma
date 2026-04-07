import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { createGmailLabel } from "../../../../lib/gmail";

const COLOR_MAP: Record<string, string> = {
  Client: "blue", Prospect: "purple", Closing: "teal", "Follow-up": "yellow",
  Legal: "orange", Urgent: "red", "High Priority": "orange",
  "Medium Priority": "yellow", "Low Priority": "gray",
};

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!googleCred) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

  // Find labels that don't have a Gmail label yet
  const labels = await prisma.label.findMany({
    where: { userId, gmailLabelId: null },
  });

  let created = 0;
  await Promise.allSettled(
    labels.map(async (label) => {
      const colorKey = COLOR_MAP[label.name] ?? "gray";
      const gmailLabelId = await createGmailLabel(userId, `#${label.name}`, colorKey);
      if (gmailLabelId) {
        await prisma.label.update({ where: { id: label.id }, data: { gmailLabelId } });
        created++;
      }
    })
  );

  return NextResponse.json({ created });
}
