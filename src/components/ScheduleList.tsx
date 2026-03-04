import React from 'react';
import { MonthSchedule, STAFF_COLORS } from '@/types/schedule';
import { formatDayHeader, getRoleLabel } from '@/utils/scheduleGenerator';
import { isWeekend } from 'date-fns';

interface ScheduleListProps {
  schedule: MonthSchedule;
  highlightDays: number[];
}

const ScheduleList: React.FC<ScheduleListProps> = ({ schedule, highlightDays }) => {
  // Compute off staff per day
  const allStaffNames = Object.keys(STAFF_COLORS);

  return (
    <div className="space-y-1">
      {schedule.days.map((day, idx) => {
        const weekend = isWeekend(day.date);
        const highlighted = highlightDays.includes(idx);
        const working = new Set([...day.dayShift, ...day.nightShift]);
        const offStaff = allStaffNames.filter(n => !working.has(n));

        return (
          <div
            key={idx}
            className={`print-schedule rounded-lg border border-border p-3 transition-colors ${
              weekend ? 'bg-muted/50' : 'bg-card'
            } ${highlighted ? 'highlight-flash' : ''}`}
          >
            <h3 className={`text-sm font-semibold mb-2 ${weekend ? 'text-muted-foreground' : 'text-foreground'}`}>
              {formatDayHeader(day.date)}
              {weekend && <span className="ml-2 text-xs font-normal text-muted-foreground">(Weekend)</span>}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Day Shift */}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-base leading-none">🌞</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-day-shift mb-0.5">Day Shift</p>
                  {day.dayShift.length > 0 ? (
                    <ul className="space-y-0.5">
                      {day.dayShift.map(name => (
                        <li key={name} className="text-sm" style={{ color: STAFF_COLORS[name] }}>
                          • <span className="font-medium">{name}</span>{' '}
                          <span className="text-muted-foreground text-xs">{getRoleLabel(name)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No staff assigned</p>
                  )}
                </div>
              </div>

              {/* Night Shift */}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-base leading-none">🌙</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-night-shift mb-0.5">Night Shift</p>
                  {day.nightShift.length > 0 ? (
                    <ul className="space-y-0.5">
                      {day.nightShift.map(name => (
                        <li key={name} className="text-sm" style={{ color: STAFF_COLORS[name] }}>
                          • <span className="font-medium">{name}</span>{' '}
                          <span className="text-muted-foreground text-xs">{getRoleLabel(name)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No staff assigned</p>
                  )}
                </div>
              </div>

              {/* Off */}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-base leading-none">🔴</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-destructive mb-0.5">Off</p>
                  {offStaff.length > 0 ? (
                    <ul className="space-y-0.5">
                      {offStaff.map(name => (
                        <li key={name} className="text-sm text-destructive">
                          • <span className="font-medium">{name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Everyone working</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ScheduleList;
