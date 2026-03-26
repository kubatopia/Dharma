import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { encryptAppPassword } from "../../../../../lib/apple-crypto";

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

  // Validate credentials with a direct PROPFIND to iCloud's CalDAV server.
  // This is simpler and more reliable than tsdav's full service discovery.
  const basicAuth = Buffer.from(`${appleId}:${appPassword}`).toString("base64");

  let validationRes: Response;
  try {
    validationRes = await fetch("https://caldav.icloud.com", {
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/xml; charset=utf-8",
        Depth: "0",
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`,
    });
  } catch (err) {
    console.error("[apple/connect] Network error reaching iCloud:", err);
    return NextResponse.json({ error: "Could not reach iCloud servers. Check your internet connection." }, { status: 502 });
  }

  console.log("[apple/connect] iCloud PROPFIND status:", validationRes.status);

  if (validationRes.status === 401) {
    return NextResponse.json(
      { error: "Wrong Apple ID or app-specific password. Make sure you're using an app-specific password, not your Apple ID password." },
      { status: 400 }
    );
  }

  if (validationRes.status === 403) {
    return NextResponse.json(
      { error: "Access denied by iCloud. Ensure iCloud Calendar is enabled in your Apple ID settings." },
      { status: 400 }
    );
  }

  // 207 Multi-Status = success; iCloud may also redirect (3xx) — both are fine
  if (!validationRes.ok && validationRes.status !== 207 && validationRes.status < 300) {
    const body = await validationRes.text();
    console.error("[apple/connect] Unexpected iCloud response:", validationRes.status, body.slice(0, 200));
    return NextResponse.json(
      { error: `iCloud returned an unexpected response (${validationRes.status}). Please try again.` },
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
