import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tone } = await req.json() as { tone: string };
  if (!tone) return NextResponse.json({ error: "tone required" }, { status: 400 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tone },
  });

  return NextResponse.json({ tone });
}
