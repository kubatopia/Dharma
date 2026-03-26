import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Removes the calendar credential but keeps the NextAuth Account row intact,
  // so the user stays signed in.
  await prisma.googleCredential.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
