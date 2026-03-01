import React from 'react';
import { StaffStats } from '@/types/schedule';

interface StaffStatsBarProps {
  stats: StaffStats[];
}

const StaffStatsBar: React.FC<StaffStatsBarProps> = ({ stats }) => {
  if (stats.length === 0) return null;

  const regularStats = stats.filter(s => s.role === 'regular');

  return (
    <div className="no-print rounded-xl border border-border bg-card p-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Staff Overview</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {regularStats.map(s => (
          <div key={s.name} className="rounded-lg bg-muted/50 px-2.5 py-1.5">
            <p className="text-xs font-semibold text-foreground">{s.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {s.totalShifts}t · {s.dayShifts}d · {s.nightShifts}n
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StaffStatsBar;
