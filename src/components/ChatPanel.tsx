import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types/schedule';
import { Send } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  'show stats',
  'who works Monday?',
  'swap Yvette and Sandra on Monday night',
  'help',
];

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSend, disabled }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-chat-bg rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <h2 className="text-sm font-semibold text-foreground">💬 Shift Assistant</h2>
        <p className="text-xs text-muted-foreground">Ask me to view, swap, or move shifts</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Generate a schedule to start chatting!</p>
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`animate-fade-in flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-chat-user text-chat-user-foreground rounded-br-sm'
                  : 'bg-chat-assistant text-chat-assistant-foreground border border-border rounded-bl-sm'
              }`}
            >
              {renderMarkdown(msg.content)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {!disabled && messages.length > 0 && (
        <div className="px-4 py-2 border-t border-border/50 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => onSend(s)}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-border bg-card">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={disabled ? 'Generate a schedule first...' : 'Type a command...'}
            disabled={disabled}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="rounded-lg bg-primary p-2 text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

function renderMarkdown(text: string): React.ReactNode {
  // Simple markdown: **bold**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default ChatPanel;
