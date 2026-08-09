'use client';
import FlashcardGenerator from '@/components/FlashcardGenerator';
import StreakTracker from '@/components/StreakTracker';
import AmbientPlayer from '@/components/AmbientPlayer';
import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, CheckCircle2, Clock, BookOpen,
  Sparkles, Plus, Trash2, LogOut, Calendar as CalendarIcon, Megaphone, Sun, Moon, ChevronLeft, ChevronRight,
  Timer, Target, CalendarDays, Layers, BrainCircuit, Folder, FileText, Upload, Download, X,
  StickyNote, Quote as QuoteIcon, Hourglass, Bot, Search, LayoutGrid, Command, ArrowRight, Circle
} from 'lucide-react';
import { supabase } from './supabase';
import Auth from './auth';
import { useLanguage } from '@/context/LanguageContext';
import StudyAiWidget from '@/components/StudyAiWidget';

const TUNISIAN_HOLIDAYS: Record<string, string> = {
  '01-01': 'New Year\'s Day',
  '01-14': 'Revolution & Youth Day',
  '03-20': 'Independence Day',
  '04-09': 'Martyrs\' Day',
  '05-01': 'Labor Day',
  '07-25': 'Republic Day',
  '08-13': 'Women\'s Day',
  '10-15': 'Evacuation Day',
};

const MOOD_OPTIONS = [
  { emoji: '⚡', label: 'High Energy' },
  { emoji: '☕', label: 'Tired' },
  { emoji: '🔥', label: 'Productive' },
  { emoji: '🌊', label: 'Calm' },
  { emoji: '😩', label: 'Stressed' },
];

const STUDY_QUOTES = [
  "The expert in anything was once a beginner.",
  "Small steps every day lead to big results.",
  "Discipline beats motivation when motivation runs out.",
  "Focus on progress, not perfection.",
  "Your future self is watching you right now.",
  "Consistency compounds — keep showing up.",
  "Hard work quietly beats talent that doesn't work hard.",
];

type TabKey = 'overview' | 'focus' | 'goals' | 'calendar' | 'notes' | 'folders' | 'flashcards' | 'assistant';

export default function StudyDashboard() {
  const { t, language, setLanguage } = useLanguage();

  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const [announcement, setAnnouncement] = useState<{ id: number; title: string; message: string } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<{ id: number; title: string; event_date: string; type: string }[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('work');
  const [focusSecondsToday, setFocusSecondsToday] = useState(0);

  // --- Customizable Pomodoro durations (in minutes) ---
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);

  const [tasks, setTasks] = useState<{ id: string | number; title: string; is_completed: boolean }[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [modules, setModules] = useState<{ id: string | number; title: string; status: string }[]>([]);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [loadingModules, setLoadingModules] = useState(true);
  const [folderSearch, setFolderSearch] = useState('');

  const [activeFolder, setActiveFolder] = useState<{ id: string | number; title: string } | null>(null);
  const [folderFiles, setFolderFiles] = useState<{ id: number; file_name: string; file_url: string; file_size: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [recentFiles, setRecentFiles] = useState<{ id: number; file_name: string; file_url: string; module_id: string | number }[]>([]);

  const [scratchpadContent, setScratchpadContent] = useState('');
  const [scratchpadStatus, setScratchpadStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const scratchpadTimeout = useRef<NodeJS.Timeout | null>(null);

  const [moods, setMoods] = useState<Record<string, string>>({});
  const [moodPickerDate, setMoodPickerDate] = useState<string | null>(null);

  const [quoteIndex, setQuoteIndex] = useState(0);

  // --- Command menu (Cmd/Ctrl+K) ---
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const savedFocusData = localStorage.getItem(`focus_time_${todayStr}`);
    if (savedFocusData) {
      setFocusSecondsToday(Number(savedFocusData));
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % STUDY_QUOTES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // --- Cmd/Ctrl+K listener ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (commandOpen) {
      setTimeout(() => commandInputRef.current?.focus(), 50);
    } else {
      setCommandQuery('');
    }
  }, [commandOpen]);

  const toggleTheme = (selectedTheme: string) => {
    setTheme(selectedTheme);
    localStorage.setItem('theme', selectedTheme);
    if (selectedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  useEffect(() => {
    if (session) {
      fetchGoals();
      fetchModules();
      fetchAnnouncement();
      fetchEvents();
      fetchScratchpad();
      fetchMoods();
      fetchRecentFiles();
    }
  }, [session]);

  const fetchAnnouncement = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (!error && data && data.length > 0) setAnnouncement(data[0]);
  };

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select('*');
    if (!error && data) setEvents(data);
  };

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate || !session?.user) return;

    const { data, error } = await supabase
      .from('events')
      .insert([{ title: newEventTitle, event_date: newEventDate, type: 'exam', user_id: session.user.id }])
      .select();

    if (!error && data) {
      setEvents((prev) => [...prev, data[0]]);
      setNewEventTitle('');
      setNewEventDate('');
    }
  };

  const deleteEvent = async (id: number) => {
    setEvents(events.filter(e => e.id !== id));
    await supabase.from('events').delete().eq('id', id);
  };

  const fetchGoals = async () => {
    if (!session?.user) return;
    setLoadingTasks(true);
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', session.user.id);
    if (!error && data) {
      setTasks(data.map((item: any) => ({
        id: item.id || item.ID || item.goal_id,
        title: item.title,
        is_completed: item.is_completed ?? false,
      })));
    }
    setLoadingTasks(false);
  };

  const fetchModules = async () => {
    if (!session?.user) return;
    setLoadingModules(true);
    const { data, error } = await supabase.from('modules').select('*').eq('user_id', session.user.id);
    if (!error && data) {
      setModules(data.map((item: any) => ({
        id: item.id || item.ID,
        title: item.title,
        status: item.status || 'In Progress',
      })));
    }
    setLoadingModules(false);
  };

  const fetchRecentFiles = async () => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('module_files')
      .select('id, file_name, file_url, module_id')
      .eq('user_id', session.user.id)
      .order('id', { ascending: false })
      .limit(5);
    if (!error && data) setRecentFiles(data);
  };

  const addGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !session?.user) return;

    const { data, error } = await supabase
      .from('goals')
      .insert([{ title: newTaskTitle.trim(), is_completed: false, user_id: session.user.id }])
      .select();

    if (!error && data && data.length > 0) {
      setTasks([{ id: data[0].id || data[0].ID, title: data[0].title, is_completed: data[0].is_completed ?? false }, ...tasks]);
      setNewTaskTitle('');
    } else if (error) {
      alert('Error adding goal: ' + error.message);
    }
  };

  const toggleTask = async (id: string | number, currentStatus: boolean) => {
    if (id === undefined || id === null) return;
    setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !currentStatus } : t));
    await supabase.from('goals').update({ is_completed: !currentStatus }).eq('id', id);
  };

  const deleteTask = async (id: string | number) => {
    if (id === undefined || id === null) return;
    setTasks(tasks.filter(t => t.id !== id));
    await supabase.from('goals').delete().eq('id', id);
  };

  const addModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim() || !session?.user) return;

    const { data, error } = await supabase
      .from('modules')
      .insert([{ title: newModuleTitle.trim(), status: 'In Progress', user_id: session.user.id }])
      .select();

    if (!error && data && data.length > 0) {
      setModules([{ id: data[0].id || data[0].ID, title: data[0].title, status: data[0].status }, ...modules]);
      setNewModuleTitle('');
    } else if (error) {
      alert('Error adding folder: ' + error.message);
    }
  };

  const toggleModuleStatus = async (id: string | number, currentStatus: string) => {
    if (id === undefined || id === null) return;
    const nextStatus = currentStatus === 'In Progress' ? 'Mastered' : 'In Progress';
    setModules(modules.map(m => m.id === id ? { ...m, status: nextStatus } : m));
    await supabase.from('modules').update({ status: nextStatus }).eq('id', id);
  };

  const deleteModule = async (id: string | number) => {
    if (id === undefined || id === null) return;
    setModules(modules.filter(m => m.id !== id));
    await supabase.from('modules').delete().eq('id', id);
  };

  const openFolder = async (mod: { id: string | number; title: string }) => {
    setActiveFolder(mod);
    setActiveTab('folders');
    const { data, error } = await supabase
      .from('module_files')
      .select('*')
      .eq('module_id', mod.id);
    
    if (!error && data) {
      setFolderFiles(data);
    } else {
      setFolderFiles([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeFolder || !session?.user) return;

    setUploadingFile(true);
    
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${session.user.id}/${activeFolder.id}/${Date.now()}_${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('subject-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploadingFile(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('subject-files')
      .getPublicUrl(filePath);

    const fileUrl = publicUrlData.publicUrl;
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

    const { data: dbData, error: dbError } = await supabase
      .from('module_files')
      .insert([
        {
          module_id: activeFolder.id,
          user_id: session.user.id,
          file_name: file.name,
          file_url: fileUrl,
          file_size: fileSizeMB,
        }
      ])
      .select();

    if (dbError) {
      alert('Error saving file record to database: ' + dbError.message);
    } else if (dbData) {
      setFolderFiles([...folderFiles, dbData[0]]);
      fetchRecentFiles();
    }
    setUploadingFile(false);
    e.target.value = '';
  };

  const deleteFile = async (fileId: number, fileUrl: string) => {
    setFolderFiles(folderFiles.filter(f => f.id !== fileId));
    await supabase.from('module_files').delete().eq('id', fileId);
    fetchRecentFiles();
  };

  const fetchScratchpad = async () => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('scratchpad')
      .select('content')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!error && data) setScratchpadContent(data.content || '');
  };

  const handleScratchpadChange = (value: string) => {
    setScratchpadContent(value);
    setScratchpadStatus('saving');
    if (scratchpadTimeout.current) clearTimeout(scratchpadTimeout.current);
    scratchpadTimeout.current = setTimeout(async () => {
      if (!session?.user) return;
      await supabase.from('scratchpad').upsert({
        user_id: session.user.id,
        content: value,
        updated_at: new Date().toISOString(),
      });
      setScratchpadStatus('saved');
    }, 800);
  };

  const fetchMoods = async () => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('daily_moods')
      .select('mood_date, mood')
      .eq('user_id', session.user.id);
    if (!error && data) {
      const map: Record<string, string> = {};
      data.forEach((row: any) => { map[row.mood_date] = row.mood; });
      setMoods(map);
    }
  };

  const setMoodForDate = async (dateStr: string, moodEmoji: string) => {
    if (!session?.user) return;
    setMoods((prev) => ({ ...prev, [dateStr]: moodEmoji }));
    setMoodPickerDate(null);
    await supabase.from('daily_moods').upsert({
      user_id: session.user.id,
      mood_date: dateStr,
      mood: moodEmoji,
    }, { onConflict: 'user_id,mood_date' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        if (mode === 'work') {
          setFocusSecondsToday((prevSecs) => {
            const updatedSecs = prevSecs + 1;
            const todayStr = new Date().toISOString().slice(0, 10);
            localStorage.setItem(`focus_time_${todayStr}`, updatedSecs.toString());
            return updatedSecs;
          });
        }
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode]);

  const toggleTimer = () => setIsRunning(!isRunning);

  const resetTimer = (newMode = mode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(newMode === 'work' ? focusMinutes * 60 : breakMinutes * 60);
  };

  // Let the user type a custom duration; clamps to 1-180 minutes.
  const handleDurationChange = (kind: 'work' | 'break', value: string) => {
    const parsed = Math.max(1, Math.min(180, Number(value) || 1));
    if (kind === 'work') {
      setFocusMinutes(parsed);
      if (!isRunning && mode === 'work') setTimeLeft(parsed * 60);
    } else {
      setBreakMinutes(parsed);
      if (!isRunning && mode === 'break') setTimeLeft(parsed * 60);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFocusDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0 && minutes === 0) return '0m';
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const todayISO = new Date().toISOString().slice(0, 10);
  const upcomingExams = events
    .filter((e) => e.type === 'exam' && e.event_date >= todayISO)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const nextExam = upcomingExams[0];
  const daysUntilExam = nextExam
    ? Math.ceil((new Date(nextExam.event_date).getTime() - new Date(todayISO).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const todaysEvents = events.filter((e) => e.event_date === todayISO);
  const openGoals = tasks.filter((t) => !t.is_completed);
  const activeModule = modules.find((m) => m.status === 'In Progress');

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? (t('goodMorning') || 'Good morning') : greetingHour < 18 ? (t('goodAfternoon') || 'Good afternoon') : (t('goodEvening') || 'Good evening');
  const firstName = session?.user?.email?.split('@')[0] || '';

  const filteredModules = modules.filter((m) => m.title.toLowerCase().includes(folderSearch.toLowerCase()));

  const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: t('overview') || 'Overview', icon: LayoutGrid },
    { key: 'focus', label: t('pomodoroTimer') || 'Focus Timer', icon: Timer },
    { key: 'goals', label: t('dailyGoals') || 'Goals', icon: Target },
    { key: 'calendar', label: t('calendarEvents') || 'Calendar', icon: CalendarDays },
    { key: 'notes', label: t('quickNotes') || 'Notes', icon: StickyNote },
    { key: 'folders', label: t('subjectFolders') || 'Subjects', icon: Folder },
    { key: 'flashcards', label: t('aiFlashcards') || 'Flashcards', icon: BrainCircuit },
    { key: 'assistant', label: 'Assistant', icon: Bot },
  ];

  const commandResults = TABS.filter((tabItem) =>
    tabItem.label.toLowerCase().includes(commandQuery.toLowerCase())
  );

  if (checkingAuth) {
    return <div className="min-h-screen bg-[#09090B] text-[#71717A] flex items-center justify-center text-sm font-['Inter']">{t('checkingSession') || 'Checking session...'}</div>;
  }

  if (!session) {
    return <Auth onLogin={fetchGoals} />;
  }

  return (
    <div className={`min-h-screen font-['Inter'] transition-colors duration-300 relative flex ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#09090B] text-[#F2F2F5]'}`}>

      <style jsx global>{`
        .panel {
          background: #111113;
          border: 1px solid rgba(255,255,255,0.07);
        }
        .panel-hover {
          transition: border-color 220ms ease, background-color 220ms ease;
        }
        .panel-hover:hover {
          border-color: rgba(255,255,255,0.16);
          background: #141416;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 320ms cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .pulse-dot { animation: pulseDot 2s ease-in-out infinite; }
        @keyframes shiftGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .quote-gradient {
          background: linear-gradient(120deg, rgba(242,169,59,0.10), rgba(99,102,241,0.10), rgba(45,212,191,0.10));
          background-size: 200% 200%;
          animation: shiftGradient 12s ease infinite;
        }
      `}</style>

      {/* --- Sidebar --- */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col justify-between border-r border-white/[0.07] px-4 py-6 h-screen sticky top-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-lg bg-[#F2A93B] flex items-center justify-center text-black font-bold text-sm font-['Manrope']">S</div>
            <span className="font-['Manrope'] font-bold text-[15px] tracking-tight">StudySpace</span>
          </div>

          <nav className="space-y-0.5">
            {TABS.map((tabItem) => {
              const Icon = tabItem.icon;
              const isActive = activeTab === tabItem.key;
              return (
                <button
                  key={tabItem.key}
                  onClick={() => setActiveTab(tabItem.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                    isActive ? 'bg-white/[0.06] text-[#F2F2F5]' : 'text-[#71717A] hover:text-[#D4D4D8] hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                  {tabItem.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setCommandOpen(true)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12px] text-[#71717A] border border-white/[0.07] hover:border-white/[0.14] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2"><Search size={13} /> {t('quickSearch') || 'Quick search'}</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] font-['JetBrains_Mono']">⌘K</kbd>
          </button>
          <div className="px-2 text-[11px] text-[#52525B] truncate">{session.user.email}</div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#71717A] hover:text-red-400 hover:bg-red-500/[0.06] transition-colors cursor-pointer">
            <LogOut size={16} /> {t('logout') || 'Logout'}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">

        {/* --- Ultra-thin top bar --- */}
        <div className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#09090B]/90 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] text-[#A1A1AA]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              </span>
              {t('active') || 'Active'} · {currentDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <StreakTracker />
              <button
                onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
                className="px-2.5 py-1 text-[12px] font-medium text-[#A1A1AA] hover:text-[#F2F2F5] hover:bg-white/[0.05] rounded-md transition cursor-pointer"
              >
                {language?.toUpperCase() || 'LANG'}
              </button>
              <div className="flex items-center border border-white/[0.07] rounded-md p-0.5">
                <button onClick={() => toggleTheme('light')} className={`p-1 rounded text-[11px] transition cursor-pointer ${theme === 'light' ? 'bg-white/10 text-[#F2F2F5]' : 'text-[#71717A]'}`}><Sun size={13} /></button>
                <button onClick={() => toggleTheme('dark')} className={`p-1 rounded text-[11px] transition cursor-pointer ${theme === 'dark' ? 'bg-white/10 text-[#F2F2F5]' : 'text-[#71717A]'}`}><Moon size={13} /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 space-y-8">

          {/* --- Dynamic greeting header --- */}
          <div className="fade-in">
            <h1 className="font-['Manrope'] text-3xl font-extrabold tracking-tight text-[#F2F2F5]">{greeting}{firstName ? `, ${firstName}` : ''}.</h1>
            <p className="text-[#71717A] text-sm mt-1">{t('readyToFocus') || "Let's make today count."}</p>
          </div>

          {announcement && (
            <div className="panel rounded-xl p-4 flex items-center gap-3 fade-in border-l-2 !border-l-[#F2A93B]">
              <Megaphone size={16} className="text-[#F2A93B] shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] uppercase font-bold tracking-wider text-[#F2A93B] mr-2">{t('announcement') || 'Announcement'}</span>
                <span className="text-sm text-[#F2F2F5] font-medium">{announcement.title}</span>
                <p className="text-[#71717A] text-xs mt-0.5">{announcement.message}</p>
              </div>
            </div>
          )}

          {/* --- Daily Inspiration / Countdown ticker: persistent, always visible under the announcement --- */}
          <div className="quote-gradient rounded-2xl p-4 border border-white/[0.07] flex items-center gap-3 fade-in">
            <QuoteIcon size={15} className="text-[#F2A93B] shrink-0" />
            <p key={quoteIndex} className="font-['Manrope'] text-sm text-[#F2F2F5] italic truncate">"{STUDY_QUOTES[quoteIndex]}"</p>
            {nextExam && daysUntilExam !== null && (
              <span className="ml-auto shrink-0 flex items-center gap-1.5 text-xs font-['JetBrains_Mono'] text-[#A1A1AA]">
                <Hourglass size={12} /> {daysUntilExam === 0 ? (t('examToday') || 'Exam today!') : `${daysUntilExam}d → ${nextExam.title}`}
              </span>
            )}
          </div>

          {/* --- Mobile tab bar --- */}
          <div className="md:hidden flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map((tabItem) => {
              const Icon = tabItem.icon;
              const isActive = activeTab === tabItem.key;
              return (
                <button
                  key={tabItem.key}
                  onClick={() => setActiveTab(tabItem.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition cursor-pointer ${
                    isActive ? 'bg-white/[0.06] border-white/[0.14] text-[#F2F2F5]' : 'border-white/[0.07] text-[#71717A]'
                  }`}
                >
                  <Icon size={14} /> {tabItem.label}
                </button>
              );
            })}
          </div>

          {/* ============ OVERVIEW: BENTO GRID ============ */}
          {activeTab === 'overview' && (
            <div key="overview" className="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">

              {/* Focus & Flow — spans 2 cols */}
              <div className="panel panel-hover rounded-2xl p-6 md:col-span-2 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-['Manrope'] font-bold text-sm text-[#F2F2F5] flex items-center gap-2">
                    <Timer size={15} className="text-[#F2A93B]" /> {t('focusFlow') || 'Focus & Flow'}
                  </h3>
                  <span className="text-[11px] text-[#52525B] font-['JetBrains_Mono']">{mode === 'work' ? 'FOCUS' : 'BREAK'}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg className="w-24 h-24 -rotate-90">
                      <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
                      <circle
                        cx="48" cy="48" r="42" fill="none"
                        stroke={mode === 'work' ? '#F2A93B' : '#2DD4BF'}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 42}
                        strokeDashoffset={2 * Math.PI * 42 * (1 - timeLeft / (mode === 'work' ? focusMinutes * 60 : breakMinutes * 60))}
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-['JetBrains_Mono'] text-sm font-bold text-[#F2F2F5]">
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <button onClick={toggleTimer} className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${isRunning ? 'bg-white/[0.08] text-[#F2F2F5] hover:bg-white/[0.12]' : 'bg-[#F2A93B] text-black hover:brightness-110'}`}>
                      {isRunning ? <Pause size={15} /> : <Play size={15} />} {isRunning ? (t('pauseTimer') || 'Pause') : (t('startFocus') || 'Start Focus')}
                    </button>
                    <button onClick={() => setActiveTab('focus')} className="w-full py-1.5 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#F2F2F5] transition cursor-pointer flex items-center justify-center gap-1">
                      {t('openTimer') || 'Open full timer'} <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Stats & Streak */}
              <div className="panel panel-hover rounded-2xl p-6 flex flex-col justify-between">
                <h3 className="font-['Manrope'] font-bold text-sm text-[#F2F2F5] flex items-center gap-2 mb-4">
                  <Sparkles size={15} className="text-[#2DD4BF]" /> {t('quickStats') || 'Quick Stats'}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-[#71717A] uppercase tracking-wider">{t('todayFocus') || "Today's Focus"}</span>
                    <span className="font-['JetBrains_Mono'] text-lg font-bold text-[#F2F2F5]">{formatFocusDuration(focusSecondsToday)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-[#71717A] uppercase tracking-wider">{t('tasksDone') || 'Tasks Done'}</span>
                    <span className="font-['JetBrains_Mono'] text-lg font-bold text-[#F2F2F5]">{tasks.filter(x => x.is_completed).length}/{tasks.length}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-[#71717A] uppercase tracking-wider">{t('subjectFolders') || 'Subjects'}</span>
                    <span className="font-['JetBrains_Mono'] text-lg font-bold text-[#F2F2F5]">{modules.length}</span>
                  </div>
                </div>
              </div>

              {/* Active Subject quick resume */}
              <div className="panel panel-hover rounded-2xl p-6 flex flex-col justify-between">
                <h3 className="font-['Manrope'] font-bold text-sm text-[#F2F2F5] flex items-center gap-2 mb-3">
                  <Folder size={15} className="text-indigo-400" /> {t('activeSubject') || 'Active Subject'}
                </h3>
                {activeModule ? (
                  <>
                    <p className="text-[#F2F2F5] font-semibold text-sm truncate">{activeModule.title}</p>
                    <p className="text-[#71717A] text-xs mt-1 mb-4">{t('inProgress') || 'In Progress'}</p>
                    <button onClick={() => openFolder(activeModule)} className="text-xs font-medium text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer">
                      {t('resume') || 'Resume'} <ArrowRight size={12} />
                    </button>
                  </>
                ) : (
                  <p className="text-[#52525B] text-xs">{t('noActiveSubject') || 'No active subject yet — add one in Subjects.'}</p>
                )}
              </div>

              {/* Today's Roadmap — spans 2 cols */}
              <div className="panel panel-hover rounded-2xl p-6 md:col-span-2">
                <h3 className="font-['Manrope'] font-bold text-sm text-[#F2F2F5] flex items-center gap-2 mb-4">
                  <CalendarDays size={15} className="text-rose-400" /> {t('todaysRoadmap') || "Today's Roadmap"}
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {todaysEvents.length === 0 && openGoals.length === 0 ? (
                    <p className="text-[#52525B] text-xs py-4 text-center">{t('nothingScheduled') || 'Nothing scheduled — enjoy the clear day.'}</p>
                  ) : (
                    <>
                      {todaysEvents.map((ev) => (
                        <div key={`ev-${ev.id}`} className="flex items-center gap-2.5 py-1.5">
                          <Circle size={7} className="text-rose-400 fill-rose-400 shrink-0" />
                          <span className="text-sm text-[#D4D4D8] truncate">{ev.title}</span>
                          <span className="text-[10px] text-[#52525B] ml-auto shrink-0">{t('today') || 'Today'}</span>
                        </div>
                      ))}
                      {openGoals.slice(0, 5).map((g) => (
                        <div key={`g-${g.id}`} onClick={() => toggleTask(g.id, g.is_completed)} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
                          <input type="checkbox" checked={false} onChange={() => {}} className="rounded border-white/20 text-teal-400 focus:ring-0 cursor-pointer" />
                          <span className="text-sm text-[#D4D4D8] truncate group-hover:text-[#F2F2F5]">{g.title}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Resource Quick-Drop */}
              <div className="panel panel-hover rounded-2xl p-6">
                <h3 className="font-['Manrope'] font-bold text-sm text-[#F2F2F5] flex items-center gap-2 mb-3">
                  <FileText size={15} className="text-amber-300" /> {t('quickDrop') || 'Resource Quick-Drop'}
                </h3>
                {recentFiles.length === 0 ? (
                  <p className="text-[#52525B] text-xs py-2">{t('noFilesYetShort') || 'No files uploaded yet.'}</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentFiles.map((f) => (
                      <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[#A1A1AA] hover:text-[#F2F2F5] transition truncate">
                        <FileText size={12} className="shrink-0" /> <span className="truncate">{f.file_name}</span>
                      </a>
                    ))}
                  </div>
                )}
                <button onClick={() => setActiveTab('folders')} className="text-xs font-medium text-amber-300 hover:underline flex items-center gap-1 mt-3 cursor-pointer">
                  {t('browseAll') || 'Browse all'} <ArrowRight size={12} />
                </button>
              </div>

            </div>
          )}

          {/* ============ FOCUS TAB ============ */}
          {activeTab === 'focus' && (
            <div key="focus" className="panel rounded-2xl p-8 flex flex-col items-center justify-center fade-in">
              <div className="flex space-x-1 mb-8 border border-white/[0.07] p-1 rounded-lg">
                <button onClick={() => resetTimer('work')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${mode === 'work' ? 'bg-[#F2A93B] text-black' : 'text-[#71717A] hover:text-[#F2F2F5]'}`}>
                  {t('focusSession') || 'Focus Session'}
                </button>
                <button onClick={() => resetTimer('break')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${mode === 'break' ? 'bg-[#2DD4BF] text-black' : 'text-[#71717A] hover:text-[#F2F2F5]'}`}>
                  {t('shortBreak') || 'Short Break'}
                </button>
              </div>

              {/* Customizable duration — disabled while the timer is running */}
              <div className="flex items-center gap-4 mb-6 text-xs text-[#71717A]">
                <label className="flex items-center gap-2">
                  {t('focusMinutes') || 'Focus (min)'}
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={focusMinutes}
                    disabled={isRunning}
                    onChange={(e) => handleDurationChange('work', e.target.value)}
                    className="w-16 bg-transparent border border-white/[0.09] rounded-md px-2 py-1 text-center text-[#F2F2F5] focus:outline-none focus:border-amber-400/50 disabled:opacity-40"
                  />
                </label>
                <label className="flex items-center gap-2">
                  {t('breakMinutes') || 'Break (min)'}
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={breakMinutes}
                    disabled={isRunning}
                    onChange={(e) => handleDurationChange('break', e.target.value)}
                    className="w-16 bg-transparent border border-white/[0.09] rounded-md px-2 py-1 text-center text-[#F2F2F5] focus:outline-none focus:border-teal-400/50 disabled:opacity-40"
                  />
                </label>
              </div>

              <div className="text-7xl font-['JetBrains_Mono'] font-bold tracking-tight mb-3 text-[#F2F2F5]">{formatTime(timeLeft)}</div>
              <p className="text-[#71717A] text-sm mb-8">{mode === 'work' ? (t('stayFocused') || 'Stay focused on your task.') : (t('takeABreather') || 'Take a breather and relax.')}</p>

              <div className="flex space-x-3 mb-6">
                <button onClick={toggleTimer} className={`px-6 py-2.5 rounded-lg font-semibold flex items-center space-x-2 transition cursor-pointer ${isRunning ? 'bg-white/[0.08] hover:bg-white/[0.12] text-[#F2F2F5]' : 'bg-[#F2A93B] hover:brightness-110 text-black'}`}>
                  {isRunning ? <Pause size={16} /> : <Play size={16} />}
                  <span>{isRunning ? (t('pauseTimer') || 'Pause Timer') : (t('startFocus') || 'Start Focus')}</span>
                </button>
                <button onClick={() => resetTimer()} className="p-2.5 border border-white/[0.07] hover:border-white/[0.16] text-[#71717A] rounded-lg transition cursor-pointer">
                  <RotateCcw size={16} />
                </button>
              </div>

              <AmbientPlayer />
            </div>
          )}

          {/* ============ GOALS TAB ============ */}
          {activeTab === 'goals' && (
            <div key="goals" className="panel rounded-2xl p-6 max-w-xl fade-in">
              <h3 className="font-['Manrope'] font-bold text-sm text-[#F2F2F5] flex items-center gap-2 mb-4">
                <Sparkles size={15} className="text-teal-300" /> {t('dailyGoals') || 'Daily Goals'}
              </h3>

              <form onSubmit={addGoal} className="flex gap-2 mb-4">
                <input type="text" placeholder={t('addGoalPlaceholder') || 'Add a new goal...'} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1 bg-transparent border border-white/[0.09] rounded-lg px-3 py-2 text-sm text-[#F2F2F5] focus:outline-none focus:border-teal-400/50" />
                <button type="submit" className="bg-white/[0.08] hover:bg-white/[0.14] text-[#F2F2F5] p-2 rounded-lg transition cursor-pointer"><Plus size={16} /></button>
              </form>

              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {loadingTasks ? (
                  <p className="text-[#52525B] text-xs text-center py-4">{t('loadingGoals') || 'Loading goals...'}</p>
                ) : tasks.length === 0 ? (
                  <p className="text-[#52525B] text-xs text-center py-4">{t('noGoals') || 'No goals added yet.'}</p>
                ) : (
                  tasks.map((task, idx) => (
                    <div key={task.id ?? idx} className={`p-3 rounded-lg border transition flex items-center justify-between ${task.is_completed ? 'border-transparent text-[#52525B] line-through' : 'border-white/[0.07] text-[#F2F2F5] hover:border-white/[0.14]'}`}>
                      <div onClick={() => toggleTask(task.id, task.is_completed)} className="flex items-center space-x-3 cursor-pointer flex-1">
                        <input type="checkbox" checked={task.is_completed} onChange={() => {}} className="rounded border-white/20 text-teal-400 focus:ring-0 cursor-pointer" />
                        <span className="text-sm font-medium">{task.title}</span>
                      </div>
                      <button type="button" onClick={() => deleteTask(task.id)} className="text-[#52525B] hover:text-red-400 transition ml-2 p-1 cursor-pointer">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ============ NOTES TAB ============ */}
          {activeTab === 'notes' && (
            <div key="notes" className="panel rounded-2xl p-6 fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-['Manrope'] font-bold text-sm text-[#F2F2F5] flex items-center gap-2">
                  <StickyNote size={15} className="text-yellow-300" /> {t('quickNotes') || 'Quick Notes & Scratchpad'}
                </h3>
                <span className="text-[11px] text-[#52525B]">
                  {scratchpadStatus === 'saving' ? (t('saving') || 'Saving...') : scratchpadStatus === 'saved' ? (t('saved') || 'Saved ✓') : ''}
                </span>
              </div>
              <textarea
                value={scratchpadContent}
                onChange={(e) => handleScratchpadChange(e.target.value)}
                placeholder={t('scratchpadPlaceholder') || 'Jot down quick thoughts, reminders, or things to look up later...'}
                rows={12}
                className="w-full bg-transparent border border-white/[0.09] rounded-lg px-4 py-3 text-sm text-[#F2F2F5] focus:outline-none focus:border-yellow-400/50 resize-none"
              />
            </div>
          )}

          {/* ============ CALENDAR TAB ============ */}
          {activeTab === 'calendar' && (
            <div key="calendar" className="panel rounded-2xl p-6 space-y-6 fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                <div>
                  <h3 className="font-['Manrope'] font-bold text-sm text-[#F2F2F5] flex items-center gap-2">
                    <CalendarIcon size={16} className="text-rose-400" /> {t('calendarEvents') || 'Calendar & Events'}
                  </h3>
                  <p className="text-[#71717A] text-xs mt-0.5">{t('holidaysHighlight') || 'Official Tunisian holidays highlighted in'} <span className="text-red-400 font-semibold">RED</span> · {t('moodHint') || 'Click the dot on any day to log your mood'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={prevMonth} className="p-1.5 border border-white/[0.07] hover:border-white/[0.16] text-[#F2F2F5] rounded-lg transition cursor-pointer"><ChevronLeft size={16} /></button>
                  <span className="text-sm font-bold text-[#F2F2F5] min-w-[130px] text-center">{currentDate.toLocaleString(language === 'fr' ? 'fr-FR' : 'default', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={nextMonth} className="p-1.5 border border-white/[0.07] hover:border-white/[0.16] text-[#F2F2F5] rounded-lg transition cursor-pointer"><ChevronRight size={16} /></button>
                </div>
              </div>

              <form onSubmit={addEvent} className="flex flex-col md:flex-row gap-3">
                <input type="text" placeholder={t('eventTitlePlaceholder') || 'Event or Exam Title...'} value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} className="flex-1 bg-transparent border border-white/[0.09] rounded-lg px-3 py-2 text-sm text-[#F2F2F5] focus:outline-none focus:border-rose-400/50" required />
                <input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="bg-transparent border border-white/[0.09] rounded-lg px-3 py-2 text-sm text-[#A1A1AA] focus:outline-none focus:border-rose-400/50" required />
                <button type="submit" className="bg-rose-500 hover:brightness-110 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer">
                  <Plus size={16} /> {t('addEvent') || 'Add Event'}
                </button>
              </form>

              <div className="grid grid-cols-7 gap-1.5 text-center">
                {[t('sun') || 'Sun', t('mon') || 'Mon', t('tue') || 'Tue', t('wed') || 'Wed', t('thu') || 'Thu', t('fri') || 'Fri', t('sat') || 'Sat'].map((d) => (
                  <div key={d} className="text-[#52525B] text-[10px] font-bold py-1.5 uppercase tracking-wider">{d}</div>
                ))}
                {Array.from({ length: firstDay }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-24 rounded-lg border border-white/[0.03]"></div>
                ))}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const formattedDay = String(dayNum).padStart(2, '0');
                  const formattedMonth = String(currentMonth + 1).padStart(2, '0');
                  const holidayKey = `${formattedMonth}-${formattedDay}`;
                  const holidayName = TUNISIAN_HOLIDAYS[holidayKey];
                  const fullDateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;
                  const dayEvents = events.filter((e) => e.event_date === fullDateStr);
                  const dayMood = moods[fullDateStr];

                  return (
                    <div key={dayNum} className={`h-24 p-1.5 rounded-lg border text-left flex flex-col justify-between relative transition ${holidayName ? 'bg-red-500/[0.06] border-red-400/20' : 'border-white/[0.07] hover:border-white/[0.14]'}`}>
                      <div className="flex justify-between items-start">
                        <span className={`text-[11px] font-bold ${holidayName ? 'text-red-300' : 'text-[#F2F2F5]'}`}>{dayNum}</span>
                        {holidayName && <span className="text-[9px] bg-red-500/15 text-red-300 px-1 py-0.5 rounded truncate max-w-[70px]">🇹🇳 {holidayName}</span>}
                        <button onClick={() => setMoodPickerDate(fullDateStr)} className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/10 transition cursor-pointer text-xs">
                          {dayMood || <span className="w-1 h-1 rounded-full bg-white/20 block" />}
                        </button>
                      </div>
                      <div className="space-y-1 overflow-y-auto max-h-10">
                        {dayEvents.map((ev, evIdx) => (
                          <div key={ev.id ?? evIdx} className="bg-indigo-500/[0.12] border border-indigo-400/20 text-indigo-200 text-[9px] p-1 rounded flex items-center justify-between group">
                            <span className="truncate font-medium">{ev.title}</span>
                            <button onClick={() => deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100 text-red-400 transition cursor-pointer">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============ FOLDERS (SUBJECTS) TAB ============ */}
          {activeTab === 'folders' && (
            <div key="folders" className="panel rounded-2xl p-6 fade-in">
              <div className="mb-5">
                <h3 className="font-['Manrope'] font-bold text-sm text-[#F2F2F5] flex items-center gap-2">
                  <Folder size={16} className="text-amber-300" /> {t('subjectFoldersDrive') || 'Subjects & Resource Vault'}
                </h3>
                <p className="text-[#71717A] text-xs mt-0.5">{t('folderClickPrompt') || 'Click any subject to open it and manage notes, exercises, and PDFs.'}</p>
              </div>

              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
                <input
                  type="text"
                  placeholder={t('searchFolders') || 'Search subjects...'}
                  value={folderSearch}
                  onChange={(e) => setFolderSearch(e.target.value)}
                  className="w-full bg-transparent border border-white/[0.09] rounded-lg pl-9 pr-3 py-2 text-sm text-[#F2F2F5] focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <form onSubmit={addModule} className="flex gap-3 mb-5">
                <input type="text" placeholder={t('folderPlaceholder') || 'Subject name (e.g. Mathematics, Architecture)...'} value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} className="flex-1 bg-transparent border border-white/[0.09] rounded-lg px-3 py-2 text-sm text-[#F2F2F5] focus:outline-none focus:border-amber-400/50" required />
                <button type="submit" className="bg-[#F2A93B] hover:brightness-110 text-black text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition">
                  <Plus size={16} /> {t('addFolder') || 'Add'}
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {loadingModules ? (
                  <p className="text-[#52525B] text-xs col-span-full text-center py-4">{t('loadingFolders') || 'Loading subjects...'}</p>
                ) : filteredModules.length === 0 ? (
                  <p className="text-[#52525B] text-xs col-span-full text-center py-4">
                    {modules.length === 0 ? (t('noFolders') || 'No subjects created yet.') : (t('noFoldersMatch') || 'No subjects match your search.')}
                  </p>
                ) : (
                  filteredModules.map((mod) => (
                    <div key={mod.id} className="panel-hover border border-white/[0.07] rounded-xl p-4 flex flex-col justify-between group">
                      <div className="flex items-center justify-between mb-2">
                        <div onClick={() => openFolder(mod)} className="flex items-center space-x-2 cursor-pointer flex-1 truncate">
                          <Folder size={17} className="text-amber-300 shrink-0" />
                          <span className="font-semibold text-[#F2F2F5] text-sm truncate group-hover:text-amber-300 transition">{mod.title}</span>
                        </div>
                        <button onClick={() => deleteModule(mod.id)} className="text-[#52525B] hover:text-red-400 transition p-1 cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.05] mt-2">
                        <button onClick={() => toggleModuleStatus(mod.id, mod.status)} className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition cursor-pointer ${mod.status === 'Mastered' ? 'text-emerald-300 bg-emerald-400/10' : 'text-blue-300 bg-blue-400/10'}`}>
                          {mod.status === 'Mastered' ? (t('mastered') || 'Mastered') : (t('inProgress') || 'In Progress')}
                        </button>
                        <button onClick={() => openFolder(mod)} className="text-[11px] text-amber-300 hover:underline flex items-center gap-1 cursor-pointer">
                          {t('openFolder') || 'Open'} →
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ============ FLASHCARDS TAB ============ */}
          {activeTab === 'flashcards' && (
            <div key="flashcards" className="panel rounded-2xl p-6 fade-in">
              <FlashcardGenerator />
            </div>
          )}

          {/* ============ ASSISTANT TAB ============ */}
          {activeTab === 'assistant' && (
            <div key="assistant" className="panel rounded-2xl p-6 fade-in">
              <p className="text-sm text-[#A1A1AA]">
                {t('assistantHint') || 'Your study assistant floats in the corner of every page — click the chat bubble to open it anytime.'}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* --- AI Assistant: floats globally, not tied to any single tab --- */}
      <StudyAiWidget />

      {/* --- Folder Drive Modal --- */}
      {activeFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="panel rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
              <div className="flex items-center space-x-2.5 truncate">
                <Folder size={19} className="text-amber-300 shrink-0" />
                <div>
                  <h3 className="font-bold text-[#F2F2F5] truncate text-sm">{activeFolder.title}</h3>
                  <p className="text-xs text-[#71717A]">{t('folderDriveFiles') || 'Manage files, PDFs, and resources for this subject'}</p>
                </div>
              </div>
              <button onClick={() => setActiveFolder(null)} className="p-1.5 text-[#71717A] hover:text-[#F2F2F5] hover:bg-white/[0.06] rounded-lg transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between border border-white/[0.07] p-3.5 rounded-lg">
                <div className="flex items-center space-x-2 text-xs text-[#F2F2F5]">
                  <FileText size={14} className="text-amber-300" />
                  <span>{folderFiles.length} {t('filesUploaded') || 'files uploaded in this folder'}</span>
                </div>
                <label className={`px-3.5 py-1.5 bg-[#F2A93B] hover:brightness-110 text-black rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={13} />
                  <span>{uploadingFile ? (t('uploading') || 'Uploading...') : (t('uploadFile') || 'Upload File')}</span>
                  <input type="file" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <div className="space-y-1.5">
                {folderFiles.length === 0 ? (
                  <div className="text-center py-8 text-[#52525B] text-xs">
                    {t('noFilesYet') || 'No files uploaded to this folder yet.'}
                  </div>
                ) : (
                  folderFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between border border-white/[0.07] hover:border-white/[0.14] p-2.5 rounded-lg transition">
                      <div className="flex items-center space-x-2.5 truncate">
                        <FileText size={16} className="text-amber-300 shrink-0" />
                        <div className="truncate">
                          <p className="text-sm font-medium text-[#F2F2F5] truncate">{file.file_name}</p>
                          <span className="text-[10px] text-[#52525B]">{file.file_size}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-white/[0.06] text-[#F2F2F5] rounded-md transition cursor-pointer">
                          <Download size={13} />
                        </a>
                        <button onClick={() => deleteFile(file.id, file.file_url)} className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-md transition cursor-pointer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Mood Picker Modal --- */}
      {moodPickerDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setMoodPickerDate(null)}>
          <div className="panel rounded-2xl p-6 max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-[#F2F2F5] mb-1">{t('howFeeling') || 'How are you feeling?'}</h4>
            <p className="text-xs text-[#71717A] mb-4">{moodPickerDate}</p>
            <div className="grid grid-cols-3 gap-2.5">
              {MOOD_OPTIONS.map((m) => (
                <button key={m.emoji} onClick={() => setMoodForDate(moodPickerDate, m.emoji)} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-white/[0.07] hover:border-teal-400/40 transition cursor-pointer">
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-[9px] text-[#71717A] text-center">{m.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setMoodPickerDate(null)} className="w-full mt-4 text-xs text-[#71717A] hover:text-[#F2F2F5] transition cursor-pointer">
              {t('cancel') || 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* --- Command Menu (Cmd/Ctrl+K) --- */}
      {commandOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm p-4" onClick={() => setCommandOpen(false)}>
          <div className="panel rounded-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.07]">
              <Command size={15} className="text-[#71717A]" />
              <input
                ref={commandInputRef}
                type="text"
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder={t('commandPlaceholder') || 'Jump to...'}
                className="flex-1 bg-transparent text-sm text-[#F2F2F5] focus:outline-none placeholder:text-[#52525B]"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[#71717A] font-['JetBrains_Mono']">ESC</kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {commandResults.length === 0 ? (
                <p className="text-[#52525B] text-xs text-center py-6">{t('noResults') || 'No matches.'}</p>
              ) : (
                commandResults.map((tabItem) => {
                  const Icon = tabItem.icon;
                  return (
                    <button
                      key={tabItem.key}
                      onClick={() => { setActiveTab(tabItem.key); setCommandOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[#D4D4D8] hover:bg-white/[0.06] hover:text-[#F2F2F5] transition cursor-pointer"
                    >
                      <Icon size={15} /> {tabItem.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}