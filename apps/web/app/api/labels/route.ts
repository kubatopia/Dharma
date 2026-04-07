import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { createGmailLabel } from "../../../lib/gmail";

// Default labels seeded on first load
const DEFAULTS = [
  { name: "Client",          description: "Emails from or about existing clients",            color: "#a0c8f5", colorKey: "blue",   order: 0 },
  { name: "Prospect",        description: "Potential new business contacts",                  color: "#c8a0f5", colorKey: "purple", order: 1 },
  { name: "Closing",         description: "Deals or conversations nearing completion",        color: "#a0f5c8", colorKey: "teal",   order: 2 },
  { name: "Follow-up",       description: "Items requiring a follow-up action",               color: "#f5e6a0", colorKey: "yellow", order: 3 },
  { name: "Legal",           description: "Contracts, compliance, and legal matters",         color: "#f5c8a0", colorKey: "orange", order: 4 },
  { name: "Urgent",          description: "Time-sensitive, needs immediate attention",        color: "#f5a0a0", colorKey: "red",    order: 5 },
  { name: "High Priority",   description: "Important items needing prompt attention",         color: "#f5b890", colorKey: "orange", order: 6 },
  { name: "Medium Priority", description: "Items to address within the week",                color: "#f5e0a0", colorKey: "yellow", order: 7 },
  { name: "Low Priority",    description: "Non-urgent items for later review",                color: "#c0c0c0", colorKey: "gray",   order: 8 },
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  let labels = await prisma.label.findMany({
    where: { userId },
    include: { rules: { orderBy: { createdAt: "asc" } } },
    orderBy: { order: "asc" },
  });

  // Seed defaults on first load
  if (labels.length === 0) {
    const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });

    await prisma.label.createMany({
      data: DEFAULTS.map((d) => ({
        userId,
        name: d.name,
        description: d.description,
        color: d.color,
        order: d.order,
        enabled: true,
      })),
      skipDuplicates: true,
    });

    // Create Gmail labels if Google is connected (using userId so tokens auto-refresh)
    if (googleCred) {
      const created = await prisma.label.findMany({ where: { userId }, orderBy: { order: "asc" } });
      // Run sequentially to avoid Gmail API rate limits
      for (const label of created) {
        const colorKey = DEFAULTS.find((d) => d.name === label.name)?.colorKey ?? "gray";
        const gmailLabelId = await createGmailLabel(userId, `#${label.name}`, colorKey);
        if (gmailLabelId) {
          await prisma.label.update({ where: { id: label.id }, data: { gmailLabelId } });
        }
      }
    }

    labels = await prisma.label.findMany({
      where: { userId },
      include: { rules: { orderBy: { createdAt: "asc" } } },
      orderBy: { order: "asc" },
    });
  }

  return NextResponse.json(labels);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { name, description = "", color = "#c8f5a0", colorKey = "gray" } =
    await req.json() as { name: string; description?: string; color?: string; colorKey?: string };

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const count = await prisma.label.count({ where: { userId } });
  const label = await prisma.label.create({
    data: { userId, name: name.trim(), description, color, order: count },
    include: { rules: true },
  });

  // Create in Gmail if connected
  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (googleCred) {
    const gmailLabelId = await createGmailLabel(userId, `#${label.name}`, colorKey);
    if (gmailLabelId) {
      await prisma.label.update({ where: { id: label.id }, data: { gmailLabelId } });
      return NextResponse.json({ ...label, gmailLabelId });
    }
  }

  return NextResponse.json(label);
}
