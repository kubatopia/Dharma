import { auth } from "../lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-[#0c0c0e] flex items-center justify-center px-6">
      <div className="text-white text-center space-y-4">
        <div className="text-[#c8f5a0] text-4xl">◈</div>
        <h1 className="text-2xl font-bold">Scheduling Copilot</h1>
        <p className="text-white/50">Signed in as {session.user?.email}</p>
      </div>
    </main>
  );
}
