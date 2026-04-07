"use client";

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface LabelRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface Label {
  id: string;
  name: string;
  description: string;
  color: string;
  enabled: boolean;
  gmailLabelId: string | null;
  rules: LabelRule[];
}

const FIELD_OPTIONS = [
  { value: "subject", label: "Subject" },
  { value: "from",    label: "Sender" },
  { value: "body",    label: "Body" },
];

const OPERATOR_OPTIONS = [
  { value: "contains",     label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with",  label: "starts with" },
  { value: "is",           label: "is exactly" },
];

const COLOR_OPTIONS = [
  { key: "blue",   hex: "#a0c8f5", label: "Blue" },
  { key: "purple", hex: "#c8a0f5", label: "Purple" },
  { key: "teal",   hex: "#a0f5c8", label: "Teal" },
  { key: "green",  hex: "#c8f5a0", label: "Green" },
  { key: "yellow", hex: "#f5e6a0", label: "Yellow" },
  { key: "orange", hex: "#f5c8a0", label: "Orange" },
  { key: "red",    hex: "#f5a0a0", label: "Red" },
  { key: "gray",   hex: "#c0c0c0", label: "Gray" },
];

// ── Main component ─────────────────────────────────────────────────────────

export default function LabelsPanel() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ scanned: number; labeled: number } | null>(null);

  // New label form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColorKey, setNewColorKey] = useState("green");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/labels")
      .then((r) => r.json())
      .then((data: Label[]) => { setLabels(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggleLabel(id: string, enabled: boolean) {
    setLabels((prev) => prev.map((l) => l.id === id ? { ...l, enabled } : l));
    await fetch(`/api/labels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  }

  async function deleteLabel(id: string) {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/labels/${id}`, { method: "DELETE" });
  }

  async function addRule(labelId: string, field: string, operator: string, value: string) {
    const res = await fetch(`/api/labels/${labelId}/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, operator, value }),
    });
    if (!res.ok) return;
    const rule: LabelRule = await res.json();
    setLabels((prev) =>
      prev.map((l) => l.id === labelId ? { ...l, rules: [...l.rules, rule] } : l)
    );
  }

  async function deleteRule(labelId: string, ruleId: string) {
    await fetch(`/api/labels/${labelId}/rules/${ruleId}`, { method: "DELETE" });
    setLabels((prev) =>
      prev.map((l) => l.id === labelId ? { ...l, rules: l.rules.filter((r) => r.id !== ruleId) } : l)
    );
  }

  async function scanInbox() {
    setScanning(true);
    setScanResult(null);
    try {
      // Ensure all labels exist in Gmail first (fixes missing gmailLabelId)
      await fetch("/api/labels/setup-gmail", { method: "POST" });
      // Reload labels so gmailLabelId values are fresh
      const refreshed = await fetch("/api/labels").then((r) => r.json()) as Label[];
      setLabels(refreshed);
      // Now scan and apply
      const res = await fetch("/api/labels/scan-inbox", { method: "POST" });
      const data = await res.json() as { scanned: number; labeled: number };
      setScanResult(data);
    } catch {
      setScanResult(null);
    }
    setScanning(false);
  }

  async function createLabel() {
    if (!newName.trim()) return;
    setCreating(true);
    const colorHex = COLOR_OPTIONS.find((c) => c.key === newColorKey)?.hex ?? "#c8f5a0";
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), color: colorHex, colorKey: newColorKey }),
    });
    if (res.ok) {
      const label: Label = await res.json();
      setLabels((prev) => [...prev, label]);
      setNewName("");
      setNewDesc("");
      setNewColorKey("green");
      setShowNewForm(false);
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
        <p className="text-xs text-white/25">Loading labels…</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Scan inbox bar */}
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-xs text-white/25">Labels apply to new emails automatically</p>
        <button
          onClick={scanInbox}
          disabled={scanning}
          className="text-xs bg-white/[0.07] hover:bg-white/[0.12] text-white/60 hover:text-white/80 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          {scanning ? (
            <>
              <span className="inline-block w-2.5 h-2.5 border border-white/30 border-t-white/70 rounded-full animate-spin" />
              Scanning…
            </>
          ) : "Scan inbox"}
        </button>
      </div>
      {scanResult && (
        <div className="text-xs text-[#c8f5a0] bg-[#c8f5a0]/10 border border-[#c8f5a0]/20 rounded-xl px-4 py-2 text-center">
          Scanned {scanResult.scanned} emails — labeled {scanResult.labeled}
        </div>
      )}
      {labels.map((label) => (
        <LabelCard
          key={label.id}
          label={label}
          expanded={expandedId === label.id}
          onExpand={() => setExpandedId(expandedId === label.id ? null : label.id)}
          onToggle={(v) => toggleLabel(label.id, v)}
          onDelete={() => deleteLabel(label.id)}
          onAddRule={(field, operator, value) => addRule(label.id, field, operator, value)}
          onDeleteRule={(ruleId) => deleteRule(label.id, ruleId)}
        />
      ))}

      {/* New label form */}
      {showNewForm ? (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-3">
          <p className="text-xs font-medium text-white/60">New Label</p>
          <input
            placeholder="Label name (e.g. VIP)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createLabel()}
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25"
          />
          <input
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25"
          />
          <div className="flex items-center gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.key}
                onClick={() => setNewColorKey(c.key)}
                title={c.label}
                className={`w-5 h-5 rounded-full transition-transform ${newColorKey === c.key ? "scale-125 ring-2 ring-white/40" : ""}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={createLabel}
              disabled={creating || !newName.trim()}
              className="flex-1 bg-white text-[#1a1a1a] text-sm font-medium py-2 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewName(""); setNewDesc(""); }}
              className="px-4 py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="w-full py-2.5 text-xs text-white/30 hover:text-white/60 border border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-xl transition-colors"
        >
          + New Label
        </button>
      )}
    </div>
  );
}

// ── Label card ─────────────────────────────────────────────────────────────

function LabelCard({
  label, expanded, onExpand, onToggle, onDelete, onAddRule, onDeleteRule,
}: {
  label: Label;
  expanded: boolean;
  onExpand: () => void;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
  onAddRule: (field: string, operator: string, value: string) => void;
  onDeleteRule: (ruleId: string) => void;
}) {
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleField, setRuleField] = useState("subject");
  const [ruleOperator, setRuleOperator] = useState("contains");
  const [ruleValue, setRuleValue] = useState("");
  const [addingRule, setAddingRule] = useState(false);

  async function submitRule() {
    if (!ruleValue.trim()) return;
    setAddingRule(true);
    await onAddRule(ruleField, ruleOperator, ruleValue);
    setRuleValue("");
    setShowRuleForm(false);
    setAddingRule(false);
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <button className="flex items-center gap-2.5 min-w-0 flex-1 text-left" onClick={onExpand}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
          <div className="min-w-0">
            <span className="text-sm font-medium text-white">#{label.name}</span>
            {label.description && (
              <p className="text-xs text-white/35 mt-0.5 truncate">{label.description}</p>
            )}
          </div>
          <span className="text-white/20 text-xs ml-1">{expanded ? "▲" : "▼"}</span>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          {label.rules.length > 0 && (
            <span className="text-[10px] text-white/25">{label.rules.length} rule{label.rules.length !== 1 ? "s" : ""}</span>
          )}
          <Toggle enabled={label.enabled} onChange={onToggle} />
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
          {/* Existing rules */}
          {label.rules.length > 0 && (
            <div className="space-y-1.5">
              {label.rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                  <p className="text-xs text-white/50">
                    <span className="text-white/70">{FIELD_OPTIONS.find((f) => f.value === rule.field)?.label}</span>
                    {" "}{OPERATOR_OPTIONS.find((o) => o.value === rule.operator)?.label}{" "}
                    <span className="text-white/70">"{rule.value}"</span>
                  </p>
                  <button onClick={() => onDeleteRule(rule.id)} className="text-white/20 hover:text-white/50 transition-colors text-xs shrink-0">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Add rule form */}
          {showRuleForm ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={ruleField}
                  onChange={(e) => setRuleField(e.target.value)}
                  className="bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none"
                >
                  {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select
                  value={ruleOperator}
                  onChange={(e) => setRuleOperator(e.target.value)}
                  className="bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none"
                >
                  {OPERATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Value…"
                  value={ruleValue}
                  onChange={(e) => setRuleValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitRule()}
                  className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/25"
                />
                <button
                  onClick={submitRule}
                  disabled={addingRule || !ruleValue.trim()}
                  className="px-3 py-1.5 bg-white/[0.1] hover:bg-white/[0.15] text-white/70 text-xs rounded-lg transition-colors disabled:opacity-40"
                >
                  {addingRule ? "…" : "Add"}
                </button>
                <button onClick={() => { setShowRuleForm(false); setRuleValue(""); }} className="text-xs text-white/25 hover:text-white/50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowRuleForm(true)}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                + Add rule
              </button>
              <button
                onClick={onDelete}
                className="text-xs text-white/15 hover:text-red-400/60 transition-colors"
              >
                Delete label
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      role="switch"
      aria-checked={enabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-[#c8f5a0]/70" : "bg-white/[0.12]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}
