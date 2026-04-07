import { prisma } from "../../../lib/prisma";
import { auth } from "../../../lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import DashboardWrapper from "../../components/DashboardWrapper";

export default async function DashboardPage() {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-white/35 mt-0.5">Manage your active automations</p>
      </div>
      <Suspense>
        <DashboardWrapper
          schedulingEnabled={user?.schedulingEnabled ?? true}
          googleEmail={googleCred?.email}
          microsoft={!!microsoftCred}
          microsoftEmail={microsoftCred?.email}
          microsoftConfigured={!!process.env.MICROSOFT_CLIENT_ID}
          apple={!!appleCred}
          appleEmail={appleCred?.appleId}
        />
      </Suspense>
    </div>
  );
}
