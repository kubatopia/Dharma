"use client";

import { useState, useEffect } from "react";

interface EmailLabel {
  name: string;
  color: string;
}

interface Email {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  internalDate: string;
  labels: EmailLabel[];
}

interface Props {
  selectedTone: string | null;
}

export default function InboxPanel({ selectedTone }: Props) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [drafted, setDrafted] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/emails/recent")
      .then((r) => r.json())
      .then((data: Email[]) => { setEmails(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function createDraft(emailId: string) {
    setDrafting(emailId);
    try {
      await fetch(`/api/emails/${emailId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: selectedTone ?? "Concise" }),
      });
      setDrafted((prev) => new Set(prev).add(emailId));
    } catch {
      // silent — draft failed
    }
    setDrafting(null);
  }

  function displayFrom(raw: string) {
    const match = raw.match(/^([^<]+)</);
    return match ? match[1].trim() : raw.replace(/<[^>]+>/, "").trim();
  }

  if (loading) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-white/20">Loading inbox…</p>
      </div>
    );
  }

  if (!emails.length) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-white/20">No recent emails</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {emails.map((email) => {
        const isDrafting = drafting === email.id;
        const isDrafted = drafted.has(email.id);

        return (
          <div
            key={email.id}
            className="flex items-start justify-between gap-4 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-colors group"
          >
            {/* Left: from + subject + snippet + labels */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs font-medium text-white/70 truncate shrink-0 max-w-[140px]">
                  {displayFrom(email.from)}
                </span>
                <span className="text-xs text-white/40 truncate">{email.subject}</span>
              </div>
              <p className="text-xs text-white/25 truncate leading-relaxed">{email.snippet}</p>
              {email.labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {email.labels.map((l) => (
                    <span
                      key={l.name}
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${l.color}22`,
                        color: l.color,
                        border: `1px solid ${l.color}44`,
                      }}
                    >
                      #{l.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: draft button */}
            <div className="shrink-0">
              {isDrafted ? (
                <span className="text-[10px] text-[#c8f5a0]/60 bg-[#c8f5a0]/10 px-2 py-1 rounded-lg">
                  Draft saved ✓
                </span>
              ) : (
                <button
                  onClick={() => createDraft(email.id)}
                  disabled={!!drafting}
                  className="text-[10px] text-white/30 hover:text-white/70 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-30 opacity-0 group-hover:opacity-100"
                >
                  {isDrafting ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 border border-white/30 border-t-white/70 rounded-full animate-spin" />
                      Drafting…
                    </span>
                  ) : (
                    "Draft reply →"
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
