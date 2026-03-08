import { describe, it, expect } from 'vitest';
import { generateSchedule } from '@/utils/scheduleGenerator';
import { REGULAR_STAFF } from '@/types/schedule';

const regularNames = REGULAR_STAFF.map(s => s.name);

function findViolations(year: number, month: number, pattern: 'mixed' | '1week' | '2week' | '2day2night2off') {
  const schedule = generateSchedule(year, month, { pattern });
  const violations: string[] = [];

  for (let d = 1; d < schedule.days.length; d++) {
    const prevNight = new Set(schedule.days[d - 1].nightShift.filter(n => regularNames.includes(n)));
    const todayDay = schedule.days[d].dayShift.filter(n => regularNames.includes(n));

    for (const name of todayDay) {
      if (prevNight.has(name)) {
        violations.push(`${name}: night on day ${d} → day on day ${d + 1}`);
      }
    }
  }
  return violations;
}

describe('No night-then-day violations', () => {
  const months = [
    [2026, 0], [2026, 1], [2026, 2], [2026, 3], [2026, 4], [2026, 5],
  ];

  for (const pattern of ['mixed', '1week', '2week', '2day2night2off'] as const) {
    it(`pattern="${pattern}" has no violations across 6 months`, () => {
      for (const [year, month] of months) {
        const violations = findViolations(year, month, pattern);
        expect(violations, `${pattern} ${year}-${month + 1}: ${violations.join('; ')}`).toEqual([]);
      }
    });
  }
});
