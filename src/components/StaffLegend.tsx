import React from 'react';
import { STAFF_MEMBERS, STAFF_COLORS } from '@/types/schedule';

const StaffLegend: React.FC = () => {
  return (
    <div className="no-print rounded-xl border border-border bg-card p-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Staff Legend</h3>
      <div className="flex flex-wrap gap-2">
        {STAFF_MEMBERS.map(s => (
          <span
            key={s.name}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ color: STAFF_COLORS[s.name], backgroundColor: `${STAFF_COLORS[s.name]}15` }}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STAFF_COLORS[s.name] }}
            />
            {s.name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-destructive bg-destructive/10">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
          Off
        </span>
      </div>
    </div>
  );
};

export default StaffLegend;
