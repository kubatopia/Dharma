import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { enabled } = await req.json() as { enabled: boolean };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { schedulingEnabled: enabled },
  });

  return NextResponse.json({ success: true });
}
