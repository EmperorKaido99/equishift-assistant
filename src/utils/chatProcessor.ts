import { MonthSchedule, STAFF_MEMBERS, REGULAR_STAFF, ChatMessage } from '@/types/schedule';
import { getStaffStats, generateSchedule } from './scheduleGenerator';
import { format, getDay, isWeekend } from 'date-fns';

type ChatResult = {
  response: string;
  updatedSchedule?: MonthSchedule;
  highlightDays?: number[]; // day indices to highlight
};

function findStaffName(input: string): string | null {
  const lower = input.toLowerCase();
  const match = STAFF_MEMBERS.find(s => lower.includes(s.name.toLowerCase()));
  return match?.name ?? null;
}

function findAllStaffNames(input: string): string[] {
  const lower = input.toLowerCase();
  return STAFF_MEMBERS.filter(s => lower.includes(s.name.toLowerCase())).map(s => s.name);
}

function findDayIndex(input: string, schedule: MonthSchedule): number | null {
  const lower = input.toLowerCase();
  
  // Try "the 17th", "dec 16", etc.
  const numMatch = lower.match(/(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?/);
  if (numMatch) {
    const dayNum = parseInt(numMatch[1]);
    if (dayNum >= 1 && dayNum <= schedule.days.length) {
      return dayNum - 1;
    }
  }

  // Try day names
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < dayNames.length; i++) {
    if (lower.includes(dayNames[i])) {
      // Find next occurrence of this day
      const idx = schedule.days.findIndex(d => getDay(d.date) === i);
      if (idx !== -1) return idx;
    }
  }

  // Christmas
  if (lower.includes('christmas')) {
    const idx = schedule.days.findIndex(d => d.date.getDate() === 25 && d.date.getMonth() === 11);
    if (idx !== -1) return idx;
  }

  return null;
}

function findShiftType(input: string): 'day' | 'night' | null {
  const lower = input.toLowerCase();
  if (lower.includes('night')) return 'night';
  if (lower.includes('day')) return 'day';
  return null;
}

function cloneSchedule(schedule: MonthSchedule): MonthSchedule {
  return {
    ...schedule,
    days: schedule.days.map(d => ({
      ...d,
      dayShift: [...d.dayShift],
      nightShift: [...d.nightShift],
    })),
  };
}

export function processChat(
  input: string,
  schedule: MonthSchedule,
  history: MonthSchedule[]
): ChatResult {
  const lower = input.toLowerCase().trim();

  // Undo
  if (lower === 'undo' || lower === 'undo last change' || lower === 'go back') {
    if (history.length > 0) {
      return {
        response: '✅ Done! Reverted the last change.',
        updatedSchedule: history[history.length - 1],
      };
    }
    return { response: "⚠️ Nothing to undo — no changes have been made yet." };
  }

  // View/query commands
  if (lower.startsWith('who works') || lower.startsWith('show me') || lower.startsWith('what')) {
    return handleViewQuery(lower, schedule);
  }

  if (lower.startsWith('is ') && lower.includes('working')) {
    return handleAvailabilityQuery(lower, schedule);
  }

  if (lower.includes("show me all of") || lower.includes("'s shifts")) {
    return handleStaffShiftsQuery(lower, schedule);
  }

  if (lower.includes("who's off")) {
    return handleWhoIsOff(lower, schedule);
  }

  // Swap
  if (lower.includes('swap') || lower.includes('switch') || lower.includes('exchange')) {
    return handleSwap(lower, schedule);
  }

  // Move
  if (lower.includes('move') || lower.includes('change') || lower.includes('put')) {
    return handleMove(lower, schedule);
  }

  // Balance/fix
  if (lower.includes('balance') || lower.includes('fix') || lower.includes('rebalance')) {
    return handleRebalance(schedule);
  }

  // Stats
  if (lower.includes('stats') || lower.includes('statistics') || lower.includes('summary')) {
    return handleStats(schedule);
  }

  // Help
  if (lower.includes('help') || lower === '?') {
    return {
      response: `💡 **Here's what I can do:**\n\n` +
        `• **Swap shifts:** "swap Yvette and Sandra on Monday night"\n` +
        `• **Move staff:** "move Logan to day shift on Tuesday"\n` +
        `• **View schedule:** "who works Christmas Day?"\n` +
        `• **Check availability:** "is Tracey working next Friday?"\n` +
        `• **Show stats:** "show stats"\n` +
        `• **Balance shifts:** "rebalance day/night for everyone"\n` +
        `• **Undo:** "undo last change"\n`
    };
  }

  return {
    response: "🤔 I didn't understand that. Try commands like:\n• \"swap Yvette and Sandra on Monday night\"\n• \"move Logan to day shift on Tuesday\"\n• \"who works Monday?\"\n• Type **help** for all commands."
  };
}

function handleViewQuery(input: string, schedule: MonthSchedule): ChatResult {
  const dayIdx = findDayIndex(input, schedule);
  
  if (dayIdx !== null) {
    const day = schedule.days[dayIdx];
    const dateStr = format(day.date, 'EEEE, MMMM d');
    return {
      response: `📅 **${dateStr}**\n\n🌞 **Day shift:** ${day.dayShift.join(', ') || 'No one'}\n\n🌙 **Night shift:** ${day.nightShift.join(', ') || 'No one'}`,
      highlightDays: [dayIdx],
    };
  }

  // Weekend query
  if (input.includes('weekend')) {
    const weekendDays = schedule.days
      .map((d, i) => ({ ...d, idx: i }))
      .filter(d => isWeekend(d.date));
    
    if (weekendDays.length === 0) return { response: "No weekend days found in this month." };
    
    const shiftType = findShiftType(input);
    let result = '📅 **Weekend Schedule:**\n\n';
    weekendDays.slice(0, 4).forEach(d => {
      const dateStr = format(d.date, 'EEE, MMM d');
      if (!shiftType || shiftType === 'day') {
        result += `🌞 ${dateStr} Day: ${d.dayShift.join(', ')}\n`;
      }
      if (!shiftType || shiftType === 'night') {
        result += `🌙 ${dateStr} Night: ${d.nightShift.join(', ')}\n`;
      }
      result += '\n';
    });
    if (weekendDays.length > 4) result += `...and ${weekendDays.length - 4} more weekend days.`;
    
    return { response: result, highlightDays: weekendDays.map(d => d.idx) };
  }

  // Staff-specific query
  const staffName = findStaffName(input);
  if (staffName) {
    return handleStaffShiftsQuery(input, schedule);
  }

  return { response: "🤔 I couldn't find a specific day in your query. Try \"who works Monday?\" or \"show me the 15th\"." };
}

function handleStaffShiftsQuery(input: string, schedule: MonthSchedule): ChatResult {
  const name = findStaffName(input);
  if (!name) return { response: "⚠️ Couldn't find that staff member." };

  const shiftType = findShiftType(input);
  const indices: number[] = [];
  const shifts: string[] = [];

  schedule.days.forEach((day, idx) => {
    const onDay = day.dayShift.includes(name);
    const onNight = day.nightShift.includes(name);
    if (shiftType === 'night' && onNight) {
      indices.push(idx);
      shifts.push(`🌙 ${format(day.date, 'EEE, MMM d')} — Night`);
    } else if (shiftType === 'day' && onDay) {
      indices.push(idx);
      shifts.push(`🌞 ${format(day.date, 'EEE, MMM d')} — Day`);
    } else if (!shiftType && (onDay || onNight)) {
      indices.push(idx);
      if (onDay) shifts.push(`🌞 ${format(day.date, 'EEE, MMM d')} — Day`);
      if (onNight) shifts.push(`🌙 ${format(day.date, 'EEE, MMM d')} — Night`);
    }
  });

  const stats = getStaffStats(schedule).find(s => s.name === name);
  return {
    response: `📋 **${name}'s shifts** (${stats?.totalShifts ?? 0} total, ${stats?.dayShifts ?? 0} day / ${stats?.nightShifts ?? 0} night):\n\n${shifts.slice(0, 15).join('\n')}${shifts.length > 15 ? `\n...and ${shifts.length - 15} more` : ''}`,
    highlightDays: indices,
  };
}

function handleAvailabilityQuery(input: string, schedule: MonthSchedule): ChatResult {
  const name = findStaffName(input);
  const dayIdx = findDayIndex(input, schedule);
  
  if (!name) return { response: "⚠️ Couldn't find that staff member." };
  if (dayIdx === null) return { response: "⚠️ Couldn't determine which day you mean." };

  const day = schedule.days[dayIdx];
  const onDay = day.dayShift.includes(name);
  const onNight = day.nightShift.includes(name);
  const dateStr = format(day.date, 'EEEE, MMMM d');

  if (onDay) return { response: `✅ Yes, **${name}** is working 🌞 day shift on ${dateStr}.`, highlightDays: [dayIdx] };
  if (onNight) return { response: `✅ Yes, **${name}** is working 🌙 night shift on ${dateStr}.`, highlightDays: [dayIdx] };
  return { response: `❌ No, **${name}** is off on ${dateStr}.`, highlightDays: [dayIdx] };
}

function handleWhoIsOff(input: string, schedule: MonthSchedule): ChatResult {
  const dayIdx = findDayIndex(input, schedule);
  if (dayIdx === null) return { response: "⚠️ Couldn't determine which day you mean." };

  const day = schedule.days[dayIdx];
  const working = new Set([...day.dayShift, ...day.nightShift]);
  const off = STAFF_MEMBERS.filter(s => !working.has(s.name)).map(s => s.name);
  const dateStr = format(day.date, 'EEEE, MMMM d');

  return {
    response: `📅 **Off on ${dateStr}:** ${off.join(', ') || 'Everyone is working!'}`,
    highlightDays: [dayIdx],
  };
}

function handleSwap(input: string, schedule: MonthSchedule): ChatResult {
  const names = findAllStaffNames(input);
  if (names.length < 2) return { response: "⚠️ I need two staff names to swap. Try: \"swap Alex and Casey on Monday night\"" };

  const [nameA, nameB] = names;
  const dayIdx = findDayIndex(input, schedule);
  if (dayIdx === null) return { response: "⚠️ Couldn't determine which day. Try: \"swap Alex and Casey on Monday\"" };

  const shiftType = findShiftType(input);
  const day = schedule.days[dayIdx];
  const dateStr = format(day.date, 'EEEE, MMMM d');

  // Check special roles
  for (const name of [nameA, nameB]) {
    const member = STAFF_MEMBERS.find(s => s.name === name);
    if (member?.role === 'supervisor') return { response: `⚠️ ${name} is a Supervisor and can only work weekday day shifts. Cannot swap.` };
    if (member?.role === 'cleaner') return { response: `⚠️ ${name} is a Cleaner and can only work Mon/Wed/Fri day shifts. Cannot swap.` };
  }

  const newSchedule = cloneSchedule(schedule);
  const newDay = newSchedule.days[dayIdx];

  if (shiftType) {
    const shift = shiftType === 'day' ? newDay.dayShift : newDay.nightShift;
    const idxA = shift.indexOf(nameA);
    const idxB = shift.indexOf(nameB);
    
    if (idxA === -1 && idxB === -1) return { response: `⚠️ Neither ${nameA} nor ${nameB} is on ${shiftType} shift on ${dateStr}.` };
    if (idxA !== -1 && idxB !== -1) return { response: `👍 Both ${nameA} and ${nameB} are already on the same ${shiftType} shift on ${dateStr}. Swapping wouldn't change anything.` };
    
    if (idxA !== -1) shift[idxA] = nameB;
    if (idxB !== -1) shift[idxB] = nameA;
    
    // Handle the other shift too
    const otherShift = shiftType === 'day' ? newDay.nightShift : newDay.dayShift;
    const otherIdxA = otherShift.indexOf(nameA);
    const otherIdxB = otherShift.indexOf(nameB);
    if (otherIdxA !== -1) otherShift[otherIdxA] = nameB;
    if (otherIdxB !== -1) otherShift[otherIdxB] = nameA;
  } else {
    // Swap all occurrences on that day
    [newDay.dayShift, newDay.nightShift].forEach(shift => {
      const idxA = shift.indexOf(nameA);
      const idxB = shift.indexOf(nameB);
      if (idxA !== -1) shift[idxA] = nameB;
      if (idxB !== -1) shift[idxB] = nameA;
    });
  }

  const stats = getStaffStats(newSchedule);
  const sA = stats.find(s => s.name === nameA);
  const sB = stats.find(s => s.name === nameB);

  return {
    response: `✅ Done! I swapped **${nameA}** and **${nameB}** on ${dateStr}${shiftType ? ` (${shiftType} shift)` : ''}.\n\n${nameA}: ${sA?.totalShifts} shifts (${sA?.dayShifts} day / ${sA?.nightShifts} night)\n${nameB}: ${sB?.totalShifts} shifts (${sB?.dayShifts} day / ${sB?.nightShifts} night)`,
    updatedSchedule: newSchedule,
    highlightDays: [dayIdx],
  };
}

function handleMove(input: string, schedule: MonthSchedule): ChatResult {
  const name = findStaffName(input);
  if (!name) return { response: "⚠️ Couldn't find a staff member name." };

  const member = STAFF_MEMBERS.find(s => s.name === name)!;
  const dayIdx = findDayIndex(input, schedule);
  if (dayIdx === null) return { response: "⚠️ Couldn't determine which day." };

  const targetShift = findShiftType(input);
  if (!targetShift) return { response: "⚠️ Please specify day or night shift. E.g., \"move Alex to day shift on Tuesday\"" };

  const day = schedule.days[dayIdx];
  const dateStr = format(day.date, 'EEEE, MMMM d');
  const dow = getDay(day.date);

  // Rule checks
  if (member.role === 'supervisor') {
    if (targetShift === 'night') return { response: `⚠️ ${name} is a Supervisor and cannot work night shifts.` };
    if (isWeekend(day.date)) return { response: `⚠️ ${name} is a Supervisor and cannot work weekends.` };
  }
  if (member.role === 'cleaner') {
    if (targetShift === 'night') return { response: `⚠️ ${name} is a Cleaner and cannot work night shifts.` };
    if (!(dow === 1 || dow === 3 || dow === 5)) return { response: `⚠️ ${name} is a Cleaner and can only work Mon/Wed/Fri.` };
  }

  const newSchedule = cloneSchedule(schedule);
  const newDay = newSchedule.days[dayIdx];

  // Remove from both shifts first
  newDay.dayShift = newDay.dayShift.filter(n => n !== name);
  newDay.nightShift = newDay.nightShift.filter(n => n !== name);

  // Add to target
  if (targetShift === 'day') {
    newDay.dayShift.push(name);
  } else {
    newDay.nightShift.push(name);
  }

  // Check total shifts
  const stats = getStaffStats(newSchedule);
  const s = stats.find(st => st.name === name);
  // Check that move doesn't break shift size rules
  const newDow = getDay(newSchedule.days[dayIdx].date);
  const isWknd = isWeekend(newSchedule.days[dayIdx].date);
  const regularDay = newDay.dayShift.filter(n => n !== 'Tracey' && n !== 'Shariefa');
  const maxDay = isWknd ? 4 : 3;
  if (targetShift === 'day' && regularDay.length > maxDay) {
    return { response: `⚠️ Day shift already has ${maxDay} regular staff on ${dateStr}. Remove someone first.` };
  }
  if (targetShift === 'night' && newDay.nightShift.length > 3) {
    return { response: `⚠️ Night shift already has 3 staff on ${dateStr}. Remove someone first.` };
  }
  if (member.role === 'regular' && s && s.totalShifts > 22) {
    return { response: `⚠️ Can't move ${name} to ${targetShift} shift on ${dateStr} — that would give them ${s.totalShifts} shifts. Would you like me to suggest alternatives?` };
  }

  return {
    response: `✅ Done! Moved **${name}** to ${targetShift === 'day' ? '🌞 day' : '🌙 night'} shift on ${dateStr}.\n\n${name}: ${s?.totalShifts} shifts (${s?.dayShifts} day / ${s?.nightShifts} night)`,
    updatedSchedule: newSchedule,
    highlightDays: [dayIdx],
  };
}

function handleRebalance(schedule: MonthSchedule): ChatResult {
  const newSchedule = generateSchedule(schedule.year, schedule.month);
  const stats = getStaffStats(newSchedule);
  const regularStats = stats.filter(s => s.role === 'regular');
  const summary = regularStats.map(s => `• ${s.name}: ${s.totalShifts} shifts (${s.dayShifts}D/${s.nightShifts}N)`).join('\n');

  return {
    response: `✅ Schedule rebalanced! Here's the new distribution:\n\n${summary}`,
    updatedSchedule: newSchedule,
  };
}

function handleStats(schedule: MonthSchedule): ChatResult {
  const stats = getStaffStats(schedule);
  const lines = stats.map(s => {
    const role = s.role !== 'regular' ? ` (${s.role})` : '';
    return `• **${s.name}**${role}: ${s.totalShifts} total (${s.dayShifts}D/${s.nightShifts}N, ${s.weekendShifts} weekend)`;
  });

  return {
    response: `📊 **Schedule Statistics:**\n\n${lines.join('\n')}`,
  };
}
