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
 * From April 2026 onward, weekend day shifts use 3 regular staff (was 4).
 * This aligns with the 2-2-2 cycle math (10 staff, 3D+3N=6 working, 4 off).
 */
function getWeekendDayRegular(year: number, month: number): number {
  if (year > 2026 || (year >= 2026 && month >= 3)) return 3;
  return 4;
}

/**
 * SHIFT RULES:
 * - Tracey (Supervisor): Mon-Fri day only
 * - Shariefa (Cleaner): Mon/Wed/Fri day only (additional, not counted)
 * - Weekday day shift: 4 people total (Tracey + 3 regular)
 * - Weekend day shift: 3 regular (from April 2026) or 4 regular (before)
 * - Night shift (every day): 3 regular staff
 * - 2-2-2 cycle: 2 day shifts, 2 night shifts, 2 off days (rotation)
 * - Everyone gets at least 1 weekend off per month
 */

const WEEKDAY_DAY_REGULAR = 3;  // + Tracey = 4 total
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

  // For 2-2-2: fixed rotation offsets (cycle length = 6)
  const rotationOffsets: Record<string, number> = {};
  // Track how many times each person has been bumped off their ideal cycle position
  const bumpCount: Record<string, number> = {};
  if (pattern === '2day2night2off') {
    const offsetPattern = [0, 2, 4, 5, 1, 3, 0, 2, 4, 5];
    regularNames.forEach((name, i) => {
      rotationOffsets[name] = offsetPattern[i % offsetPattern.length];
      bumpCount[name] = 0;
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

    const dayNeeded = weekend ? getWeekendDayRegular(year, month) : WEEKDAY_DAY_REGULAR;
    const nightNeeded = NIGHT_REGULAR;
    const totalNeeded = Math.min(dayNeeded + nightNeeded, availableRegular.length);
    const offCount = availableRegular.length - totalNeeded;

    if (pattern === 'mixed') {
      assignMixed(availableRegular, stats, dayShift, nightShift, dayNeeded, nightNeeded, offCount, weekend, d, totalDays, nameToGroup, groups, previousNightWorkers);
    } else if (pattern === '2day2night2off') {
      assign222Cycle(availableRegular, regularNames, rotationOffsets, bumpCount, stats, dayShift, nightShift, dayNeeded, nightNeeded, weekend, d, previousNightWorkers);
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

  // Post-process: skip for 2-2-2 cycle as it handles its own balance
  if (pattern !== '2day2night2off') {
    ensureWeekendOff(days, regularNames);
    fixNightToDayViolations(days, regularNames);
  }

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

/**
 * 2-2-2 Cycle with fixed offsets + phase-aware bumping.
 * Phase 0,1=Day | 2,3=Night | 4,5=Off
 * Protects phase 5 (2nd off day) from being pulled to work.
 * Prefers bumping phase 1/3 (2nd work day) over phase 0/2 (1st work day).
 */
function assign222Cycle(
  availableRegular: string[],
  allRegular: string[],
  rotationOffsets: Record<string, number>,
  bumpCount: Record<string, number>,
  stats: Record<string, { day: number; night: number; off: number; weekendOff: number }>,
  dayShift: string[],
  nightShift: string[],
  dayNeeded: number,
  nightNeeded: number,
  weekend: boolean,
  dayIndex: number,
  previousNightWorkers: Set<string>,
) {
  const totalShifts = (n: string) => stats[n].day + stats[n].night;
  const mustNotDay = new Set(availableRegular.filter(n => previousNightWorkers.has(n)));

  const phases: Record<string, number> = {};
  const pools: { D: string[]; N: string[]; O: string[] } = { D: [], N: [], O: [] };

  for (const name of availableRegular) {
    phases[name] = (dayIndex + rotationOffsets[name]) % 6;
    let assignment: 'D' | 'N' | 'O';
    if (phases[name] < 2) assignment = 'D';
    else if (phases[name] < 4) assignment = 'N';
    else assignment = 'O';
    if (assignment === 'D' && mustNotDay.has(name)) assignment = 'N';
    pools[assignment].push(name);
  }

  const offNeeded = Math.max(0, availableRegular.length - dayNeeded - nightNeeded);

  // Bump D/N → O: PRIMARY sort by most totalShifts (balance first), then phase tiebreak
  const nameIdx: Record<string, number> = {};
  availableRegular.forEach((n, i) => { nameIdx[n] = i; });
  const bumpSort = (a: string, b: string) => {
    const diff = totalShifts(b) - totalShifts(a); // most shifts bumped first
    if (diff !== 0) return diff;
    // Rotating tiebreaker to prevent always picking same person
    return ((nameIdx[a] + dayIndex) % 10) - ((nameIdx[b] + dayIndex) % 10);
  };

  // Pull O → work: NEVER phase 5 if avoidable, then fewest totalShifts
  const pullSort = (a: string, b: string) => {
    const aProt = phases[a] === 5 ? 1 : 0;
    const bProt = phases[b] === 5 ? 1 : 0;
    if (aProt !== bProt) return aProt - bProt;
    const diff = totalShifts(a) - totalShifts(b); // fewest shifts pulled first
    if (diff !== 0) return diff;
    return ((nameIdx[a] + dayIndex) % 10) - ((nameIdx[b] + dayIndex) % 10);
  };

  while (pools.D.length > dayNeeded) {
    pools.D.sort(bumpSort);
    bumpCount[pools.D[0]]++;
    pools.O.push(pools.D.shift()!);
  }
  while (pools.N.length > nightNeeded) {
    pools.N.sort(bumpSort);
    bumpCount[pools.N[0]]++;
    pools.O.push(pools.N.shift()!);
  }
  while (pools.D.length < dayNeeded && pools.O.length > offNeeded) {
    const c = pools.O.filter(n => !mustNotDay.has(n));
    if (!c.length) break;
    c.sort(pullSort);
    bumpCount[c[0]]++;
    pools.O = pools.O.filter(n => n !== c[0]);
    pools.D.push(c[0]);
  }
  while (pools.N.length < nightNeeded && pools.O.length > offNeeded) {
    const c = [...pools.O]; c.sort(pullSort);
    bumpCount[c[0]]++;
    pools.O = pools.O.filter(n => n !== c[0]);
    pools.N.push(c[0]);
  }
  while (pools.D.length < dayNeeded && pools.N.length > nightNeeded) {
    const c = pools.N.filter(n => !mustNotDay.has(n));
    if (!c.length) break;
    c.sort((a, b) => totalShifts(a) - totalShifts(b));
    pools.N = pools.N.filter(n => n !== c[0]);
    pools.D.push(c[0]);
  }

  pools.D.forEach(n => { dayShift.push(n); stats[n].day++; });
  pools.N.forEach(n => { nightShift.push(n); stats[n].night++; });
  pools.O.forEach(n => { stats[n].off++; if (weekend) stats[n].weekendOff++; });
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
