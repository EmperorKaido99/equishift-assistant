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
 * SHIFT RULES:
 * - Tracey (Supervisor): Mon-Fri day only
 * - Shariefa (Cleaner): Mon/Wed/Fri day only (additional, not counted in the 4)
 * - Weekday day shift: 4 people total (Tracey + 3 regular)
 * - Weekend day shift: 4 regular staff (no Tracey)
 * - Night shift (every day): 3 regular staff (never Tracey or Shariefa)
 * - Each person: aim for 2 off days per week
 * - Everyone gets at least 1 weekend off per month
 */

const WEEKDAY_DAY_REGULAR = 3;  // + Tracey = 4 total
const WEEKEND_DAY_REGULAR = 4;  // no Tracey
const NIGHT_REGULAR = 3;        // always 3

export function generateSchedule(year: number, month: number, options?: ScheduleOptions): MonthSchedule {
  const pattern = options?.pattern ?? 'mixed';
  const groups = options?.groupTogether ?? [];
  const totalDays = getDaysInMonth(new Date(year, month));
  const days: DaySchedule[] = [];
  const regularNames = REGULAR_STAFF.map(s => s.name);

  // Build group membership
  const nameToGroup: Record<string, number> = {};
  groups.forEach((group, gi) => {
    group.forEach(name => { nameToGroup[name] = gi; });
  });

  // Track cumulative stats
  const stats: Record<string, { day: number; night: number; off: number; weekendOff: number }> = {};
  regularNames.forEach(name => {
    stats[name] = { day: 0, night: 0, off: 0, weekendOff: 0 };
  });

  // For pattern-based: split into two groups
  let groupA: string[] = [];
  let groupB: string[] = [];

  if (pattern !== 'mixed') {
    const ordered = reorderByGroups(regularNames, groups);
    const half = Math.ceil(ordered.length / 2); // 5
    ordered.forEach((name, i) => {
      if (i < half) groupA.push(name);
      else groupB.push(name);
    });
  }

  for (let d = 0; d < totalDays; d++) {
    const date = new Date(year, month, d + 1);
    const dow = getDay(date);
    const weekend = isWeekend(date);
    const dayShift: string[] = [];
    const nightShift: string[] = [];

    // Add supervisor and cleaner
    if (isWeekday(dow)) dayShift.push('Tracey');
    if (isCleanerDay(dow)) dayShift.push('Shariefa');

    const dayNeeded = weekend ? WEEKEND_DAY_REGULAR : WEEKDAY_DAY_REGULAR;
    const nightNeeded = NIGHT_REGULAR;
    const totalNeeded = dayNeeded + nightNeeded;
    const offCount = regularNames.length - totalNeeded;

    if (pattern === 'mixed') {
      assignMixed(regularNames, stats, dayShift, nightShift, dayNeeded, nightNeeded, offCount, weekend, d, totalDays, nameToGroup, groups);
    } else {
      // Determine which group prefers day vs night
      let dayGroup: string[];
      let nightGroup: string[];

      if (pattern === '2week') {
        const halfMonth = Math.floor(totalDays / 2);
        if (d < halfMonth) {
          dayGroup = groupA; nightGroup = groupB;
        } else {
          dayGroup = groupB; nightGroup = groupA;
        }
      } else { // 1week
        const weekNum = Math.floor(d / 7);
        if (weekNum % 2 === 0) {
          dayGroup = groupA; nightGroup = groupB;
        } else {
          dayGroup = groupB; nightGroup = groupA;
        }
      }

      assignPatternBased(dayGroup, nightGroup, stats, dayShift, nightShift, dayNeeded, nightNeeded, weekend);
    }

    days.push({ date, dayShift, nightShift });
  }

  // Post-process: ensure everyone has at least 1 weekend off
  ensureWeekendOff(days, regularNames);

  return { year, month, days };
}

function assignMixed(
  regularNames: string[],
  stats: Record<string, { day: number; night: number; off: number; weekendOff: number }>,
  dayShift: string[],
  nightShift: string[],
  dayNeeded: number,
  nightNeeded: number,
  offCount: number,
  weekend: boolean,
  dayIndex: number,
  totalDays: number,
  nameToGroup: Record<string, number>,
  groups: string[][],
) {
  const offPeople = new Set<string>();

  // Priority: give weekend off to those who haven't had one yet
  if (weekend) {
    const needWeekendOff = regularNames
      .filter(n => stats[n].weekendOff === 0)
      .sort((a, b) => (stats[b].day + stats[b].night) - (stats[a].day + stats[a].night));
    for (const name of needWeekendOff) {
      if (offPeople.size >= offCount) break;
      offPeople.add(name);
    }
  }

  // Fill remaining off slots: prefer those with most total shifts
  const byMostShifts = [...regularNames].sort(
    (a, b) => (stats[b].day + stats[b].night) - (stats[a].day + stats[a].night)
  );
  for (const name of byMostShifts) {
    if (offPeople.size >= offCount) break;
    if (offPeople.has(name)) continue;
    offPeople.add(name);
  }

  const working = regularNames.filter(n => !offPeople.has(n));

  // Assign day/night: prefer day for those with fewest day shifts, night for fewest night
  const sortedForDay = [...working].sort((a, b) => stats[a].day - stats[b].day);
  const dayWorkers = sortedForDay.slice(0, dayNeeded);
  const nightWorkers = working.filter(n => !dayWorkers.includes(n)).slice(0, nightNeeded);

  dayWorkers.forEach(n => {
    dayShift.push(n);
    stats[n].day++;
  });
  nightWorkers.forEach(n => {
    nightShift.push(n);
    stats[n].night++;
  });
  offPeople.forEach(n => {
    stats[n].off++;
    if (weekend) stats[n].weekendOff++;
  });
}

function assignPatternBased(
  dayGroup: string[],
  nightGroup: string[],
  stats: Record<string, { day: number; night: number; off: number; weekendOff: number }>,
  dayShift: string[],
  nightShift: string[],
  dayNeeded: number,
  nightNeeded: number,
  weekend: boolean,
) {
  // dayGroup (5 people) → pick dayNeeded for day shift, rest off
  // nightGroup (5 people) → pick nightNeeded for night shift, rest off
  const dayGroupSorted = [...dayGroup].sort((a, b) =>
    (stats[a].day + stats[a].night) - (stats[b].day + stats[b].night)
  );
  const nightGroupSorted = [...nightGroup].sort((a, b) =>
    (stats[a].day + stats[a].night) - (stats[b].day + stats[b].night)
  );

  const dayWorkers = dayGroupSorted.slice(0, dayNeeded);
  const dayOff = dayGroupSorted.slice(dayNeeded);
  const nightWorkers = nightGroupSorted.slice(0, nightNeeded);
  const nightOff = nightGroupSorted.slice(nightNeeded);

  dayWorkers.forEach(n => { dayShift.push(n); stats[n].day++; });
  nightWorkers.forEach(n => { nightShift.push(n); stats[n].night++; });
  [...dayOff, ...nightOff].forEach(n => {
    stats[n].off++;
    if (weekend) stats[n].weekendOff++;
  });
}

/** Ensure everyone has at least 1 weekend off by swapping if needed */
function ensureWeekendOff(days: DaySchedule[], regularNames: string[]) {
  const weekendDays = days
    .map((d, i) => ({ day: d, idx: i }))
    .filter(d => isWeekend(d.day.date));

  // Find who has zero weekend off days
  const weekendOffCount: Record<string, number> = {};
  regularNames.forEach(n => { weekendOffCount[n] = 0; });

  weekendDays.forEach(({ day }) => {
    const working = new Set([...day.dayShift, ...day.nightShift]);
    regularNames.forEach(n => {
      if (!working.has(n)) weekendOffCount[n]++;
    });
  });

  const noWeekendOff = regularNames.filter(n => weekendOffCount[n] === 0);

  for (const needsOff of noWeekendOff) {
    // Find a weekend day where this person works, and swap with someone who has plenty of weekend offs
    for (const { day, idx } of weekendDays) {
      const inDay = day.dayShift.indexOf(needsOff);
      const inNight = day.nightShift.indexOf(needsOff);
      if (inDay === -1 && inNight === -1) continue; // already off this day (shouldn't happen)

      // Find someone off this day who has many weekend offs
      const workingThisDay = new Set([...day.dayShift, ...day.nightShift]);
      const offThisDay = regularNames.filter(n => !workingThisDay.has(n) && weekendOffCount[n] > 1);
      if (offThisDay.length === 0) continue;

      const swapWith = offThisDay[0];

      // Swap them
      if (inDay !== -1) {
        day.dayShift[inDay] = swapWith;
      } else {
        day.nightShift[inNight] = swapWith;
      }
      weekendOffCount[needsOff]++;
      weekendOffCount[swapWith]--;
      break;
    }
  }
}

/** Reorder names so grouped members are adjacent */
function reorderByGroups(names: string[], groups: string[][]): string[] {
  const used = new Set<string>();
  const firstHalf: string[] = [];
  const secondHalf: string[] = [];
  const halfSize = Math.ceil(names.length / 2);

  groups.forEach((group, i) => {
    const target = i % 2 === 0 ? firstHalf : secondHalf;
    group.forEach(name => {
      if (!used.has(name)) {
        target.push(name);
        used.add(name);
      }
    });
  });

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
