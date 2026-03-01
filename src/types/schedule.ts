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

export const STAFF_MEMBERS: StaffMember[] = [
  { name: 'Sarah', role: 'supervisor' },
  { name: 'Mike', role: 'cleaner' },
  { name: 'Alex', role: 'regular' },
  { name: 'Jordan', role: 'regular' },
  { name: 'Taylor', role: 'regular' },
  { name: 'Casey', role: 'regular' },
  { name: 'Riley', role: 'regular' },
  { name: 'Morgan', role: 'regular' },
  { name: 'Quinn', role: 'regular' },
  { name: 'Avery', role: 'regular' },
  { name: 'Blake', role: 'regular' },
  { name: 'Cameron', role: 'regular' },
];

export const REGULAR_STAFF = STAFF_MEMBERS.filter(s => s.role === 'regular');
