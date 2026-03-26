import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export async function GET() {
  const base = process.env.NEXTAUTH_URL!;

  if (!process.env.MICROSOFT_CLIENT_ID) {
    return NextResponse.redirect(`${base}/?error=microsoft_not_configured`);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${base}/login`);
  }

  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("ms_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    scope: "openid profile email Calendars.Read offline_access",
    response_mode: "query",
    state,
  });

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  return NextResponse.redirect(authUrl);
}
