import type { TimeSlot } from "@dharma/types";

export function formatSlot(slot: TimeSlot, timezone = "America/New_York"): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  };
  return `${slot.start.toLocaleString("en-US", opts)} – ${slot.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })}`;
}

export function generateReply(slots: TimeSlot[], timezone = "America/New_York"): string {
  const formatted = slots.map((s) => `• ${formatSlot(s, timezone)}`).join("\n");
  return `Thanks for reaching out! I have the following times available:\n\n${formatted}\n\nPlease let me know what works best for you.`;
}

export { generateAIReply, generateConfirmationReply } from "./ai";
