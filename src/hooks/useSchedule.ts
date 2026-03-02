import { useState, useCallback, useRef, useEffect } from 'react';
import { MonthSchedule, ChatMessage, ScheduleOptions } from '@/types/schedule';
import { generateSchedule, getStaffStats } from '@/utils/scheduleGenerator';
import { processChat } from '@/utils/chatProcessor';
import { streamChat, parseAction, stripAction } from '@/utils/aiChat';

const STORAGE_KEY = 'equishift-schedule';
const CHAT_STORAGE_KEY = 'equishift-chat';

function loadSchedule(): MonthSchedule | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    parsed.days = parsed.days.map((d: any) => ({ ...d, date: new Date(d.date) }));
    return parsed;
  } catch {
    return null;
  }
}

function saveSchedule(schedule: MonthSchedule) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

function loadChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveChat(messages: ChatMessage[]) {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
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

function applyAction(action: any, schedule: MonthSchedule, history: MonthSchedule[]): { updatedSchedule?: MonthSchedule; highlightDays?: number[] } {
  if (!action) return {};

  if (action.type === 'undo') {
    if (history.length > 0) {
      return { updatedSchedule: history[history.length - 1] };
    }
    return {};
  }

  if (action.type === 'rebalance') {
    const newSchedule = generateSchedule(schedule.year, schedule.month);
    return { updatedSchedule: newSchedule };
  }

  if (action.type === 'swap' && action.dayIndex != null) {
    const newSchedule = cloneSchedule(schedule);
    const day = newSchedule.days[action.dayIndex];
    if (!day) return {};
    
    const { nameA, nameB, shift } = action;
    const shifts = shift === 'day' ? [day.dayShift] : shift === 'night' ? [day.nightShift] : [day.dayShift, day.nightShift];
    
    shifts.forEach(s => {
      const idxA = s.indexOf(nameA);
      const idxB = s.indexOf(nameB);
      if (idxA !== -1) s[idxA] = nameB;
      if (idxB !== -1) s[idxB] = nameA;
    });

    return { updatedSchedule: newSchedule, highlightDays: [action.dayIndex] };
  }

  if (action.type === 'move' && action.dayIndex != null) {
    const newSchedule = cloneSchedule(schedule);
    const day = newSchedule.days[action.dayIndex];
    if (!day) return {};

    const { name, toShift } = action;
    day.dayShift = day.dayShift.filter((n: string) => n !== name);
    day.nightShift = day.nightShift.filter((n: string) => n !== name);
    if (toShift === 'day') day.dayShift.push(name);
    else day.nightShift.push(name);

    return { updatedSchedule: newSchedule, highlightDays: [action.dayIndex] };
  }

  return {};
}

export function useSchedule() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [schedule, setSchedule] = useState<MonthSchedule | null>(loadSchedule);
  const [messages, setMessages] = useState<ChatMessage[]>(loadChat);
  const [highlightDays, setHighlightDays] = useState<number[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const historyRef = useRef<MonthSchedule[]>([]);

  useEffect(() => {
    if (schedule) saveSchedule(schedule);
  }, [schedule]);

  useEffect(() => {
    saveChat(messages);
  }, [messages]);

  const generate = useCallback((options?: ScheduleOptions) => {
    const newSchedule = generateSchedule(year, month, options);
    setSchedule(newSchedule);
    historyRef.current = [];
    setHighlightDays([]);
    
    const patternLabel = options?.pattern === '2week' ? '2-week rotation' : options?.pattern === '1week' ? '1-week rotation' : 'mixed shifts';
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `✅ Schedule generated for **${new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}** with **${patternLabel}**! ${newSchedule.days.length} days created.\n\nI'm your AI-powered shift assistant. Ask me anything about the schedule or tell me to make changes!`,
      timestamp: new Date(),
    };
    setMessages([msg]);
  }, [year, month]);

  const resetSchedule = useCallback(() => {
    setSchedule(null);
    setMessages([]);
    setHighlightDays([]);
    historyRef.current = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  }, []);

  const sendMessage = useCallback(async (input: string) => {
    if (!schedule || !input.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsAiLoading(true);

    let assistantContent = '';
    const assistantId = crypto.randomUUID();

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id === assistantId) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
        }
        return [...prev, { id: assistantId, role: 'assistant' as const, content: assistantContent, timestamp: new Date() }];
      });
    };

    try {
      // Build chat history for AI (last 10 messages for context)
      const recentMessages = [...messages, userMsg].slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      await streamChat({
        messages: recentMessages,
        schedule,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => {
          setIsAiLoading(false);
          
          // Check for action blocks in the final response
          const action = parseAction(assistantContent);
          if (action && schedule) {
            const result = applyAction(action, schedule, historyRef.current);
            if (result.updatedSchedule) {
              historyRef.current.push(schedule);
              setSchedule(result.updatedSchedule);
            }
            if (result.highlightDays) {
              setHighlightDays(result.highlightDays);
              setTimeout(() => setHighlightDays([]), 2000);
            }
            // Strip action block from display
            const cleanContent = stripAction(assistantContent);
            if (cleanContent !== assistantContent) {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: cleanContent } : m));
            }
          }
        },
      });
    } catch (e) {
      console.error('AI chat failed, falling back to local:', e);
      // Fallback to local processing
      const result = processChat(input, schedule, historyRef.current);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== assistantId);
        return [...filtered, {
          id: assistantId,
          role: 'assistant' as const,
          content: result.response,
          timestamp: new Date(),
        }];
      });

      if (result.updatedSchedule) {
        historyRef.current.push(schedule);
        setSchedule(result.updatedSchedule);
      }
      if (result.highlightDays) {
        setHighlightDays(result.highlightDays);
        setTimeout(() => setHighlightDays([]), 2000);
      }
      setIsAiLoading(false);
    }
  }, [schedule, messages]);

  const stats = schedule ? getStaffStats(schedule) : [];

  return {
    year, setYear,
    month, setMonth,
    schedule,
    messages,
    highlightDays,
    stats,
    isAiLoading,
    generate,
    sendMessage,
    resetSchedule,
  };
}
