import * as XLSX from 'xlsx';
import { MonthSchedule, STAFF_MEMBERS } from '@/types/schedule';
import { format, isWeekend } from 'date-fns';

export function exportToExcel(schedule: MonthSchedule) {
  const staffNames = STAFF_MEMBERS.map(s => s.name);
  const header = ['Date', 'Day', ...staffNames];

  const rows = schedule.days.map(day => {
    const row: string[] = [
      format(day.date, 'yyyy-MM-dd'),
      format(day.date, 'EEEE'),
    ];
    for (const name of staffNames) {
      if (day.dayShift.includes(name)) row.push('DAY');
      else if (day.nightShift.includes(name)) row.push('NIGHT');
      else row.push('OFF');
    }
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Auto-width columns
  ws['!cols'] = header.map((h, i) => ({ wch: i < 2 ? 12 : 9 }));

  const wb = XLSX.utils.book_new();
  const sheetName = format(new Date(schedule.year, schedule.month, 1), 'MMM yyyy');
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `Schedule_${sheetName.replace(' ', '_')}.xlsx`);
}
