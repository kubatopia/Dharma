import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: labelId } = await params;
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label || label.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { field, operator, value } =
    await req.json() as { field: string; operator: string; value: string };

  if (!field || !operator || !value?.trim())
    return NextResponse.json({ error: "field, operator, and value required" }, { status: 400 });

  const rule = await prisma.labelRule.create({
    data: { labelId, field, operator, value: value.trim() },
  });
  return NextResponse.json(rule);
}
