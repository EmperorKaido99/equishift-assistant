import React, { useState } from 'react';
import { STAFF_MEMBERS, STAFF_COLORS, StaffLeave } from '@/types/schedule';
import { format } from 'date-fns';
import { CalendarOff, Plus, X } from 'lucide-react';

interface LeaveManagerProps {
  leaves: StaffLeave[];
  onAddLeave: (leave: StaffLeave) => void;
  onRemoveLeave: (index: number) => void;
}

const REASONS = ['Leave', 'Doctor/Appointment', 'Holiday', 'Personal', 'Sick'];

const LeaveManager: React.FC<LeaveManagerProps> = ({ leaves, onAddLeave, onRemoveLeave }) => {
  const [staffName, setStaffName] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    if (!staffName || !date) return;
    onAddLeave({ staffName, date, reason });
    setDate('');
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:underline w-full"
      >
        <CalendarOff className="h-4 w-4" />
        {open ? 'Hide leave management' : 'Manage leave / unavailability'}
        {leaves.length > 0 && (
          <span className="ml-auto rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 font-semibold">
            {leaves.length}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Mark staff as unavailable for specific dates. The schedule generator will exclude them on those days.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={staffName}
              onChange={e => setStaffName(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select staff</option>
              {STAFF_MEMBERS.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <button
              onClick={handleAdd}
              disabled={!staffName || !date}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {leaves.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {leaves.map((leave, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2"
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STAFF_COLORS[leave.staffName] || '#888' }}
                  />
                  <span className="text-sm font-medium text-foreground" style={{ color: STAFF_COLORS[leave.staffName] }}>
                    {leave.staffName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(leave.date + 'T00:00:00'), 'EEE, MMM d')}
                  </span>
                  <span className="text-xs text-muted-foreground italic">{leave.reason}</span>
                  <button
                    onClick={() => onRemoveLeave(idx)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeaveManager;
