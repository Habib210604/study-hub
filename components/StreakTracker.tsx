'use client';
import { useState, useEffect } from 'react';
import { Flame, Trophy } from 'lucide-react';

export default function StreakTracker() {
  const [streak, setStreak] = useState(1);

  useEffect(() => {
    // Check local storage for last login date and streak count
    const lastLogin = localStorage.getItem('study_hub_last_login');
    const currentStreak = parseInt(localStorage.getItem('study_hub_streak') || '1', 10);
    
    const today = new Date().toDateString();

    if (lastLogin !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastLogin === yesterday.toDateString()) {
        // Logged in consecutive day -> Increase streak!
        const newStreak = currentStreak + 1;
        setStreak(newStreak);
        localStorage.setItem('study_hub_streak', newStreak.toString());
      } else if (!lastLogin) {
        // First time ever
        setStreak(1);
        localStorage.setItem('study_hub_streak', '1');
      } else {
        // Streak broken, reset to 1
        setStreak(1);
        localStorage.setItem('study_hub_streak', '1');
      }
      localStorage.setItem('study_hub_last_login', today);
    } else {
      setStreak(currentStreak);
    }
  }, []);

  return (
    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl shadow-sm">
      <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
        <Flame size={18} className="animate-pulse text-orange-500" />
        <span>{streak} Day Streak</span>
      </div>
      <div className="hidden sm:flex items-center gap-1 text-slate-400 text-xs font-medium">
        <Trophy size={14} className="text-teal-400" />
        <span>Keep it burning!</span>
      </div>
    </div>
  );
}