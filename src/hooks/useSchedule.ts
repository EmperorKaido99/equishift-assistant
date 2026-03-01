import { useState, useCallback, useRef, useEffect } from 'react';
import { MonthSchedule, ChatMessage } from '@/types/schedule';
import { generateSchedule, getStaffStats } from '@/utils/scheduleGenerator';
import { processChat } from '@/utils/chatProcessor';

const STORAGE_KEY = 'equishift-schedule';
const CHAT_STORAGE_KEY = 'equishift-chat';

function loadSchedule(): MonthSchedule | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Revive dates
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

export function useSchedule() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [schedule, setSchedule] = useState<MonthSchedule | null>(loadSchedule);
  const [messages, setMessages] = useState<ChatMessage[]>(loadChat);
  const [highlightDays, setHighlightDays] = useState<number[]>([]);
  const historyRef = useRef<MonthSchedule[]>([]);

  useEffect(() => {
    if (schedule) saveSchedule(schedule);
  }, [schedule]);

  useEffect(() => {
    saveChat(messages);
  }, [messages]);

  const generate = useCallback(() => {
    const newSchedule = generateSchedule(year, month);
    setSchedule(newSchedule);
    historyRef.current = [];
    setHighlightDays([]);
    
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `✅ Schedule generated for **${new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}**! ${newSchedule.days.length} days created with fair shift distribution.\n\nType **help** to see what I can do, or ask me anything about the schedule.`,
      timestamp: new Date(),
    };
    setMessages([msg]);
  }, [year, month]);

  const sendMessage = useCallback((input: string) => {
    if (!schedule || !input.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const result = processChat(input, schedule, historyRef.current);

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: result.response,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    if (result.updatedSchedule) {
      historyRef.current.push(schedule);
      setSchedule(result.updatedSchedule);
    }

    if (result.highlightDays) {
      setHighlightDays(result.highlightDays);
      setTimeout(() => setHighlightDays([]), 2000);
    }
  }, [schedule]);

  const stats = schedule ? getStaffStats(schedule) : [];

  return {
    year, setYear,
    month, setMonth,
    schedule,
    messages,
    highlightDays,
    stats,
    generate,
    sendMessage,
  };
}
