import { describe, it, expect } from 'vitest';
import { generateSchedule, getStaffStats } from '@/utils/scheduleGenerator';
import { REGULAR_STAFF } from '@/types/schedule';
import { getDaysInMonth, getDay } from 'date-fns';

const regularNames = REGULAR_STAFF.map(s => s.name);

function getWeekendDayRegular(year: number, month: number): number {
  if (year > 2026 || (year >= 2026 && month >= 3)) return 3;
  return 4;
}

function getMinShifts(year: number, month: number): number {
  const totalDays = getDaysInMonth(new Date(year, month));
  let weekdays = 0, weekends = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dow = getDay(new Date(year, month, d));
    if (dow === 0 || dow === 6) weekends++; else weekdays++;
  }
  const wkendDay = getWeekendDayRegular(year, month);
  const totalSlots = weekdays * 6 + weekends * (wkendDay + 3);
  const avg = totalSlots / 10;
  return Math.floor(avg) - 2; // Allow 2 below floor for cycle adjustments
}

describe('2-2-2 cycle pattern', () => {
  const months: [number, number][] = [
    [2026, 0], [2026, 1], [2026, 2], [2026, 3], [2026, 4], [2026, 5],
  ];

  it('all staff have balanced minimum shifts per month', () => {
    for (const [year, month] of months) {
      const schedule = generateSchedule(year, month, { pattern: '2day2night2off' });
      const stats = getStaffStats(schedule);
      const minShifts = getMinShifts(year, month);
      for (const s of stats.filter(s => s.role === 'regular')) {
        expect(s.totalShifts, `${s.name} in ${year}-${month + 1} has ${s.totalShifts} shifts (min: ${minShifts})`).toBeGreaterThanOrEqual(minShifts);
      }
    }
  });

  it('shift counts are balanced (max difference ≤ 5 between any two regular staff)', () => {
    for (const [year, month] of months) {
      const schedule = generateSchedule(year, month, { pattern: '2day2night2off' });
      const stats = getStaffStats(schedule).filter(s => s.role === 'regular');
      const shifts = stats.map(s => s.totalShifts);
      const diff = Math.max(...shifts) - Math.min(...shifts);
      expect(diff, `${year}-${month + 1}: min=${Math.min(...shifts)} max=${Math.max(...shifts)}`).toBeLessThanOrEqual(5);
    }
  });

  it('off days come in consecutive pairs (at least 50% of offs are paired)', () => {
    for (const [year, month] of months) {
      const schedule = generateSchedule(year, month, { pattern: '2day2night2off' });
      for (const name of regularNames) {
        const offDays: boolean[] = schedule.days.map(day =>
          !day.dayShift.includes(name) && !day.nightShift.includes(name)
        );
        let pairedOffs = 0;
        let totalOffs = offDays.filter(x => x).length;
        for (let i = 0; i < offDays.length - 1; i++) {
          if (offDays[i] && offDays[i + 1]) { pairedOffs += 2; i++; }
        }
        if (totalOffs >= 4) {
          const pairRate = pairedOffs / totalOffs;
          expect(pairRate, `${name} in ${year}-${month + 1}: ${pairedOffs}/${totalOffs} offs paired`).toBeGreaterThanOrEqual(0.5);
        }
      }
    }
  });

  it('weekend day shifts have 3 regular staff from April 2026', () => {
    const schedule = generateSchedule(2026, 3, { pattern: '2day2night2off' });
    for (const day of schedule.days) {
      const dow = getDay(day.date);
      if (dow === 0 || dow === 6) {
        const regularOnDay = day.dayShift.filter(n => regularNames.includes(n));
        expect(regularOnDay.length, `Weekend day ${day.date.toDateString()}`).toBe(3);
      }
    }
  });

  it('no night-to-day violations', () => {
    for (const [year, month] of months) {
      const schedule = generateSchedule(year, month, { pattern: '2day2night2off' });
      for (let d = 1; d < schedule.days.length; d++) {
        const prevNight = new Set(schedule.days[d - 1].nightShift.filter(n => regularNames.includes(n)));
        for (const name of schedule.days[d].dayShift) {
          if (regularNames.includes(name)) {
            expect(prevNight.has(name), `${name} on day ${d + 1}: night→day violation`).toBe(false);
          }
        }
      }
    }
  });
});
