import NextAuth from "next-auth";
import { waitUntil } from "@vercel/functions";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.id && user.email && account.access_token) {
        const expiresAt = account.expires_at
          ? new Date(account.expires_at * 1000)
          : new Date(Date.now() + 3600 * 1000);

        // Use user.id directly — the PrismaAdapter sets it before this callback
        // fires, so we avoid a findUnique race condition on first sign-in.
        await prisma.googleCredential.upsert({
          where: { userId: user.id },
          update: {
            accessToken: account.access_token,
            ...(account.refresh_token && { refreshToken: account.refresh_token }),
            expiresAt,
          },
          create: {
            userId: user.id,
            email: user.email,
            accessToken: account.access_token,
            refreshToken: account.refresh_token ?? "",
            expiresAt,
          },
        });

        // Seed gmailHistoryId so the poller can start watching this inbox.
        // Use waitUntil so Vercel keeps the function alive until it finishes.
        const token = account.access_token;
        const refresh = account.refresh_token ?? "";
        const uid = user.id;
        waitUntil(
          import("./gmail")
            .then(({ setupGmailWatch }) => setupGmailWatch(uid, token, refresh))
            .catch((err) => console.error("[auth] Gmail watch setup failed:", err))
        );
      }
      return true;
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
