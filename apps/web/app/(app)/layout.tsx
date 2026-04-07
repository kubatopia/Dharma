import { auth } from "../../lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "../../lib/auth";
import Image from "next/image";
import Sidebar from "../components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="min-h-screen bg-[#0c0c0e] flex">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-white/[0.06] flex flex-col py-7 px-3">
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <Image src="/logo.png" alt="Dharma" width={26} height={26} priority />
          <span className="text-white font-bold text-sm">Dharma</span>
        </div>
        <Sidebar />
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-10 py-5 border-b border-white/[0.06]">
          <span className="text-sm text-white/40">{session.user?.email}</span>
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
        </header>

        {/* Page content */}
        <main className="flex-1 px-10 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
