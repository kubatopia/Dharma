"use client";

import { useState } from "react";
import DashboardFeatures from "./DashboardFeatures";
import CalendarConnections from "./CalendarConnections";

interface Props {
  schedulingEnabled: boolean;
  google: boolean;
  googleEmail?: string;
  microsoft: boolean;
  microsoftEmail?: string;
  microsoftConfigured: boolean;
  apple: boolean;
  appleEmail?: string;
}

export default function DashboardWrapper({
  schedulingEnabled: initialSchedulingEnabled,
  ...calendarProps
}: Props) {
  const [schedulingEnabled, setSchedulingEnabled] = useState(initialSchedulingEnabled);

  async function handleSchedulingToggle(enabled: boolean) {
    setSchedulingEnabled(enabled);
    await fetch("/api/preferences/scheduling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-xs text-white/30 uppercase tracking-widest">Automation Features</p>
        <DashboardFeatures
          schedulingEnabled={schedulingEnabled}
          onSchedulingChange={handleSchedulingToggle}
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs text-white/30 uppercase tracking-widest">Connected Calendars</p>
        <div className={`transition-opacity ${schedulingEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <CalendarConnections {...calendarProps} />
        </div>
        {!schedulingEnabled && (
          <p className="text-xs text-white/30 text-center">
            Scheduling is paused — calendar invites and requests are disabled
          </p>
        )}
      </div>
    </>
  );
}
