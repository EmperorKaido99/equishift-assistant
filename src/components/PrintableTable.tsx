import React from 'react';
import { MonthSchedule, STAFF_MEMBERS, STAFF_COLORS } from '@/types/schedule';
import { format, isWeekend } from 'date-fns';

interface PrintableTableProps {
  schedule: MonthSchedule;
  colorMode: boolean;
}

const PrintableTable: React.FC<PrintableTableProps> = ({ schedule, colorMode }) => {
  const staffNames = STAFF_MEMBERS.map(s => s.name);

  const getCellValue = (dayIndex: number, name: string): string => {
    const day = schedule.days[dayIndex];
    const onDay = day.dayShift.includes(name);
    const onNight = day.nightShift.includes(name);
    if (onDay) return 'DAY';
    if (onNight) return 'NIGHT';
    return 'OFF';
  };

  return (
    <div className="print-table-container hidden print:block">
      <h2 className="text-center text-base font-bold mb-2">
        {format(new Date(schedule.year, schedule.month, 1), 'MMMM yyyy')} — Shift Schedule
      </h2>
      <table className="print-table w-full border-collapse text-[9px]">
        <thead>
          <tr>
            <th className="border border-gray-400 px-1 py-0.5 bg-gray-200 text-left">Date</th>
            <th className="border border-gray-400 px-1 py-0.5 bg-gray-200 text-left">Day</th>
            {staffNames.map(name => (
              <th
                key={name}
                className="border border-gray-400 px-1 py-0.5 bg-gray-200 text-center whitespace-nowrap"
                style={colorMode ? { color: STAFF_COLORS[name] } : undefined}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.days.map((day, idx) => {
            const weekend = isWeekend(day.date);
            return (
              <tr key={idx} className={weekend ? 'bg-gray-100' : ''}>
                <td className="border border-gray-400 px-1 py-0.5 whitespace-nowrap font-medium">
                  {format(day.date, 'yyyy-MM-dd')}
                </td>
                <td className="border border-gray-400 px-1 py-0.5 whitespace-nowrap">
                  {format(day.date, 'EEEE')}
                </td>
                {staffNames.map(name => {
                  const val = getCellValue(idx, name);
                  const isOff = val === 'OFF';
                  const bgColor = colorMode
                    ? isOff
                      ? '#fee2e2'
                      : val === 'DAY'
                        ? '#dbeafe'
                        : '#e0e7ff'
                    : undefined;
                  const textColor = colorMode
                    ? isOff
                      ? '#dc2626'
                      : STAFF_COLORS[name]
                    : undefined;

                  return (
                    <td
                      key={name}
                      className="border border-gray-400 px-1 py-0.5 text-center font-medium"
                      style={{
                        backgroundColor: bgColor,
                        color: textColor,
                      }}
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PrintableTable;
