import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

/**
 * auth.ts — the single source of truth for NextAuth configuration.
 *
 * We export four things from here:
 *   handlers  → mounted at /api/auth/[...nextauth]
 *   auth      → server-side session getter (replaces getServerSession)
 *   signIn    → server action for sign-in
 *   signOut   → server action for sign-out
 *
 * Key decisions:
 *
 * 1. PrismaAdapter — NextAuth writes User, Account, and Session rows
 *    automatically. We never manually create users.
 *
 * 2. Google provider with calendar scope — sign-in and calendar access
 *    happen in one OAuth flow. The user approves everything at once.
 *    access_type=offline gives us a refresh token.
 *
 * 3. callbacks.signIn — after Google approves, we upsert the calendar
 *    tokens into GoogleCredential so RealGoogleProvider can use them.
 *    This replaces the separate /auth/google/* routes we built earlier.
 *
 * 4. session callback — we extend the default session to include the
 *    user's database id, which API routes need to scope DB queries.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Calendar read access + basic profile
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent", // always return refresh_token
        },
      },
    }),
  ],

  callbacks: {
    /**
     * signIn — runs after Google approves the OAuth flow.
     *
     * We upsert the calendar tokens here so they're always fresh.
     * The account object carries access_token, refresh_token, expires_at
     * from Google's token response.
     */
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const expiresAt = account.expires_at
          ? new Date(account.expires_at * 1000)
          : new Date(Date.now() + 3600 * 1000);

        // Find the user record NextAuth just created/found
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
        }
      }
      return true; // allow sign-in
    },

    /**
     * session — adds user.id to the client-visible session object.
     *
     * By default NextAuth omits the database id from the session for
     * security. We add it back because API routes need it to query
     * per-user data (calendar credentials, preferences, etc.).
     */
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login", // redirect to our custom login page instead of NextAuth's default
  },
});
