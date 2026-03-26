import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { encryptAppPassword } from "../../../../../lib/apple-crypto";
import { createDAVClient } from "tsdav";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { appleId?: string; appPassword?: string };
  const appleId = body.appleId?.trim();
  // Strip spaces and hyphens — Apple shows app passwords as "xxxx-xxxx-xxxx-xxxx"
  const appPassword = body.appPassword?.replace(/[\s-]/g, "").trim();

  if (!appleId || !appPassword) {
    return NextResponse.json({ error: "Apple ID and app-specific password are required" }, { status: 400 });
  }

  // Validate credentials by attempting a CalDAV connection
  try {
    const client = await createDAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: { username: appleId, password: appPassword },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
    await client.fetchCalendars();
  } catch {
    return NextResponse.json(
      { error: "Could not connect to iCloud. Check your Apple ID and app-specific password." },
      { status: 400 }
    );
  }

  const encryptedAppPassword = encryptAppPassword(appPassword);

  await prisma.appleCredential.upsert({
    where: { userId: session.user.id },
    update: { appleId, encryptedAppPassword },
    create: { userId: session.user.id, appleId, encryptedAppPassword },
  });

  return NextResponse.json({ success: true });
}
