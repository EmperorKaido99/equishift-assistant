export type ShiftType = 'day' | 'night';

export type StaffRole = 'supervisor' | 'cleaner' | 'regular';

export interface StaffMember {
  name: string;
  role: StaffRole;
}

export interface ShiftAssignment {
  staff: string;
  type: ShiftType;
}

export interface DaySchedule {
  date: Date;
  dayShift: string[];
  nightShift: string[];
}

export interface MonthSchedule {
  year: number;
  month: number; // 0-indexed
  days: DaySchedule[];
}

export interface StaffStats {
  name: string;
  role: StaffRole;
  totalShifts: number;
  dayShifts: number;
  nightShifts: number;
  weekendShifts: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type SchedulePattern = 'mixed' | '2week' | '1week';

export interface ScheduleOptions {
  pattern: SchedulePattern;
  groupTogether?: string[][]; // groups of names to put on same shift
}

export const STAFF_MEMBERS: StaffMember[] = [
  { name: 'Tracey', role: 'supervisor' },
  { name: 'Shariefa', role: 'cleaner' },
  { name: 'Yvette', role: 'regular' },
  { name: 'Sandra', role: 'regular' },
  { name: 'Logan', role: 'regular' },
  { name: 'Sharon', role: 'regular' },
  { name: 'Zeena', role: 'regular' },
  { name: 'Lauren', role: 'regular' },
  { name: 'Veronica', role: 'regular' },
  { name: 'Aasiyah', role: 'regular' },
  { name: 'Nicole', role: 'regular' },
  { name: 'Joyce', role: 'regular' },
];

export const REGULAR_STAFF = STAFF_MEMBERS.filter(s => s.role === 'regular');

/** Unique color per staff member (HSL-based for theming) */
export const STAFF_COLORS: Record<string, string> = {
  Tracey: '#6366f1',    // indigo
  Shariefa: '#f59e0b',  // amber
  Yvette: '#10b981',    // emerald
  Sandra: '#ec4899',    // pink
  Logan: '#3b82f6',     // blue
  Sharon: '#8b5cf6',    // violet
  Zeena: '#14b8a6',     // teal
  Lauren: '#f97316',    // orange
  Veronica: '#06b6d4',  // cyan
  Aasiyah: '#e11d48',   // rose
  Nicole: '#84cc16',    // lime
  Joyce: '#a855f7',     // purple
};
