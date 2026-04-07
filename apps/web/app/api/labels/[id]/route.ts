import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { deleteGmailLabel } from "../../../../lib/gmail";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const data = await req.json() as { enabled?: boolean; name?: string; description?: string };

  const label = await prisma.label.findUnique({ where: { id } });
  if (!label || label.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.label.update({ where: { id }, data, include: { rules: true } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const label = await prisma.label.findUnique({ where: { id } });
  if (!label || label.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (label.gmailLabelId) {
    await deleteGmailLabel(label.userId, label.gmailLabelId);
  }

  await prisma.label.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
