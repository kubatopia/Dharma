import { auth } from "../lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "../lib/prisma";
import { signOut } from "../lib/auth";
import { Suspense } from "react";
import Image from "next/image";
import DashboardWrapper from "./components/DashboardWrapper";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [user, googleCred, microsoftCred, appleCred] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { schedulingEnabled: true } }),
    prisma.googleCredential.findUnique({ where: { userId } }),
    prisma.microsoftCredential.findUnique({ where: { userId } }),
    prisma.appleCredential.findUnique({ where: { userId } }),
  ]);

  return (
    <main className="min-h-screen bg-[#0c0c0e] px-6 py-10">
      <div className="max-w-md mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Dharma Automations" width={32} height={32} priority />
            <span className="text-white font-bold text-lg">Dharma Automations</span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* User */}
        <div className="text-white/40 text-sm">{session.user?.email}</div>

        {/* Dashboard */}
        <Suspense>
          <DashboardWrapper
            schedulingEnabled={user?.schedulingEnabled ?? true}
            google={!!googleCred}
            googleEmail={googleCred?.email}
            microsoft={!!microsoftCred}
            microsoftEmail={microsoftCred?.email}
            microsoftConfigured={!!process.env.MICROSOFT_CLIENT_ID}
            apple={!!appleCred}
            appleEmail={appleCred?.appleId}
          />
        </Suspense>
      </div>
    </main>
  );
}
