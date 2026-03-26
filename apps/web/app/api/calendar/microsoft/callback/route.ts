import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { cookies } from "next/headers";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface GraphUser {
  mail?: string;
  userPrincipalName?: string;
}

export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL!;
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${base}/?error=microsoft_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${base}/?error=microsoft_invalid`);
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get("ms_oauth_state")?.value;
  cookieStore.delete("ms_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${base}/?error=microsoft_state`);
  }

  // Require authenticated session to know which user to attach the credential to
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${base}/login`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
        code,
      }),
    }
  );

  if (!tokenRes.ok) {
    console.error("[ms/callback] Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${base}/?error=microsoft_token`);
  }

  const tokens = await tokenRes.json() as TokenResponse;

  // Get the user's email from Microsoft Graph
  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!meRes.ok) {
    return NextResponse.redirect(`${base}/?error=microsoft_profile`);
  }

  const me = await meRes.json() as GraphUser;
  const email = me.mail ?? me.userPrincipalName ?? "";
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.microsoftCredential.upsert({
    where: { userId: session.user.id },
    update: {
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    },
    create: {
      userId: session.user.id,
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    },
  });

  return NextResponse.redirect(`${base}/?connected=microsoft`);
}
