export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface SchedulingRequest {
  rawText: string;
  durationMinutes: number;
}
