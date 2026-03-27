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
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.compose",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const expiresAt = account.expires_at
          ? new Date(account.expires_at * 1000)
          : new Date(Date.now() + 3600 * 1000);

        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (dbUser && account.access_token) {
          await prisma.googleCredential.upsert({
            where: { userId: dbUser.id },
            update: {
              accessToken: account.access_token,
              ...(account.refresh_token && {
                refreshToken: account.refresh_token,
              }),
              expiresAt,
            },
            create: {
              userId: dbUser.id,
              email: user.email,
              accessToken: account.access_token,
              refreshToken: account.refresh_token ?? "",
              expiresAt,
            },
          });

          // Seed gmailHistoryId so the poller can start watching this inbox.
          // Use waitUntil so Vercel keeps the function alive until it finishes —
          // without this the function is killed as soon as the sign-in response
          // is sent, leaving gmailHistoryId null and the poller skipping the user.
          if (account.access_token) {
            const token = account.access_token;
            const refresh = account.refresh_token ?? "";
            const uid = dbUser.id;
            waitUntil(
              import("./gmail")
                .then(({ setupGmailWatch }) => setupGmailWatch(uid, token, refresh))
                .catch((err) => console.error("[auth] Gmail watch setup failed:", err))
            );
          }
        }
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
