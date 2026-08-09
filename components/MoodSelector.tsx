'use client';

import { X } from 'lucide-react';

export const MOODS = [
  { emoji: '⚡', label: 'High Energy', color: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
  { emoji: '🔥', label: 'Productive', color: 'bg-teal-500/20 border-teal-500/40 text-teal-300' },
  { emoji: '🌊', label: 'Calm', color: 'bg-blue-500/20 border-blue-500/40 text-blue-300' },
  { emoji: '☕', label: 'Tired', color: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
];

interface MoodSelectorProps {
  dateStr: string;
  onClose: () => void;
  onSelectMood: (emoji: string) => void;
}

export function MoodSelector({ dateStr, onClose, onSelectMood }: MoodSelectorProps) {
  return (
    <div className="absolute z-50 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl w-48 text-xs">
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
        <span className="font-semibold text-slate-200">Mood: {dateStr}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1.5">
        {MOODS.map((m) => (
          <button
            key={m.label}
            onClick={() => onSelectMood(m.emoji)}
            className={`w-full flex items-center gap-2 p-1.5 rounded-lg border transition hover:opacity-80 cursor-pointer ${m.color}`}
          >
            <span className="text-sm">{m.emoji}</span>
            <span className="font-medium">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}