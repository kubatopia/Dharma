"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

interface Props {
  google: boolean;
  googleEmail?: string;
  microsoft: boolean;
  microsoftEmail?: string;
  microsoftConfigured: boolean;
  apple: boolean;
  appleEmail?: string;
}

export default function CalendarConnections({
  google,
  googleEmail,
  microsoft,
  microsoftEmail,
  microsoftConfigured,
  apple,
  appleEmail,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const [showAppleForm, setShowAppleForm] = useState(false);
  const [appleId, setAppleId] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [appleError, setAppleError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Show success toast when returning from Microsoft OAuth
  useEffect(() => {
    const connected = params.get("connected");
    if (connected === "microsoft") {
      setToast("Outlook Calendar connected");
      router.replace("/");
    }
    const errorParam = params.get("error");
    if (errorParam?.startsWith("microsoft")) {
      setToast("Could not connect Outlook — please try again");
      router.replace("/");
    }
  }, [params, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function disconnect(provider: "google" | "microsoft" | "apple") {
    setLoading(provider);
    await fetch(`/api/calendar/${provider}/disconnect`, { method: "POST" });
    setLoading(null);
    router.refresh();
  }

  async function connectApple(e: React.FormEvent) {
    e.preventDefault();
    setAppleError(null);
    setLoading("apple");

    const res = await fetch("/api/calendar/apple/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appleId, appPassword }),
    });

    setLoading(null);

    if (res.ok) {
      setShowAppleForm(false);
      setAppleId("");
      setAppPassword("");
      setToast("Apple Calendar connected");
      router.refresh();
    } else {
      const data = await res.json() as { error?: string };
      setAppleError(data.error ?? "Connection failed");
    }
  }

  return (
    <div className="space-y-3">
      {toast && (
        <div className="text-xs text-[#c8f5a0] bg-[#c8f5a0]/10 border border-[#c8f5a0]/20 rounded-xl px-4 py-2 text-center">
          {toast}
        </div>
      )}

      {/* Google */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <GoogleIcon />
          <div>
            <p className="text-sm font-medium text-white">Google Calendar</p>
            {google && googleEmail && (
              <p className="text-xs text-white/40 mt-0.5">{googleEmail}</p>
            )}
          </div>
        </div>
        {google ? (
          <button
            onClick={() => disconnect("google")}
            disabled={loading === "google"}
            className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            {loading === "google" ? "…" : "Disconnect"}
          </button>
        ) : (
          <span className="text-xs text-white/30">Sign in with Google to connect</span>
        )}
      </div>

      {/* Microsoft */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MicrosoftIcon />
          <div>
            <p className="text-sm font-medium text-white">Outlook / Microsoft 365</p>
            {microsoft && microsoftEmail && (
              <p className="text-xs text-white/40 mt-0.5">{microsoftEmail}</p>
            )}
          </div>
        </div>
        {microsoft ? (
          <button
            onClick={() => disconnect("microsoft")}
            disabled={loading === "microsoft"}
            className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            {loading === "microsoft" ? "…" : "Disconnect"}
          </button>
        ) : microsoftConfigured ? (
          <a
            href="/api/calendar/microsoft/connect"
            className="text-xs bg-white/[0.08] hover:bg-white/[0.12] text-white/70 px-3 py-1.5 rounded-lg transition-colors"
          >
            Connect →
          </a>
        ) : (
          <span className="text-xs text-white/20 italic">Coming soon</span>
        )}
      </div>

      {/* Apple */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppleIcon />
            <div>
              <p className="text-sm font-medium text-white">Apple iCloud Calendar</p>
              {apple && appleEmail && (
                <p className="text-xs text-white/40 mt-0.5">{appleEmail}</p>
              )}
            </div>
          </div>
          {apple ? (
            <button
              onClick={() => disconnect("apple")}
              disabled={loading === "apple"}
              className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
            >
              {loading === "apple" ? "…" : "Disconnect"}
            </button>
          ) : (
            <button
              onClick={() => setShowAppleForm((v) => !v)}
              className="text-xs bg-white/[0.08] hover:bg-white/[0.12] text-white/70 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showAppleForm ? "Cancel" : "Connect →"}
            </button>
          )}
        </div>

        {showAppleForm && !apple && (
          <form onSubmit={connectApple} className="space-y-3 pt-1 border-t border-white/[0.06]">
            <p className="text-xs text-white/30 leading-relaxed">
              Enter your Apple ID and an{" "}
              <a
                href="https://support.apple.com/102654"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white/50"
              >
                app-specific password
              </a>{" "}
              (not your Apple ID password). The password is stored encrypted.
            </p>

            <input
              type="email"
              placeholder="Apple ID (e.g. you@icloud.com)"
              value={appleId}
              onChange={(e) => setAppleId(e.target.value)}
              required
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20"
            />
            <input
              type="password"
              placeholder="App-specific password (xxxx-xxxx-xxxx-xxxx)"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              required
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20"
            />

            {appleError && (
              <p className="text-xs text-red-400">{appleError}</p>
            )}

            <button
              type="submit"
              disabled={loading === "apple"}
              className="w-full bg-white text-[#1a1a1a] font-medium text-sm py-2.5 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {loading === "apple" ? "Connecting…" : "Connect Apple Calendar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" className="shrink-0">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" fill="none" className="shrink-0">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 814 1000" fill="currentColor" className="text-white/70 shrink-0">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.8-157.1-122.7c-60.1-90.4-108.4-229-108.4-360.2 0-199.3 131-305.3 259.7-305.3 69.4 0 126.9 45.7 170.1 45.7 41 0 106.1-48.4 183.6-48.4zM520.8 69c-41.5 50.2-109.2 88.9-176.9 88.9-.3-6.4-.5-13-.5-19.7C343.4 67 437.3 0 504.9 0c39.9 0 81.2 23.8 81.2 23.8-1.5 16.1-28.4 68.6-65.3 45.2z" />
    </svg>
  );
}
