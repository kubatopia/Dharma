"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * LoginPage — the only public-facing page.
 *
 * One action: sign in with Google.
 * This also grants calendar access in the same OAuth flow,
 * so users never have to connect separately.
 *
 * We read `callbackUrl` from the query string so NextAuth
 * can redirect to the originally intended page after sign-in.
 */
function LoginContent() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  return (
    <main className="min-h-screen bg-[#0c0c0e] flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-10">
        {/* Logo + wordmark */}
        <div className="text-center space-y-3">
          <div className="text-[#c8f5a0] text-4xl">◈</div>
          <h1 className="text-[1.75rem] font-[family-name:var(--font-display)] text-white leading-tight">
            Scheduling Copilot
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Turn scheduling requests into<br />ready-to-send replies.
          </p>
        </div>

        {/* Sign-in card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-sm text-white/70 font-medium">Sign in to continue</p>
            <p className="text-xs text-white/30 leading-relaxed">
              We'll ask for read-only calendar access so we can find your free times.
            </p>
          </div>

          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 bg-white text-[#1a1a1a] font-medium text-sm py-3 px-4 rounded-xl hover:bg-white/90 active:scale-[0.99] transition-all duration-150"
          >
            {/* Google "G" logo in SVG — no external image dependency */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-[11px] text-white/20 text-center leading-relaxed">
            Read-only access. We never create or modify events.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
