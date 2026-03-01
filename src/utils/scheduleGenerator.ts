import { DaySchedule, MonthSchedule, REGULAR_STAFF, StaffStats, STAFF_MEMBERS, ScheduleOptions, SchedulePattern } from '@/types/schedule';
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

/**
 * Determine shift preference for a staff member on a given day based on pattern.
 * Returns 'day' or 'night'.
 */
function getPatternShift(
  pattern: SchedulePattern,
  staffIndex: number,
  dayIndex: number,
  totalDays: number
): 'day' | 'night' {
  const halfStaff = Math.ceil(REGULAR_STAFF.length / 2); // 5
  const isGroupA = staffIndex < halfStaff;

  switch (pattern) {
    case '2week': {
      const halfMonth = Math.floor(totalDays / 2);
      const firstHalf = dayIndex < halfMonth;
      if (isGroupA) return firstHalf ? 'day' : 'night';
      return firstHalf ? 'night' : 'day';
    }
    case '1week': {
      const weekNum = Math.floor(dayIndex / 7);
      const evenWeek = weekNum % 2 === 0;
      if (isGroupA) return evenWeek ? 'day' : 'night';
      return evenWeek ? 'night' : 'day';
    }
    case 'mixed':
    default:
      return null as any; // handled separately
  }
}

export function generateSchedule(year: number, month: number, options?: ScheduleOptions): MonthSchedule {
  const pattern = options?.pattern ?? 'mixed';
  const groups = options?.groupTogether ?? [];
  const totalDays = getDaysInMonth(new Date(year, month));
  const days: DaySchedule[] = [];
  const regularNames = REGULAR_STAFF.map(s => s.name);

  // Build group membership: map each name to a group index
  const nameToGroup: Record<string, number> = {};
  groups.forEach((group, gi) => {
    group.forEach(name => { nameToGroup[name] = gi; });
  });

  // Track shifts
  const staffShifts: Record<string, { day: number; night: number; weekend: number }> = {};
  REGULAR_STAFF.forEach(s => {
    staffShifts[s.name] = { day: 0, night: 0, weekend: 0 };
  });

  // Build day structures with supervisor/cleaner
  for (let d = 0; d < totalDays; d++) {
    const date = new Date(year, month, d + 1);
    const dayShift: string[] = [];
    const nightShift: string[] = [];
    const dow = getDay(date);

    if (isWeekday(dow)) dayShift.push('Tracey');
    if (isCleanerDay(dow)) dayShift.push('Shariefa');

    days.push({ date, dayShift, nightShift });
  }

  if (pattern === '2week' || pattern === '1week') {
    // Pattern-based assignment: assign each regular staff based on pattern
    // Reorder staff so grouped people get adjacent indices (same group = same shift)
    const ordered = reorderByGroups(regularNames, groups);

    for (let d = 0; d < totalDays; d++) {
      const weekend = isWeekend(days[d].date);
      ordered.forEach((name, staffIdx) => {
        const pref = getPatternShift(pattern, staffIdx, d, totalDays);
        if (pref === 'day') {
          days[d].dayShift.push(name);
          staffShifts[name].day++;
        } else {
          days[d].nightShift.push(name);
          staffShifts[name].night++;
        }
        if (weekend) staffShifts[name].weekend++;
      });
    }
  } else {
    // Mixed: greedy balanced assignment respecting groups
    for (let d = 0; d < totalDays; d++) {
      const weekend = isWeekend(days[d].date);
      const dayNeeded = 4;
      const nightNeeded = 5;

      // Sort by total shifts ascending
      const sorted = [...regularNames].sort((a, b) => {
        const sa = staffShifts[a], sb = staffShifts[b];
        const totalDiff = (sa.day + sa.night) - (sb.day + sb.night);
        if (totalDiff !== 0) return totalDiff;
        return sa.day - sb.day;
      });

      const assignedDay = new Set<string>();
      const assignedNight = new Set<string>();

      // Assign day shift
      for (const name of sorted) {
        if (assignedDay.size >= dayNeeded) break;
        if (assignedDay.has(name) || assignedNight.has(name)) continue;
        assignedDay.add(name);
        // Pull in grouped members to same shift
        if (nameToGroup[name] !== undefined) {
          const group = groups[nameToGroup[name]];
          group.forEach(gn => {
            if (gn !== name && !assignedDay.has(gn) && !assignedNight.has(gn)) {
              assignedDay.add(gn);
            }
          });
        }
      }

      // Assign night shift from remaining
      for (const name of sorted) {
        if (assignedNight.size >= nightNeeded) break;
        if (assignedDay.has(name) || assignedNight.has(name)) continue;
        assignedNight.add(name);
        if (nameToGroup[name] !== undefined) {
          const group = groups[nameToGroup[name]];
          group.forEach(gn => {
            if (gn !== name && !assignedDay.has(gn) && !assignedNight.has(gn)) {
              assignedNight.add(gn);
            }
          });
        }
      }

      // Any unassigned go to whichever shift is smaller
      for (const name of regularNames) {
        if (!assignedDay.has(name) && !assignedNight.has(name)) {
          if (assignedDay.size <= assignedNight.size) {
            assignedDay.add(name);
          } else {
            assignedNight.add(name);
          }
        }
      }

      assignedDay.forEach(name => {
        days[d].dayShift.push(name);
        staffShifts[name].day++;
        if (weekend) staffShifts[name].weekend++;
      });
      assignedNight.forEach(name => {
        days[d].nightShift.push(name);
        staffShifts[name].night++;
        if (weekend) staffShifts[name].weekend++;
      });
    }
  }

  return { year, month, days };
}

/** Reorder names so grouped members are adjacent (in first half or second half together) */
function reorderByGroups(names: string[], groups: string[][]): string[] {
  const used = new Set<string>();
  const firstHalf: string[] = [];
  const secondHalf: string[] = [];
  const halfSize = Math.ceil(names.length / 2);

  // Place groups: alternate placing whole groups into first/second half
  groups.forEach((group, i) => {
    const target = i % 2 === 0 ? firstHalf : secondHalf;
    group.forEach(name => {
      if (!used.has(name)) {
        target.push(name);
        used.add(name);
      }
    });
  });

  // Fill remaining
  for (const name of names) {
    if (used.has(name)) continue;
    if (firstHalf.length < halfSize) {
      firstHalf.push(name);
    } else {
      secondHalf.push(name);
    }
    used.add(name);
  }

  return [...firstHalf, ...secondHalf];
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
