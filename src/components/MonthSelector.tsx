import React from 'react';

interface MonthSelectorProps {
  year: number;
  month: number;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MonthSelector: React.FC<MonthSelectorProps> = ({
  year, month, onYearChange, onMonthChange,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={month}
        onChange={e => onMonthChange(Number(e.target.value))}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {MONTHS.map((name, i) => (
          <option key={i} value={i}>{name}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={e => onYearChange(Number(e.target.value))}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {Array.from({ length: 5 }, (_, i) => year - 2 + i).map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
};

export default MonthSelector;
