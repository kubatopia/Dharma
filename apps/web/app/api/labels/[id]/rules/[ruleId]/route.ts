import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: labelId, ruleId } = await params;
  const rule = await prisma.labelRule.findUnique({
    where: { id: ruleId },
    include: { label: true },
  });

  if (!rule || rule.label.userId !== session.user.id || rule.labelId !== labelId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.labelRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ success: true });
}
