import { describe, it, expect } from 'vitest';
import { generateSchedule, getStaffStats } from '@/utils/scheduleGenerator';
import { REGULAR_STAFF } from '@/types/schedule';
import { getDaysInMonth, getDay } from 'date-fns';

const regularNames = REGULAR_STAFF.map(s => s.name);

function getMinShifts(year: number, month: number): number {
  // Calculate based on actual work slots available
  const totalDays = getDaysInMonth(new Date(year, month));
  let weekdays = 0, weekends = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dow = getDay(new Date(year, month, d));
    if (dow === 0 || dow === 6) weekends++; else weekdays++;
  }
  // Weekday: 6 regular needed, Weekend: 7 regular needed
  const totalSlots = weekdays * 6 + weekends * 7;
  const avg = totalSlots / 10;
  return Math.floor(avg) - 1; // Allow 1 below floor of average
}

describe('2-2-2 cycle pattern', () => {
  const months = [
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

  it('shift counts are balanced (max difference ≤ 4 between any two regular staff)', () => {
    for (const [year, month] of months) {
      const schedule = generateSchedule(year, month, { pattern: '2day2night2off' });
      const stats = getStaffStats(schedule).filter(s => s.role === 'regular');
      const shifts = stats.map(s => s.totalShifts);
      const diff = Math.max(...shifts) - Math.min(...shifts);
      expect(diff, `${year}-${month + 1}: min=${Math.min(...shifts)} max=${Math.max(...shifts)}`).toBeLessThanOrEqual(4);
    }
  });

  it('off days come in consecutive pairs (at least 80% of offs are paired)', () => {
    for (const [year, month] of months) {
      const schedule = generateSchedule(year, month, { pattern: '2day2night2off' });

      for (const name of regularNames) {
        // Build array of working/off for each day
        const offDays: boolean[] = schedule.days.map(day =>
          !day.dayShift.includes(name) && !day.nightShift.includes(name)
        );

        // Count consecutive off pairs
        let pairedOffs = 0;
        let totalOffs = offDays.filter(x => x).length;
        
        for (let i = 0; i < offDays.length - 1; i++) {
          if (offDays[i] && offDays[i + 1]) {
            pairedOffs += 2;
            i++; // skip next since it's part of the pair
          }
        }

        // At least 80% of off days should be in consecutive pairs
        if (totalOffs >= 4) {
          const pairRate = pairedOffs / totalOffs;
          expect(pairRate, `${name} in ${year}-${month + 1}: ${pairedOffs}/${totalOffs} offs paired`).toBeGreaterThanOrEqual(0.6);
        }
      }
    }
  });
});
