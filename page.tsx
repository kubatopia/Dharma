"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import type { TimeSlot } from "../../../packages/types/src";

type Status = "idle" | "loading" | "streaming" | "done" | "error";

interface SlotResult {
  slots: TimeSlot[];
  isReal: boolean;
}

export default function Home() {
  const { data: session } = useSession();
  const [requestText, setRequestText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [slotResult, setSlotResult] = useState<SlotResult | null>(null);
  const [emailReply, setEmailReply] = useState("");
  const [copied, setCopied] = useState(false);
  const replyRef = useRef("");

  async function handleSuggest() {
    if (!requestText.trim()) return;
    setStatus("loading");
    setSlotResult(null);
    setEmailReply("");
    replyRef.current = "";

    try {
      const res = await fetch("/api/suggest-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: requestText }),
      });

      if (!res.ok || !res.body) throw new Error("API error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "slots") {
              setSlotResult({
                slots: event.slots.map((s: { start: string; end: string }) => ({
                  start: new Date(s.start),
                  end: new Date(s.end),
                })),
                isReal: event.isReal,
              });
              setStatus("streaming");
            } else if (event.type === "chunk") {
              replyRef.current += event.text;
              setEmailReply(replyRef.current);
            } else if (event.type === "done") {
              setStatus("done");
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch {
      setStatus("error");
    }
  }

  function formatSlotDisplay(start: Date, end: Date) {
    const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
    const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    return { day: dayFmt.format(start), time: `${timeFmt.format(start)} – ${timeFmt.format(end)}` };
  }

  async function copyReply() {
    if (!emailReply) return;
    await navigator.clipboard.writeText(emailReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isActive = status === "loading" || status === "streaming";

  return (
    <main className="min-h-screen bg-[#0c0c0e] text-[#e8e6e0] font-[family-name:var(--font-body)]">
      <header className="border-b border-white/[0.06] px-8 py-5 flex items-center gap-3">
        <span className="text-[#c8f5a0] text-lg">◈</span>
        <span className="text-sm tracking-[0.18em] uppercase font-[family-name:var(--font-mono)] text-white/50">
          Scheduling Copilot
        </span>

        {/* Session controls */}
        {session?.user && (
          <div className="ml-auto flex items-center gap-3">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name ?? ""}
                className="w-7 h-7 rounded-full opacity-80"
              />
            )}
            <span className="text-xs text-white/30 font-[family-name:var(--font-mono)] hidden sm:block">
              {session.user.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-[10px] tracking-[0.12em] uppercase font-[family-name:var(--font-mono)] border border-white/[0.10] text-white/30 hover:text-white/60 hover:border-white/25 px-3 py-1.5 rounded-lg transition-all duration-150"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-6 py-16 space-y-10">
        {/* Hero */}
        <div className="space-y-2">
          <h1 className="text-[2.25rem] leading-tight font-[family-name:var(--font-display)] text-white">
            Turn any scheduling<br />
            <span className="text-[#c8f5a0]">request into a reply.</span>
          </h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-md">
            Paste a meeting request. We'll find open times on your calendar and draft a reply that matches the sender's tone.
          </p>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-[family-name:var(--font-mono)]">
            Scheduling request
          </label>
          <textarea
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            placeholder={`e.g. "Hey, would love to find a time to connect this week — totally flexible on my end!"`}
            rows={5}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:border-[#c8f5a0]/40 focus:bg-white/[0.06] transition-all duration-200 font-[family-name:var(--font-body)] leading-relaxed"
          />
          <button
            onClick={handleSuggest}
            disabled={isActive || !requestText.trim()}
            className="w-full bg-[#c8f5a0] text-[#0c0c0e] font-[family-name:var(--font-mono)] text-sm tracking-[0.08em] uppercase py-3.5 rounded-xl font-semibold hover:bg-[#d8ffb0] active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
          >
            {status === "loading"
              ? "Checking calendar…"
              : status === "streaming"
              ? "Writing reply…"
              : "Suggest times →"}
          </button>
        </div>

        {/* Loading skeleton */}
        {status === "loading" && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            Something went wrong. Please try again.
          </div>
        )}

        {/* Results */}
        {slotResult && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
            {/* Source badge */}
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-[family-name:var(--font-mono)] tracking-widest uppercase px-2 py-0.5 rounded-md ${
                slotResult.isReal
                  ? "bg-[#c8f5a0]/10 text-[#c8f5a0] border border-[#c8f5a0]/20"
                  : "bg-white/[0.06] text-white/30 border border-white/[0.08]"
              }`}>
                {slotResult.isReal ? "● Live calendar" : "◌ Mock data"}
              </span>
            </div>

            {/* Slots */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-[family-name:var(--font-mono)]">
                Suggested times
              </p>
              {slotResult.slots.map((slot, i) => {
                const { day, time } = formatSlotDisplay(new Date(slot.start), new Date(slot.end));
                return (
                  <div key={i} className="flex items-center gap-4 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 hover:border-[#c8f5a0]/20 hover:bg-white/[0.06] transition-all duration-200">
                    <span className="text-[#c8f5a0] font-[family-name:var(--font-mono)] text-xs w-4 text-center opacity-60">{i + 1}</span>
                    <div>
                      <p className="text-sm text-white/90 font-medium">{day}</p>
                      <p className="text-xs text-white/40 mt-0.5 font-[family-name:var(--font-mono)]">{time}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Streaming reply */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-[family-name:var(--font-mono)]">
                  Draft reply
                </p>
                {status === "done" && (
                  <button
                    onClick={copyReply}
                    className="text-[10px] uppercase tracking-[0.12em] font-[family-name:var(--font-mono)] text-white/30 hover:text-[#c8f5a0] transition-colors duration-150"
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                )}
              </div>
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-4 text-sm text-white/70 leading-relaxed min-h-[60px]">
                {emailReply || (status === "streaming" && <span className="text-white/20">Writing…</span>)}
                {status === "streaming" && (
                  <span className="inline-block w-[2px] h-[1em] bg-[#c8f5a0] ml-0.5 animate-[blink_1s_step-end_infinite] align-text-bottom" />
                )}
              </div>
            </div>

            {status === "done" && (
              <button
                onClick={() => {
                  setStatus("idle");
                  setSlotResult(null);
                  setEmailReply("");
                  replyRef.current = "";
                  setRequestText("");
                }}
                className="text-xs text-white/20 hover:text-white/50 font-[family-name:var(--font-mono)] tracking-wider transition-colors"
              >
                ← Start over
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
