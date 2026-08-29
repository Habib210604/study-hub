'use client';
import { useState, useEffect } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { supabase } from '@/app/supabase';

export default function StreakTracker() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadStreak = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Server-side function computes and updates this user's own streak only
      const { data, error } = await supabase.rpc('update_daily_streak');

      if (!isMounted) return;
      if (!error && typeof data === 'number') {
        setStreak(data);
      }
    };

    loadStreak();

    return () => {
      isMounted = false;
    };
  }, []);

  if (streak === null) {
    return null; // avoid flashing a wrong number before the real streak loads
  }

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