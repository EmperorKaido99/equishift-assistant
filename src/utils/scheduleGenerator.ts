import { DaySchedule, MonthSchedule, REGULAR_STAFF, StaffStats, STAFF_MEMBERS } from '@/types/schedule';
import {
  getDaysInMonth,
  getDay,
  isWeekend,
  format,
} from 'date-fns';

function isCleanerDay(dayOfWeek: number): boolean {
  return dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5; // Mon, Wed, Fri
}

function isWeekday(dayOfWeek: number): boolean {
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

export function generateSchedule(year: number, month: number): MonthSchedule {
  const totalDays = getDaysInMonth(new Date(year, month));
  const days: DaySchedule[] = [];

  // Track shifts per regular staff
  const staffShifts: Record<string, { day: number; night: number; weekend: number; assignments: { dayIndex: number; type: 'day' | 'night' }[] }> = {};
  REGULAR_STAFF.forEach(s => {
    staffShifts[s.name] = { day: 0, night: 0, weekend: 0, assignments: [] };
  });

  // Build day structures
  for (let d = 0; d < totalDays; d++) {
    const date = new Date(year, month, d + 1);
    const dayShift: string[] = [];
    const nightShift: string[] = [];

    const dow = getDay(date); // 0=Sun, 6=Sat
    const weekend = dow === 0 || dow === 6;

    // Supervisor: weekdays only, day only
    if (isWeekday(dow)) {
      dayShift.push('Sarah');
    }

    // Cleaner: Mon/Wed/Fri, day only
    if (isCleanerDay(dow)) {
      dayShift.push('Mike');
    }

    days.push({ date, dayShift, nightShift });
  }

  // Now assign regular staff fairly
  // Target: each person ~18-19 total shifts, ~9-10 day, ~9-10 night
  const targetTotal = Math.round((totalDays * 2 * 5) / 10); // ~5 per shift type per day, 10 people
  // Actually: we need to decide how many regular staff per day/night shift
  // Let's aim for 4-5 regular staff per day shift and 5 per night shift
  
  const regularNames = REGULAR_STAFF.map(s => s.name);
  
  // For each day, assign regular staff to day and night shifts
  // We'll use a greedy approach: prioritize staff with fewer shifts
  for (let d = 0; d < totalDays; d++) {
    const date = days[d].date;
    const weekend = isWeekend(date);
    
    // Determine how many regular staff needed per shift
    // Day shift: ~4-5 regular + special roles
    // Night shift: ~5 regular
    const dayNeeded = 4;
    const nightNeeded = 5;

    // Sort by total shifts ascending, then by shift type balance
    const availableForDay = [...regularNames]
      .filter(name => !days[d].dayShift.includes(name) && !days[d].nightShift.includes(name))
      .sort((a, b) => {
        const sa = staffShifts[a], sb = staffShifts[b];
        const totalDiff = (sa.day + sa.night) - (sb.day + sb.night);
        if (totalDiff !== 0) return totalDiff;
        return sa.day - sb.day; // prefer less day shifts
      });

    for (let i = 0; i < Math.min(dayNeeded, availableForDay.length); i++) {
      const name = availableForDay[i];
      days[d].dayShift.push(name);
      staffShifts[name].day++;
      if (weekend) staffShifts[name].weekend++;
      staffShifts[name].assignments.push({ dayIndex: d, type: 'day' });
    }

    const assignedToDay = new Set(days[d].dayShift);
    const availableForNight = [...regularNames]
      .filter(name => !assignedToDay.has(name))
      .sort((a, b) => {
        const sa = staffShifts[a], sb = staffShifts[b];
        const totalDiff = (sa.day + sa.night) - (sb.day + sb.night);
        if (totalDiff !== 0) return totalDiff;
        return sa.night - sb.night;
      });

    for (let i = 0; i < Math.min(nightNeeded, availableForNight.length); i++) {
      const name = availableForNight[i];
      days[d].nightShift.push(name);
      staffShifts[name].night++;
      if (weekend) staffShifts[name].weekend++;
      staffShifts[name].assignments.push({ dayIndex: d, type: 'night' });
    }
  }

  return { year, month, days };
}

export function getStaffStats(schedule: MonthSchedule): StaffStats[] {
  const stats: Record<string, StaffStats> = {};
  
  STAFF_MEMBERS.forEach(s => {
    stats[s.name] = {
      name: s.name,
      role: s.role,
      totalShifts: 0,
      dayShifts: 0,
      nightShifts: 0,
      weekendShifts: 0,
    };
  });

  schedule.days.forEach(day => {
    const weekend = isWeekend(day.date);
    day.dayShift.forEach(name => {
      if (stats[name]) {
        stats[name].totalShifts++;
        stats[name].dayShifts++;
        if (weekend) stats[name].weekendShifts++;
      }
    });
    day.nightShift.forEach(name => {
      if (stats[name]) {
        stats[name].totalShifts++;
        stats[name].nightShifts++;
        if (weekend) stats[name].weekendShifts++;
      }
    });
  });

  return Object.values(stats);
}

export function formatDayHeader(date: Date): string {
  return format(date, 'EEEE, MMMM d');
}

export function getRoleLabel(name: string): string {
  const member = STAFF_MEMBERS.find(s => s.name === name);
  if (member?.role === 'supervisor') return '(Supervisor)';
  if (member?.role === 'cleaner') return '(Cleaner)';
  return '';
}
