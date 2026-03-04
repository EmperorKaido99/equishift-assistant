import React, { useState } from 'react';
import { MonthSchedule, STAFF_COLORS, DaySchedule } from '@/types/schedule';
import { formatDayHeader, getRoleLabel } from '@/utils/scheduleGenerator';
import { isWeekend } from 'date-fns';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';

interface DraggableScheduleListProps {
  schedule: MonthSchedule;
  highlightDays: number[];
  onSwap: (dayIndex: number, nameA: string, shiftA: 'day' | 'night', nameB: string, shiftB: 'day' | 'night') => void;
}

interface DraggableStaffProps {
  name: string;
  dayIndex: number;
  shift: 'day' | 'night';
}

function DraggableStaff({ name, dayIndex, shift }: DraggableStaffProps) {
  const id = `${dayIndex}-${shift}-${name}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { name, dayIndex, shift } });

  return (
    <li
      ref={setNodeRef}
      className={`text-sm flex items-center gap-1 cursor-grab active:cursor-grabbing rounded px-1 py-0.5 transition-opacity ${isDragging ? 'opacity-30' : 'hover:bg-muted/50'}`}
      style={{ color: STAFF_COLORS[name] }}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <span className="font-medium">{name}</span>{' '}
      <span className="text-muted-foreground text-xs">{getRoleLabel(name)}</span>
    </li>
  );
}

function DroppableShift({ dayIndex, shift, children }: { dayIndex: number; shift: 'day' | 'night'; children: React.ReactNode }) {
  const id = `drop-${dayIndex}-${shift}`;
  const { setNodeRef, isOver } = useDroppable({ id, data: { dayIndex, shift } });

  return (
    <div ref={setNodeRef} className={`min-h-[40px] rounded-md transition-colors ${isOver ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}>
      {children}
    </div>
  );
}

const DraggableScheduleList: React.FC<DraggableScheduleListProps> = ({ schedule, highlightDays, onSwap }) => {
  const [activeStaff, setActiveStaff] = useState<{ name: string; dayIndex: number; shift: 'day' | 'night' } | null>(null);
  const allStaffNames = Object.keys(STAFF_COLORS);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as any;
    setActiveStaff({ name: data.name, dayIndex: data.dayIndex, shift: data.shift });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveStaff(null);
    const { active, over } = event;
    if (!over || !active.data.current) return;

    const from = active.data.current as any;

    // Dropped on a droppable shift zone
    if (over.data.current && 'dayIndex' in over.data.current) {
      const to = over.data.current as any;
      // Same day swaps only
      if (from.dayIndex !== to.dayIndex) return;
      // If dropped on the same shift, nothing to do unless it's on a person
      return;
    }

    // Dropped on another draggable staff member
    const toId = over.id as string;
    const parts = toId.split('-');
    if (parts.length < 3) return;
    const toDayIndex = parseInt(parts[0]);
    const toShift = parts[1] as 'day' | 'night';
    const toName = parts.slice(2).join('-');

    if (from.dayIndex !== toDayIndex) return;
    if (from.name === toName) return;

    onSwap(from.dayIndex, from.name, from.shift, toName, toShift);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                <DroppableShift dayIndex={idx} shift="day">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-base leading-none">🌞</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-day-shift mb-0.5">Day Shift</p>
                      {day.dayShift.length > 0 ? (
                        <ul className="space-y-0.5">
                          {day.dayShift.map(name => (
                            <DraggableStaff key={name} name={name} dayIndex={idx} shift="day" />
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No staff assigned</p>
                      )}
                    </div>
                  </div>
                </DroppableShift>

                {/* Night Shift */}
                <DroppableShift dayIndex={idx} shift="night">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-base leading-none">🌙</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-night-shift mb-0.5">Night Shift</p>
                      {day.nightShift.length > 0 ? (
                        <ul className="space-y-0.5">
                          {day.nightShift.map(name => (
                            <DraggableStaff key={name} name={name} dayIndex={idx} shift="night" />
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No staff assigned</p>
                      )}
                    </div>
                  </div>
                </DroppableShift>

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

      <DragOverlay>
        {activeStaff && (
          <div
            className="rounded-md bg-card border border-primary shadow-lg px-3 py-1.5 text-sm font-semibold"
            style={{ color: STAFF_COLORS[activeStaff.name] }}
          >
            {activeStaff.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default DraggableScheduleList;
