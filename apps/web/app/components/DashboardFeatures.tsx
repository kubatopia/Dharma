"use client";

import { useState } from "react";

type Tone = "Professional" | "Friendly" | "Casual" | "Formal" | "Concise";
type Label = "Primary" | "Work" | "Personal" | "Updates" | "Promotions";
type ScheduleType = "Meetings" | "Reminders" | "Focus Blocks" | "Travel" | "Personal";

const TONES: Tone[] = ["Professional", "Friendly", "Casual", "Formal", "Concise"];
const LABELS: Label[] = ["Primary", "Work", "Personal", "Updates", "Promotions"];
const SCHEDULE_TYPES: ScheduleType[] = ["Meetings", "Reminders", "Focus Blocks", "Travel", "Personal"];

interface Props {
  schedulingEnabled: boolean;
  onSchedulingChange: (enabled: boolean) => void;
}

export default function DashboardFeatures({ schedulingEnabled, onSchedulingChange }: Props) {
  const [toneEnabled, setToneEnabled] = useState(false);
  const [selectedTone, setSelectedTone] = useState<Tone | null>(null);
  const [labelsEnabled, setLabelsEnabled] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([]);
  const [selectedScheduleTypes, setSelectedScheduleTypes] = useState<ScheduleType[]>([]);

  function toggleScheduleType(type: ScheduleType) {
    setSelectedScheduleTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function toggleLabel(label: Label) {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }

  return (
    <div className="space-y-3">
      {/* Tone */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Email Tone</p>
            <p className="text-xs text-white/30 mt-0.5">Set a writing tone for automated emails</p>
          </div>
          <Toggle enabled={toneEnabled} onChange={setToneEnabled} />
        </div>
        {toneEnabled && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
            {TONES.map((tone) => (
              <button
                key={tone}
                onClick={() => setSelectedTone(tone === selectedTone ? null : tone)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedTone === tone
                    ? "bg-[#c8f5a0]/15 border-[#c8f5a0]/40 text-[#c8f5a0]"
                    : "bg-white/[0.05] border-white/[0.1] text-white/50 hover:text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {tone}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs & Labels */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Tabs & Labels</p>
            <p className="text-xs text-white/30 mt-0.5">Auto-organize emails into tabs and labels</p>
          </div>
          <Toggle enabled={labelsEnabled} onChange={setLabelsEnabled} />
        </div>
        {labelsEnabled && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
            {LABELS.map((label) => (
              <button
                key={label}
                onClick={() => toggleLabel(label)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedLabels.includes(label)
                    ? "bg-[#c8f5a0]/15 border-[#c8f5a0]/40 text-[#c8f5a0]"
                    : "bg-white/[0.05] border-white/[0.1] text-white/50 hover:text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Calendar & Scheduling */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Calendar & Scheduling</p>
            <p className="text-xs text-white/30 mt-0.5">Automate scheduling and calendar events</p>
          </div>
          <Toggle enabled={schedulingEnabled} onChange={onSchedulingChange} />
        </div>
        {schedulingEnabled && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
            {SCHEDULE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleScheduleType(type)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedScheduleTypes.includes(type)
                    ? "bg-[#c8f5a0]/15 border-[#c8f5a0]/40 text-[#c8f5a0]"
                    : "bg-white/[0.05] border-white/[0.1] text-white/50 hover:text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      aria-checked={enabled}
      role="switch"
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
