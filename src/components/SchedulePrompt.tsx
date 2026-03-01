import React, { useState } from 'react';
import { ScheduleOptions, SchedulePattern, REGULAR_STAFF } from '@/types/schedule';
import { Shuffle, ArrowRightLeft, Users, Zap } from 'lucide-react';

interface SchedulePromptProps {
  onGenerate: (options: ScheduleOptions) => void;
}

const PATTERNS: { value: SchedulePattern; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'mixed', label: 'Mixed Shifts', desc: 'Balanced mix of day and night shifts throughout the month', icon: <Shuffle className="h-5 w-5" /> },
  { value: '2week', label: '2 Weeks Day / 2 Weeks Night', desc: 'First half of month on one shift, second half on the other', icon: <ArrowRightLeft className="h-5 w-5" /> },
  { value: '1week', label: '1 Week Day / 1 Week Night', desc: 'Alternate between day and night shifts every week', icon: <Zap className="h-5 w-5" /> },
];

const SchedulePrompt: React.FC<SchedulePromptProps> = ({ onGenerate }) => {
  const [pattern, setPattern] = useState<SchedulePattern>('mixed');
  const [showGrouping, setShowGrouping] = useState(false);
  const [groupInput, setGroupInput] = useState('');
  const [groups, setGroups] = useState<string[][]>([]);

  const regularNames = REGULAR_STAFF.map(s => s.name);

  const addGroup = () => {
    const names = groupInput
      .split(',')
      .map(n => n.trim())
      .filter(n => regularNames.some(rn => rn.toLowerCase() === n.toLowerCase()))
      .map(n => regularNames.find(rn => rn.toLowerCase() === n.toLowerCase())!);

    if (names.length >= 2) {
      setGroups(prev => [...prev, names]);
      setGroupInput('');
    }
  };

  const removeGroup = (idx: number) => {
    setGroups(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = () => {
    onGenerate({
      pattern,
      groupTogether: groups.length > 0 ? groups : undefined,
    });
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-1">Schedule Settings</h2>
        <p className="text-sm text-muted-foreground mb-5">Choose a shift pattern before generating</p>

        {/* Pattern Selection */}
        <div className="space-y-2 mb-6">
          {PATTERNS.map(p => (
            <button
              key={p.value}
              onClick={() => setPattern(p.value)}
              className={`w-full flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                pattern === p.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className={`mt-0.5 ${pattern === p.value ? 'text-primary' : 'text-muted-foreground'}`}>
                {p.icon}
              </div>
              <div>
                <div className={`text-sm font-semibold ${pattern === p.value ? 'text-foreground' : 'text-foreground/80'}`}>
                  {p.label}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Grouping */}
        <div className="mb-6">
          <button
            onClick={() => setShowGrouping(!showGrouping)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Users className="h-4 w-4" />
            {showGrouping ? 'Hide grouping options' : 'Group people on same shift'}
          </button>

          {showGrouping && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Enter names separated by commas to keep them on the same shift. Available: {regularNames.join(', ')}
              </p>
              <div className="flex gap-2">
                <input
                  value={groupInput}
                  onChange={e => setGroupInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGroup()}
                  placeholder="e.g. Yvette, Sandra, Logan"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={addGroup}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Add
                </button>
              </div>

              {groups.map((group, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 text-sm text-foreground">{group.join(', ')}</span>
                  <button
                    onClick={() => removeGroup(idx)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Generate Schedule
        </button>
      </div>
    </div>
  );
};

export default SchedulePrompt;
