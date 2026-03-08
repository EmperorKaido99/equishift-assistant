import { DaySchedule, MonthSchedule, REGULAR_STAFF, StaffStats, STAFF_MEMBERS, ScheduleOptions, SchedulePattern, StaffLeave } from '@/types/schedule';
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

export function generateSchedule(year: number, month: number, options?: ScheduleOptions, leaves?: StaffLeave[]): MonthSchedule {
  const pattern = options?.pattern ?? 'mixed';
  const groups = options?.groupTogether ?? [];
  const totalDays = getDaysInMonth(new Date(year, month));
  const days: DaySchedule[] = [];
  const regularNames = REGULAR_STAFF.map(s => s.name);

  // Build leave lookup: date string -> set of unavailable names
  const leaveLookup: Record<string, Set<string>> = {};
  (leaves ?? []).forEach(l => {
    if (!leaveLookup[l.date]) leaveLookup[l.date] = new Set();
    leaveLookup[l.date].add(l.staffName);
  });

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

  // Track who worked night shift on the previous day
  let previousNightWorkers = new Set<string>();

  // For pattern-based: split into two groups
  let groupA: string[] = [];
  let groupB: string[] = [];

  if (pattern !== 'mixed' && pattern !== '2day2night2off') {
    const ordered = reorderByGroups(regularNames, groups);
    const half = Math.ceil(ordered.length / 2);
    ordered.forEach((name, i) => {
      if (i < half) groupA.push(name);
      else groupB.push(name);
    });
  }

  // For 2-2-2: build rotation slots (cycle length = 6)
  // With 10 staff, use offsets that produce ~4 day, ~3 night, ~3 off each day
  // Offsets: [0,0,1,1,2,2,3,4,4,5] give best daily coverage
  const rotationOffsets: Record<string, number> = {};
  if (pattern === '2day2night2off') {
    const offsets = [0, 0, 1, 1, 2, 2, 3, 4, 4, 5];
    regularNames.forEach((name, i) => {
      rotationOffsets[name] = offsets[i % offsets.length];
    });
  }

  for (let d = 0; d < totalDays; d++) {
    const date = new Date(year, month, d + 1);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
    const dow = getDay(date);
    const weekend = isWeekend(date);
    const dayShift: string[] = [];
    const nightShift: string[] = [];

    // Filter out unavailable staff for this day
    const unavailable = leaveLookup[dateStr] ?? new Set<string>();
    const availableRegular = regularNames.filter(n => !unavailable.has(n));

    // Add supervisor and cleaner (if not on leave)
    if (isWeekday(dow) && !unavailable.has('Tracey')) dayShift.push('Tracey');
    if (isCleanerDay(dow) && !unavailable.has('Shariefa')) dayShift.push('Shariefa');

    const dayNeeded = weekend ? WEEKEND_DAY_REGULAR : WEEKDAY_DAY_REGULAR;
    const nightNeeded = NIGHT_REGULAR;
    const totalNeeded = Math.min(dayNeeded + nightNeeded, availableRegular.length);
    const offCount = availableRegular.length - totalNeeded;

    if (pattern === 'mixed') {
      assignMixed(availableRegular, stats, dayShift, nightShift, dayNeeded, nightNeeded, offCount, weekend, d, totalDays, nameToGroup, groups, previousNightWorkers);
    } else if (pattern === '2day2night2off') {
      assign222Cycle(availableRegular, regularNames, rotationOffsets, stats, dayShift, nightShift, dayNeeded, nightNeeded, weekend, d, previousNightWorkers);
    } else {
      let dayGroup: string[];
      let nightGroup: string[];

      if (pattern === '2week') {
        const halfMonth = Math.floor(totalDays / 2);
        if (d < halfMonth) {
          dayGroup = groupA; nightGroup = groupB;
        } else {
          dayGroup = groupB; nightGroup = groupA;
        }
      } else {
        const weekNum = Math.floor(d / 7);
        if (weekNum % 2 === 0) {
          dayGroup = groupA; nightGroup = groupB;
        } else {
          dayGroup = groupB; nightGroup = groupA;
        }
      }

      assignPatternBased(dayGroup.filter(n => availableRegular.includes(n)), nightGroup.filter(n => availableRegular.includes(n)), stats, dayShift, nightShift, dayNeeded, nightNeeded, weekend, previousNightWorkers);
    }

    // Update previous night workers for next day's constraint
    previousNightWorkers = new Set(nightShift.filter(n => regularNames.includes(n)));

    days.push({ date, dayShift, nightShift });
  }

  // Post-process: ensure everyone has at least 1 weekend off
  ensureWeekendOff(days, regularNames);
  // Post-process: fix any night→day violations from weekend-off swaps
  fixNightToDayViolations(days, regularNames);

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
  previousNightWorkers: Set<string>,
) {
  const offPeople = new Set<string>();

  // People who worked night last night CANNOT work day today — they must be off or on night
  const mustNotDay = new Set(regularNames.filter(n => previousNightWorkers.has(n)));

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

  // Separate workers: those who MUST NOT do day (previous night) go to night first
  const mustNightWorkers = working.filter(n => mustNotDay.has(n));
  const flexWorkers = working.filter(n => !mustNotDay.has(n));

  // Fill night shift: prioritize mustNightWorkers, then by fewest night shifts
  const nightWorkers: string[] = [];
  for (const n of mustNightWorkers) {
    if (nightWorkers.length >= nightNeeded) break;
    nightWorkers.push(n);
  }
  const remainingFlex = [...flexWorkers].sort((a, b) => stats[a].night - stats[b].night);
  for (const n of remainingFlex) {
    if (nightWorkers.length >= nightNeeded) break;
    nightWorkers.push(n);
  }

  // If still not enough night workers, pull from mustNight who didn't fit
  const nightSet = new Set(nightWorkers);

  // Fill day shift from remaining workers (excluding night workers and mustNotDay)
  const dayPool = working.filter(n => !nightSet.has(n) && !mustNotDay.has(n));
  const sortedForDay = [...dayPool].sort((a, b) => stats[a].day - stats[b].day);
  const dayWorkers = sortedForDay.slice(0, dayNeeded);

  // Any mustNotDay workers not on night go to off
  const mustNotDayLeftover = mustNightWorkers.filter(n => !nightSet.has(n));

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
  mustNotDayLeftover.forEach(n => {
    stats[n].off++;
    if (weekend) stats[n].weekendOff++;
  });
}

function assign222Cycle(
  availableRegular: string[],
  allRegular: string[],
  rotationOffsets: Record<string, number>,
  stats: Record<string, { day: number; night: number; off: number; weekendOff: number }>,
  dayShift: string[],
  nightShift: string[],
  dayNeeded: number,
  nightNeeded: number,
  weekend: boolean,
  dayIndex: number,
  previousNightWorkers: Set<string>,
) {
  // CYCLE-FIRST approach: follow the 2-2-2 pattern strictly.
  // Prefer keeping off phase intact; only pull from off as last resort
  // (prefer phase 4 = first off day, to keep phase 5 = second off day intact).

  const mustNotDay = new Set(availableRegular.filter(n => previousNightWorkers.has(n)));
  const totalShifts = (n: string) => stats[n].day + stats[n].night;

  // Step 1: Determine each person's cycle phase
  const personPhase: Record<string, number> = {};
  const cycleDay: string[] = [];
  const cycleNight: string[] = [];
  const cycleOff: string[] = [];

  for (const name of availableRegular) {
    const phase = (dayIndex + rotationOffsets[name]) % 6;
    personPhase[name] = phase;
    if (phase < 2) cycleDay.push(name);
    else if (phase < 4) cycleNight.push(name);
    else cycleOff.push(name);
  }

  // Step 2: Enforce night→day constraint
  const constrainedFromDay = cycleDay.filter(n => mustNotDay.has(n));
  let adjustedDay = cycleDay.filter(n => !mustNotDay.has(n));
  let adjustedNight = [...cycleNight, ...constrainedFromDay];
  let adjustedOff = [...cycleOff];

  // Step 3: Balance — redistribute between day/night first
  while (adjustedDay.length > dayNeeded) {
    const sorted = [...adjustedDay].sort((a, b) => totalShifts(b) - totalShifts(a));
    const removed = sorted[0];
    adjustedDay = adjustedDay.filter(n => n !== removed);
    if (adjustedNight.length < nightNeeded) adjustedNight.push(removed);
    else adjustedOff.push(removed);
  }

  while (adjustedDay.length < dayNeeded && adjustedNight.length > nightNeeded) {
    const candidates = adjustedNight.filter(n => !mustNotDay.has(n))
      .sort((a, b) => totalShifts(a) - totalShifts(b));
    if (candidates.length === 0) break;
    adjustedNight = adjustedNight.filter(n => n !== candidates[0]);
    adjustedDay.push(candidates[0]);
  }

  while (adjustedNight.length > nightNeeded) {
    const sorted = [...adjustedNight].sort((a, b) => totalShifts(b) - totalShifts(a));
    adjustedNight = adjustedNight.filter(n => n !== sorted[0]);
    adjustedOff.push(sorted[0]);
  }

  while (adjustedNight.length < nightNeeded && adjustedDay.length > dayNeeded) {
    const sorted = [...adjustedDay].sort((a, b) => totalShifts(a) - totalShifts(b));
    adjustedDay = adjustedDay.filter(n => n !== sorted[0]);
    adjustedNight.push(sorted[0]);
  }

  // Step 4: If STILL short on workers, pull from off as last resort
  // Prefer phase 4 (first off day) over phase 5 (second off day)
  while (adjustedDay.length < dayNeeded && adjustedOff.length > 0) {
    const candidates = adjustedOff
      .filter(n => !mustNotDay.has(n))
      .sort((a, b) => {
        // Prefer phase 4 (first off day) — breaking their first off preserves the second
        const aFirst = personPhase[a] === 4 ? 0 : 1;
        const bFirst = personPhase[b] === 4 ? 0 : 1;
        if (aFirst !== bFirst) return aFirst - bFirst;
        return totalShifts(a) - totalShifts(b);
      });
    if (candidates.length === 0) break;
    adjustedOff = adjustedOff.filter(n => n !== candidates[0]);
    adjustedDay.push(candidates[0]);
  }

  while (adjustedNight.length < nightNeeded && adjustedOff.length > 0) {
    const candidates = [...adjustedOff].sort((a, b) => {
      const aFirst = personPhase[a] === 4 ? 0 : 1;
      const bFirst = personPhase[b] === 4 ? 0 : 1;
      if (aFirst !== bFirst) return aFirst - bFirst;
      return totalShifts(a) - totalShifts(b);
    });
    if (candidates.length === 0) break;
    adjustedOff = adjustedOff.filter(n => n !== candidates[0]);
    adjustedNight.push(candidates[0]);
  }

  adjustedDay.forEach(n => { dayShift.push(n); stats[n].day++; });
  adjustedNight.forEach(n => { nightShift.push(n); stats[n].night++; });
  adjustedOff.forEach(n => {
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
  previousNightWorkers: Set<string>,
) {
  // Anyone who worked night yesterday cannot do day today
  // If they're in dayGroup, move them to night; swap someone from nightGroup to day
  const mustNotDay = new Set(dayGroup.filter(n => previousNightWorkers.has(n)));

  // Remove mustNotDay from dayGroup, add to nightGroup pool
  const adjustedDayGroup = dayGroup.filter(n => !mustNotDay.has(n));
  const adjustedNightGroup = [...nightGroup, ...Array.from(mustNotDay)];

  const dayGroupSorted = [...adjustedDayGroup].sort((a, b) =>
    (stats[a].day + stats[a].night) - (stats[b].day + stats[b].night)
  );
  const nightGroupSorted = [...adjustedNightGroup].sort((a, b) =>
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

/** Fix any night→day violations introduced by post-processing swaps */
function fixNightToDayViolations(days: DaySchedule[], regularNames: string[]) {
  for (let d = 1; d < days.length; d++) {
    const prevNight = new Set(days[d - 1].nightShift.filter(n => regularNames.includes(n)));
    const today = days[d];

    for (const name of Array.from(prevNight)) {
      const dayIdx = today.dayShift.indexOf(name);
      if (dayIdx === -1) continue; // not on day shift, no violation

      // Find someone on night shift today (or off) who wasn't on night yesterday to swap
      const working = new Set([...today.dayShift, ...today.nightShift]);
      const offToday = regularNames.filter(n => !working.has(n) && !prevNight.has(n));

      if (offToday.length > 0) {
        // Swap with someone who's off
        today.dayShift[dayIdx] = offToday[0];
      } else {
        // Try swapping with a night worker who wasn't on night yesterday
        const nightSwapIdx = today.nightShift.findIndex(n => regularNames.includes(n) && !prevNight.has(n));
        if (nightSwapIdx !== -1) {
          const swapName = today.nightShift[nightSwapIdx];
          today.dayShift[dayIdx] = swapName;
          today.nightShift[nightSwapIdx] = name;
        }
      }
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
