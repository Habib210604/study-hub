'use client';
import FlashcardGenerator from '@/components/FlashcardGenerator';
import StreakTracker from '@/components/StreakTracker';
import AmbientPlayer from '@/components/AmbientPlayer';
import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, CheckCircle2, Clock, BookOpen,
  Sparkles, Plus, Trash2, LogOut, Calendar as CalendarIcon, Megaphone, Sun, Moon, ChevronLeft, ChevronRight,
  Timer, Target, CalendarDays, Layers, BrainCircuit, Folder, FileText, Upload, Download, X,
  StickyNote, Quote as QuoteIcon, Hourglass, Bot, Search, LayoutGrid, Command, ArrowRight, Circle, BookOpenCheck, Star, Users, Radio,
  User
} from 'lucide-react';
import { supabase } from './supabase';
import Auth from './auth';
import { useLanguage, STUDY_QUOTES_BY_LANG, HOLIDAY_NAMES_BY_LANG, MOOD_LABELS_BY_LANG } from '@/context/LanguageContext';
import StudyAiWidget from '@/components/StudyAiWidget';
import AssistantFullScreen from '@/components/AssistantFullScreen';
import PlanGate from '@/components/PlanGate';
import ResourceDrive from '@/components/ResourceDrive';
import FeedbackTab from '@/components/FeedbackTab';
import StudyBuddies from '@/components/StudyBuddies';
import NotesApp from '@/components/NotesApp';
import AccountCenter from '@/components/AccountCenter';

type TabKey = 'overview' | 'focus' | 'goals' | 'calendar' | 'notes' | 'folders' | 'drive' | 'flashcards' | 'assistant' | 'reviews' | 'buddies' | 'account';

const LANGUAGE_CYCLE = ['en', 'fr', 'ar'];

function StudyDashboardInner() {
  const { t, language, setLanguage } = useLanguage();

  const STUDY_QUOTES = STUDY_QUOTES_BY_LANG[language] || STUDY_QUOTES_BY_LANG.en;
  const TUNISIAN_HOLIDAYS = HOLIDAY_NAMES_BY_LANG[language] || HOLIDAY_NAMES_BY_LANG.en;
  const MOOD_EMOJIS = ['⚡', '☕', '🔥', '🌊', '😩'];
  const moodLabels = MOOD_LABELS_BY_LANG[language] || MOOD_LABELS_BY_LANG.en;
  const MOOD_OPTIONS = MOOD_EMOJIS.map((emoji, i) => ({ emoji, label: moodLabels[i] }));

  const [session, setSession] = useState<any>(null);
  const [userFirstName, setUserFirstName] = useState('');
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

  // --- Shared Focus Room state ---
  // roomActive = whether THIS user has joined (controls their own credit + presence).
  // roomElapsedSeconds = seconds since UTC midnight — the same for every user's browser,
  // with no backend syncing needed, and it never stops regardless of who joins/leaves.
  const [roomActive, setRoomActive] = useState(false);
  const [roomElapsedSeconds, setRoomElapsedSeconds] = useState(0);
  const [roomPresenceCount, setRoomPresenceCount] = useState(0);
  const roomChannelRef = useRef<any>(null);
  const roomAccrualIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getSecondsSinceMidnightUTC = () => {
    const now = new Date();
    const midnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor((now.getTime() - midnightUTC) / 1000);
  };

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
  }, [STUDY_QUOTES.length]);

  // The room clock ticks continuously, all day, independent of anyone joining
  useEffect(() => {
    setRoomElapsedSeconds(getSecondsSinceMidnightUTC());
    const interval = setInterval(() => {
      setRoomElapsedSeconds(getSecondsSinceMidnightUTC());
    }, 1000);
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

  const cycleLanguage = () => {
    const currentIndex = LANGUAGE_CYCLE.indexOf(language);
    const nextLanguage = LANGUAGE_CYCLE[(currentIndex + 1) % LANGUAGE_CYCLE.length];
    setLanguage(nextLanguage);
  };

  useEffect(() => {
    if (session) {
      fetchGoals();
      fetchModules();
      fetchAnnouncement();
      fetchEvents();
      fetchMoods();
      fetchRecentFiles();
      fetchUserFirstName();
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

    const fetchUserFirstName = async () => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', session.user.id)
      .single();
    if (!error && data?.first_name) {
      setUserFirstName(data.first_name);
    }
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

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset!);
      // "raw" covers PDFs and any non-image/video file type
      formData.append('resource_type', 'raw');
      formData.append('folder', `subject-files/${session.user.id}/${activeFolder.id}`);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
        method: 'POST',
        body: formData,
      });
      const cloudinaryData = await response.json();

      if (!response.ok) {
        throw new Error(cloudinaryData.error?.message || 'Upload failed');
      }

      const fileUrl = cloudinaryData.secure_url;
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
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    }

    setUploadingFile(false);
    e.target.value = '';
  };

  const deleteFile = async (fileId: number, fileUrl: string) => {
    setFolderFiles(folderFiles.filter(f => f.id !== fileId));
    await supabase.from('module_files').delete().eq('id', fileId);
    fetchRecentFiles();
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

  // --- Shared Focus Room: joining only affects YOUR credit + presence; the clock itself never stops ---
  const joinFocusRoom = () => {
    if (roomActive) return;
    setRoomActive(true);

    // Presence channel: lets everyone in the room see a live count of who else is focusing
    const channel = supabase.channel('focus-room', {
      config: { presence: { key: session?.user?.id || Math.random().toString(36) } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setRoomPresenceCount(Object.keys(state).length);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ joined_at: new Date().toISOString() });
        }
      });
    roomChannelRef.current = channel;

    // Personal credit only — the shared clock above keeps running regardless
    roomAccrualIntervalRef.current = setInterval(() => {
      setFocusSecondsToday((prevSecs) => {
        const updatedSecs = prevSecs + 1;
        const todayStr = new Date().toISOString().slice(0, 10);
        localStorage.setItem(`focus_time_${todayStr}`, updatedSecs.toString());
        return updatedSecs;
      });
    }, 1000);
  };

  const leaveFocusRoom = () => {
    setRoomActive(false);
    if (roomAccrualIntervalRef.current) clearInterval(roomAccrualIntervalRef.current);
    if (roomChannelRef.current) {
      roomChannelRef.current.untrack();
      supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }
  };

  // Clean up if the user navigates away entirely
  useEffect(() => {
    return () => {
      if (roomAccrualIntervalRef.current) clearInterval(roomAccrualIntervalRef.current);
      if (roomChannelRef.current) supabase.removeChannel(roomChannelRef.current);
    };
  }, []);

  const formatRoomTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
  const firstName = userFirstName || session?.user?.email?.split('@')[0] || '';

  const filteredModules = modules.filter((m) => m.title.toLowerCase().includes(folderSearch.toLowerCase()));

  const localeMap: Record<string, string> = { en: 'en-US', fr: 'fr-FR', ar: 'ar-TN' };

  const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: t('overview'), icon: LayoutGrid },
    { key: 'focus', label: t('pomodoroTimer'), icon: Timer },
    { key: 'goals', label: t('dailyGoals'), icon: Target },
    { key: 'calendar', label: t('calendarEvents'), icon: CalendarDays },
    { key: 'notes', label: t('quickNotes'), icon: StickyNote },
    { key: 'folders', label: t('subjectFolders'), icon: Folder },
    { key: 'drive', label: t('driveTab'), icon: BookOpenCheck },
    { key: 'buddies', label: t('buddiesTab'), icon: Users },
    { key: 'flashcards', label: t('aiFlashcards'), icon: BrainCircuit },
    { key: 'assistant', label: t('assistantTab'), icon: Bot },
    { key: 'reviews', label: t('reviewsTab'), icon: Star },
    { key: 'account', label: t('accountTab'), icon: User },
  ];

  const commandResults = TABS.filter((tabItem) =>
    tabItem.label.toLowerCase().includes(commandQuery.toLowerCase())
  );

  if (checkingAuth) {
    return <div className="min-h-screen bg-[var(--bg)] text-[var(--text-muted)] flex items-center justify-center text-sm font-['Inter']">{t('checkingSession') || 'Checking session...'}</div>;
  }

  if (!session) {
    return <Auth onLogin={fetchGoals} />;
  }

  return (
    <div className={`theme-${theme} min-h-screen font-['Inter'] transition-colors duration-300 relative flex bg-[var(--bg)] text-[var(--text)]`}>

      <style jsx global>{`
        :root {
          --bg: #09090B;
          --panel: #111113;
          --panel-hover: #16161a;
          --border: rgba(255,255,255,0.07);
          --border-strong: rgba(255,255,255,0.16);
          --border-faint: rgba(255,255,255,0.04);
          --text: #F2F2F5;
          --text-secondary: #D4D4D8;
          --text-muted: #71717A;
          --text-muted-2: #A1A1AA;
          --text-faint: #52525B;
          --surface-1: rgba(255,255,255,0.04);
          --surface-2: rgba(255,255,255,0.07);
          --surface-3: rgba(255,255,255,0.12);
        }
        .theme-dark {
          --bg: #09090B;
          --panel: #111113;
          --panel-hover: #16161a;
          --border: rgba(255,255,255,0.07);
          --border-strong: rgba(255,255,255,0.16);
          --border-faint: rgba(255,255,255,0.04);
          --text: #F2F2F5;
          --text-secondary: #D4D4D8;
          --text-muted: #71717A;
          --text-muted-2: #A1A1AA;
          --text-faint: #52525B;
          --surface-1: rgba(255,255,255,0.04);
          --surface-2: rgba(255,255,255,0.07);
          --surface-3: rgba(255,255,255,0.12);
          --accent-amber: #FCD34D;
          --accent-indigo: #C7D2FE;
          --accent-red: #FCA5A5;
          --accent-emerald: #6EE7B7;
          --accent-blue: #93C5FD;
        }
        .theme-light {
          --bg: #F6EEE4;
          --panel: #FFFDFA;
          --panel-hover: #FBF3E8;
          --border: rgba(70,45,25,0.10);
          --border-strong: rgba(70,45,25,0.22);
          --border-faint: rgba(70,45,25,0.05);
          --text: #2B2117;
          --text-secondary: #4A3B2C;
          --text-muted: #8A7864;
          --text-muted-2: #6E5D4C;
          --text-faint: #B4A28C;
          --surface-1: rgba(70,45,25,0.035);
          --surface-2: rgba(70,45,25,0.06);
          --surface-3: rgba(70,45,25,0.10);
          --accent-amber: #B45309;
          --accent-indigo: #4338CA;
          --accent-red: #B91C1C;
          --accent-emerald: #047857;
          --accent-blue: #1D4ED8;
        }
        .panel {
          background: var(--panel);
          border: 1px solid var(--border);
        }
        .panel-hover {
          transition: border-color 220ms ease, background-color 220ms ease;
        }
        .panel-hover:hover {
          border-color: var(--border-strong);
          background: var(--panel-hover);
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
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* --- Sidebar --- */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col justify-between border-r border-[var(--border)] px-4 py-6 h-screen sticky top-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2.5 px-2">
            <img src="/logo-icon.png" alt="Study Hub logo" className="w-8 h-8 object-contain" />
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
                    isActive ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-1)]'
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
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12px] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2"><Search size={13} /> {t('quickSearch') || 'Quick search'}</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] font-['JetBrains_Mono']">⌘K</kbd>
          </button>
          <div className="px-2 text-[11px] text-[var(--text-faint)] truncate">{session.user.email}</div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/[0.06] transition-colors cursor-pointer">
            <LogOut size={16} /> {t('logout') || 'Logout'}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">

        {/* --- Ultra-thin top bar --- */}
        <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] text-[var(--text-muted-2)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              </span>
              {t('active') || 'Active'} · {currentDate.toLocaleDateString(localeMap[language] || 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'overview' && <StreakTracker />}
              <button
                onClick={cycleLanguage}
                className="px-2.5 py-1 text-[12px] font-medium text-[var(--text-muted-2)] hover:text-[var(--text)] hover:bg-[var(--surface-1)] rounded-md transition cursor-pointer"
              >
                {language?.toUpperCase() || 'LANG'}
              </button>
              <div className="flex items-center border border-[var(--border)] rounded-md p-0.5">
                <button onClick={() => toggleTheme('light')} className={`p-1 rounded text-[11px] transition cursor-pointer ${theme === 'light' ? 'bg-[var(--surface-3)] text-[var(--text)]' : 'text-[var(--text-muted)]'}`}><Sun size={13} /></button>
                <button onClick={() => toggleTheme('dark')} className={`p-1 rounded text-[11px] transition cursor-pointer ${theme === 'dark' ? 'bg-[var(--surface-3)] text-[var(--text)]' : 'text-[var(--text-muted)]'}`}><Moon size={13} /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 space-y-8">

          {activeTab !== 'assistant' && (
            <>
              {/* --- Dynamic greeting header: full-width illustration background, greeting overlaid on the right --- */}
              <div
                className="relative rounded-2xl overflow-hidden fade-in border border-[var(--border)] min-h-[180px] md:min-h-[220px] flex items-center justify-end bg-cover bg-center"
                style={{ backgroundImage: "url('/welcome-banner.png')" }}
              >
                {/* Scrim: fades from transparent (left, over the illustration) to solid (right, behind the text) so the greeting stays readable regardless of theme */}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to right, transparent 0%, var(--bg) 78%, var(--bg) 100%)', opacity: 0.9 }}
                />
                <div className="relative z-10 px-6 md:px-10 py-6 text-right max-w-[65%] md:max-w-[55%]">
                  <h1 className="font-['Manrope'] text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text)]">
                    {greeting}{firstName ? `, ${firstName}` : ''}.
                  </h1>
                  <p className="text-[var(--text-muted)] text-sm mt-1">{t('readyToFocus') || "Let's make today count."}</p>
                </div>
              </div>

              {announcement && (
                <div className="panel rounded-xl p-4 flex items-center gap-3 fade-in border-l-2 !border-l-[#F2A93B]">
                  <Megaphone size={16} className="text-[#F2A93B] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-[#F2A93B] mr-2">{t('announcement') || 'Announcement'}</span>
                    <span className="text-sm text-[var(--text)] font-medium">{announcement.title}</span>
                    <p className="text-[var(--text-muted)] text-xs mt-0.5">{announcement.message}</p>
                  </div>
                </div>
              )}

              {/* --- Daily Inspiration / Countdown ticker: persistent, always visible under the announcement --- */}
              <div className="quote-gradient rounded-2xl p-4 border border-[var(--border)] flex items-center gap-3 fade-in">
                <QuoteIcon size={15} className="text-[#F2A93B] shrink-0" />
                <p key={quoteIndex} className="font-['Manrope'] text-sm text-[var(--text)] italic truncate">"{STUDY_QUOTES[quoteIndex]}"</p>
                {nextExam && daysUntilExam !== null && (
                  <span className="ml-auto shrink-0 flex items-center gap-1.5 text-xs font-['JetBrains_Mono'] text-[var(--text-muted-2)]">
                    <Hourglass size={12} /> {daysUntilExam === 0 ? (t('examToday') || 'Exam today!') : `${daysUntilExam}d → ${nextExam.title}`}
                  </span>
                )}
              </div>
            </>
          )}

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
                    isActive ? 'bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--text)]' : 'border-[var(--border)] text-[var(--text-muted)]'
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
                  <h3 className="font-['Manrope'] font-bold text-sm text-[var(--text)] flex items-center gap-2">
                    <Timer size={15} className="text-[#F2A93B]" /> {t('focusFlow') || 'Focus & Flow'}
                  </h3>
                  <span className="text-[11px] text-[var(--text-faint)] font-['JetBrains_Mono']">{mode === 'work' ? 'FOCUS' : 'BREAK'}</span>
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
                    <div className="absolute inset-0 flex items-center justify-center font-['JetBrains_Mono'] text-sm font-bold text-[var(--text)]">
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <button onClick={toggleTimer} className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${isRunning ? 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-3)]' : 'bg-[#F2A93B] text-black hover:brightness-110'}`}>
                      {isRunning ? <Pause size={15} /> : <Play size={15} />} {isRunning ? (t('pauseTimer') || 'Pause') : (t('startFocus') || 'Start Focus')}
                    </button>
                    <button onClick={() => setActiveTab('focus')} className="w-full py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer flex items-center justify-center gap-1">
                      {t('openTimer') || 'Open full timer'} <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Stats & Streak */}
              <div className="panel panel-hover rounded-2xl p-6 flex flex-col justify-between">
                <h3 className="font-['Manrope'] font-bold text-sm text-[var(--text)] flex items-center gap-2 mb-4">
                  <Sparkles size={15} className="text-[#2DD4BF]" /> {t('quickStats') || 'Quick Stats'}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">{t('todayFocus') || "Today's Focus"}</span>
                    <span className="font-['JetBrains_Mono'] text-lg font-bold text-[var(--text)]">{formatFocusDuration(focusSecondsToday)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">{t('tasksDone') || 'Tasks Done'}</span>
                    <span className="font-['JetBrains_Mono'] text-lg font-bold text-[var(--text)]">{tasks.filter(x => x.is_completed).length}/{tasks.length}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">{t('subjectFolders') || 'Subjects'}</span>
                    <span className="font-['JetBrains_Mono'] text-lg font-bold text-[var(--text)]">{modules.length}</span>
                  </div>
                </div>
              </div>

              {/* Active Subject quick resume */}
              <div className="panel panel-hover rounded-2xl p-6 flex flex-col justify-between">
                <h3 className="font-['Manrope'] font-bold text-sm text-[var(--text)] flex items-center gap-2 mb-3">
                  <Folder size={15} className="text-indigo-400" /> {t('activeSubject') || 'Active Subject'}
                </h3>
                {activeModule ? (
                  <>
                    <p className="text-[var(--text)] font-semibold text-sm truncate">{activeModule.title}</p>
                    <p className="text-[var(--text-muted)] text-xs mt-1 mb-4">{t('inProgress') || 'In Progress'}</p>
                    <button onClick={() => openFolder(activeModule)} className="text-xs font-medium text-[var(--accent-indigo)] hover:underline flex items-center gap-1 cursor-pointer">
                      {t('resume') || 'Resume'} <ArrowRight size={12} />
                    </button>
                  </>
                ) : (
                  <p className="text-[var(--text-faint)] text-xs">{t('noActiveSubject') || 'No active subject yet — add one in Subjects.'}</p>
                )}
              </div>

              {/* Today's Roadmap — spans 2 cols */}
              <div className="panel panel-hover rounded-2xl p-6 md:col-span-2">
                <h3 className="font-['Manrope'] font-bold text-sm text-[var(--text)] flex items-center gap-2 mb-4">
                  <CalendarDays size={15} className="text-rose-400" /> {t('todaysRoadmap') || "Today's Roadmap"}
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {todaysEvents.length === 0 && openGoals.length === 0 ? (
                    <p className="text-[var(--text-faint)] text-xs py-4 text-center">{t('nothingScheduled') || 'Nothing scheduled — enjoy the clear day.'}</p>
                  ) : (
                    <>
                      {todaysEvents.map((ev) => (
                        <div key={`ev-${ev.id}`} className="flex items-center gap-2.5 py-1.5">
                          <Circle size={7} className="text-rose-400 fill-rose-400 shrink-0" />
                          <span className="text-sm text-[var(--text-secondary)] truncate">{ev.title}</span>
                          <span className="text-[10px] text-[var(--text-faint)] ml-auto shrink-0">{t('today') || 'Today'}</span>
                        </div>
                      ))}
                      {openGoals.slice(0, 5).map((g) => (
                        <div key={`g-${g.id}`} onClick={() => toggleTask(g.id, g.is_completed)} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
                          <input type="checkbox" checked={false} onChange={() => {}} className="rounded border-[var(--border-strong)] text-teal-400 focus:ring-0 cursor-pointer" />
                          <span className="text-sm text-[var(--text-secondary)] truncate group-hover:text-[var(--text)]">{g.title}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Resource Quick-Drop */}
              <div className="panel panel-hover rounded-2xl p-6">
                <h3 className="font-['Manrope'] font-bold text-sm text-[var(--text)] flex items-center gap-2 mb-3">
                  <FileText size={15} className="text-[var(--accent-amber)]" /> {t('quickDrop') || 'Resource Quick-Drop'}
                </h3>
                {recentFiles.length === 0 ? (
                  <p className="text-[var(--text-faint)] text-xs py-2">{t('noFilesYetShort') || 'No files uploaded yet.'}</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentFiles.map((f) => (
                      <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[var(--text-muted-2)] hover:text-[var(--text)] transition truncate">
                        <FileText size={12} className="shrink-0" /> <span className="truncate">{f.file_name}</span>
                      </a>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <button onClick={() => setActiveTab('folders')} className="text-xs font-medium text-[var(--accent-amber)] hover:underline flex items-center gap-1 cursor-pointer">
                    {t('browseAll') || 'Browse Subjects'} <ArrowRight size={12} />
                  </button>
                  <button onClick={() => setActiveTab('drive')} className="text-xs font-medium text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer">
                    {t('driveTab')} <ArrowRight size={12} />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ============ FOCUS TAB ============ */}
          {activeTab === 'focus' && (
            <div key="focus" className="panel rounded-2xl p-8 flex flex-col items-center justify-center fade-in">
              <div className="flex space-x-1 mb-8 border border-[var(--border)] p-1 rounded-lg">
                <button onClick={() => resetTimer('work')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${mode === 'work' ? 'bg-[#F2A93B] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>
                  {t('focusSession') || 'Focus Session'}
                </button>
                <button onClick={() => resetTimer('break')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${mode === 'break' ? 'bg-[#2DD4BF] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>
                  {t('shortBreak') || 'Short Break'}
                </button>
              </div>

              {/* Customizable duration — disabled while the timer is running */}
              <div className="flex items-center gap-4 mb-6 text-xs text-[var(--text-muted)]">
                <label className="flex items-center gap-2">
                  {t('focusMinutes') || 'Focus (min)'}
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={focusMinutes}
                    disabled={isRunning}
                    onChange={(e) => handleDurationChange('work', e.target.value)}
                    className="w-16 bg-transparent border border-[var(--border)] rounded-md px-2 py-1 text-center text-[var(--text)] focus:outline-none focus:border-amber-400/50 disabled:opacity-40"
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
                    className="w-16 bg-transparent border border-[var(--border)] rounded-md px-2 py-1 text-center text-[var(--text)] focus:outline-none focus:border-teal-400/50 disabled:opacity-40"
                  />
                </label>
              </div>

              <div className="text-7xl font-['JetBrains_Mono'] font-bold tracking-tight mb-3 text-[var(--text)]">{formatTime(timeLeft)}</div>
              <p className="text-[var(--text-muted)] text-sm mb-8">{mode === 'work' ? (t('stayFocused') || 'Stay focused on your task.') : (t('takeABreather') || 'Take a breather and relax.')}</p>

              <div className="flex space-x-3 mb-6">
                <button onClick={toggleTimer} className={`px-6 py-2.5 rounded-lg font-semibold flex items-center space-x-2 transition cursor-pointer ${isRunning ? 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)]' : 'bg-[#F2A93B] hover:brightness-110 text-black'}`}>
                  {isRunning ? <Pause size={16} /> : <Play size={16} />}
                  <span>{isRunning ? (t('pauseTimer') || 'Pause Timer') : (t('startFocus') || 'Start Focus')}</span>
                </button>
                <button onClick={() => resetTimer()} className="p-2.5 border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text-muted)] rounded-lg transition cursor-pointer">
                  <RotateCcw size={16} />
                </button>
              </div>

              <AmbientPlayer />
            </div>
          )}

          {/* ============ SHARED FOCUS ROOM (all-day clock, sits alongside the personal timer) ============ */}
          {activeTab === 'focus' && (
            <div
              className="relative overflow-hidden rounded-2xl p-6 mt-4 fade-in border border-[var(--border)]"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(45,212,191,0.06))' }}
            >
              {/* decorative ambient glow */}
              <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-indigo-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-teal-400/10 blur-3xl" />

              <div className="relative flex items-center justify-between mb-1">
                <h3 className="font-['Manrope'] font-bold text-[var(--text)] flex items-center gap-2">
                  <Radio size={17} className="text-indigo-400 animate-pulse" />
                  Focus Room
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 px-1.5 py-0.5 rounded-full">Live</span>
                </h3>
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-black/20 border border-[var(--border)] rounded-full px-3 py-1">
                  <Users size={12} /> {roomPresenceCount} studying now
                </span>
              </div>
              <p className="relative text-xs text-[var(--text-muted)] mb-6">
                A shared clock that runs all day, for everyone — jump in anytime. Your own minutes still count toward Today's Focus even after you leave.
              </p>

              <div className="relative flex flex-col items-center py-4">
                <div className="relative mb-5 flex items-center justify-center w-40 h-40">
                  <div className={`absolute inset-0 blur-3xl rounded-full transition-colors duration-1000 ${roomActive ? 'bg-rose-400/20' : 'bg-indigo-400/10'}`} />
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    style={{ animation: 'spin 14s linear infinite' }}
                  >
                    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#roomGrad)" strokeWidth="1.5" strokeDasharray="4 10" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="roomGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#2dd4bf" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="relative text-4xl font-['JetBrains_Mono'] font-bold tracking-tight text-[var(--text)]">
                    {formatRoomTime(roomElapsedSeconds)}
                  </div>
                </div>

                {roomActive ? (
                  <button
                    onClick={leaveFocusRoom}
                    className="px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition cursor-pointer"
                  >
                    <LogOut size={16} /> Leave
                  </button>
                ) : (
                  <button
                    onClick={joinFocusRoom}
                    className="px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 bg-indigo-500 hover:brightness-110 text-white transition cursor-pointer"
                  >
                    <Users size={16} /> Join the Room
                  </button>
                )}
                {roomActive && (
                  <p className="text-[11px] text-[var(--text-faint)] mt-3">You're currently earning credit toward Today's Focus.</p>
                )}
              </div>
            </div>
          )}

          {/* ============ GOALS TAB ============ */}
          {activeTab === 'goals' && (
            <div key="goals" className="panel rounded-2xl p-6 max-w-xl fade-in">
              <h3 className="font-['Manrope'] font-bold text-sm text-[var(--text)] flex items-center gap-2 mb-4">
                <Sparkles size={15} className="text-teal-300" /> {t('dailyGoals') || 'Daily Goals'}
              </h3>

              <form onSubmit={addGoal} className="flex gap-2 mb-4">
                <input type="text" placeholder={t('addGoalPlaceholder') || 'Add a new goal...'} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1 bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-teal-400/50" />
                <button type="submit" className="bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] p-2 rounded-lg transition cursor-pointer"><Plus size={16} /></button>
              </form>

              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {loadingTasks ? (
                  <p className="text-[var(--text-faint)] text-xs text-center py-4">{t('loadingGoals') || 'Loading goals...'}</p>
                ) : tasks.length === 0 ? (
                  <p className="text-[var(--text-faint)] text-xs text-center py-4">{t('noGoals') || 'No goals added yet.'}</p>
                ) : (
                  tasks.map((task, idx) => (
                    <div key={task.id ?? idx} className={`p-3 rounded-lg border transition flex items-center justify-between ${task.is_completed ? 'border-transparent text-[var(--text-faint)] line-through' : 'border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]'}`}>
                      <div onClick={() => toggleTask(task.id, task.is_completed)} className="flex items-center space-x-3 cursor-pointer flex-1">
                        <input type="checkbox" checked={task.is_completed} onChange={() => {}} className="rounded border-[var(--border-strong)] text-teal-400 focus:ring-0 cursor-pointer" />
                        <span className="text-sm font-medium">{task.title}</span>
                      </div>
                      <button type="button" onClick={() => deleteTask(task.id)} className="text-[var(--text-faint)] hover:text-red-400 transition ml-2 p-1 cursor-pointer">
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
              <NotesApp />
            </div>
          )}

          {/* ============ CALENDAR TAB ============ */}
          {activeTab === 'calendar' && (
            <div key="calendar" className="panel rounded-2xl p-6 space-y-6 fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <h3 className="font-['Manrope'] font-bold text-sm text-[var(--text)] flex items-center gap-2">
                    <CalendarIcon size={16} className="text-rose-400" /> {t('calendarEvents') || 'Calendar & Events'}
                  </h3>
                  <p className="text-[var(--text-muted)] text-xs mt-0.5">{t('holidaysHighlight') || 'Official Tunisian holidays highlighted in'} <span className="text-red-400 font-semibold">RED</span> · {t('moodHint') || 'Click the dot on any day to log your mood'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={prevMonth} className="p-1.5 border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text)] rounded-lg transition cursor-pointer"><ChevronLeft size={16} /></button>
                  <span className="text-sm font-bold text-[var(--text)] min-w-[130px] text-center">{currentDate.toLocaleString(localeMap[language] || 'default', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={nextMonth} className="p-1.5 border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text)] rounded-lg transition cursor-pointer"><ChevronRight size={16} /></button>
                </div>
              </div>

              <form onSubmit={addEvent} className="flex flex-col md:flex-row gap-3">
                <input type="text" placeholder={t('eventTitlePlaceholder') || 'Event or Exam Title...'} value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} className="flex-1 bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-rose-400/50" required />
                <input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-muted-2)] focus:outline-none focus:border-rose-400/50" required />
                <button type="submit" className="bg-rose-500 hover:brightness-110 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer">
                  <Plus size={16} /> {t('addEvent') || 'Add Event'}
                </button>
              </form>

              <div className="grid grid-cols-7 gap-1 md:gap-1.5 text-center">
                {[t('sun') || 'Sun', t('mon') || 'Mon', t('tue') || 'Tue', t('wed') || 'Wed', t('thu') || 'Thu', t('fri') || 'Fri', t('sat') || 'Sat'].map((d) => (
                  <div key={d} className="text-[var(--text-faint)] text-[9px] md:text-[10px] font-bold py-1 md:py-1.5 uppercase tracking-wider truncate">{d}</div>
                ))}
                {Array.from({ length: firstDay }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-14 md:h-24 rounded-lg border border-[var(--border-faint)]"></div>
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
                    <div key={dayNum} className={`h-14 md:h-24 p-1 md:p-1.5 rounded-lg border text-left flex flex-col justify-between relative transition ${holidayName ? 'bg-red-500/[0.06] border-red-400/20' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}`}>
                      <div className="flex justify-between items-start gap-0.5">
                        <span className={`text-[10px] md:text-[11px] font-bold ${holidayName ? 'text-[var(--accent-red)]' : 'text-[var(--text)]'}`}>{dayNum}</span>
                        {holidayName && <span className="hidden md:inline text-[9px] bg-red-500/15 text-[var(--accent-red)] px-1 py-0.5 rounded truncate max-w-[70px]">🇹🇳 {holidayName}</span>}
                        {holidayName && <span className="md:hidden text-[10px]">🇹🇳</span>}
                        <button onClick={() => setMoodPickerDate(fullDateStr)} className="absolute top-0.5 right-0.5 w-3.5 h-3.5 md:w-4 md:h-4 flex items-center justify-center rounded-full hover:bg-[var(--surface-3)] transition cursor-pointer text-[10px] md:text-xs">
                          {dayMood || <span className="w-1 h-1 rounded-full bg-white/20 block" />}
                        </button>
                      </div>
                      <div className="space-y-0.5 md:space-y-1 overflow-y-auto max-h-6 md:max-h-10">
                        {dayEvents.length > 0 && (
                          <>
                            {/* Mobile: just a dot per event, no text — keeps the cell readable */}
                            <div className="md:hidden flex flex-wrap gap-0.5">
                              {dayEvents.map((ev, evIdx) => (
                                <span key={ev.id ?? evIdx} className="w-1.5 h-1.5 rounded-full bg-indigo-400 block" title={ev.title} />
                              ))}
                            </div>
                            {/* Desktop: full event chips as before */}
                            <div className="hidden md:block space-y-1">
                              {dayEvents.map((ev, evIdx) => (
                                <div key={ev.id ?? evIdx} className="bg-indigo-500/[0.12] border border-indigo-400/20 text-[var(--accent-indigo)] text-[9px] p-1 rounded flex items-center justify-between group">
                                  <span className="truncate font-medium">{ev.title}</span>
                                  <button onClick={() => deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100 text-red-400 transition cursor-pointer">×</button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
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
                <h3 className="font-['Manrope'] font-bold text-sm text-[var(--text)] flex items-center gap-2">
                  <Folder size={16} className="text-[var(--accent-amber)]" /> {t('subjectFoldersDrive') || 'Subjects & Resource Vault'}
                </h3>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{t('folderClickPrompt') || 'Click any subject to open it and manage notes, exercises, and PDFs.'}</p>
              </div>

              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="text"
                  placeholder={t('searchFolders') || 'Search subjects...'}
                  value={folderSearch}
                  onChange={(e) => setFolderSearch(e.target.value)}
                  className="w-full bg-transparent border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <form onSubmit={addModule} className="flex gap-3 mb-5">
                <input type="text" placeholder={t('folderPlaceholder') || 'Subject name (e.g. Mathematics, Architecture)...'} value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} className="flex-1 bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-amber-400/50" required />
                <button type="submit" className="bg-[#F2A93B] hover:brightness-110 text-black text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition">
                  <Plus size={16} /> {t('addFolder') || 'Add'}
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {loadingModules ? (
                  <p className="text-[var(--text-faint)] text-xs col-span-full text-center py-4">{t('loadingFolders') || 'Loading subjects...'}</p>
                ) : filteredModules.length === 0 ? (
                  <p className="text-[var(--text-faint)] text-xs col-span-full text-center py-4">
                    {modules.length === 0 ? (t('noFolders') || 'No subjects created yet.') : (t('noFoldersMatch') || 'No subjects match your search.')}
                  </p>
                ) : (
                  filteredModules.map((mod) => (
                    <div key={mod.id} className="panel-hover border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between group">
                      <div className="flex items-center justify-between mb-2">
                        <div onClick={() => openFolder(mod)} className="flex items-center space-x-2 cursor-pointer flex-1 truncate">
                          <Folder size={17} className="text-[var(--accent-amber)] shrink-0" />
                          <span className="font-semibold text-[var(--text)] text-sm truncate group-hover:text-[var(--accent-amber)] transition">{mod.title}</span>
                        </div>
                        <button onClick={() => deleteModule(mod.id)} className="text-[var(--text-faint)] hover:text-red-400 transition p-1 cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border-faint)] mt-2">
                        <button onClick={() => toggleModuleStatus(mod.id, mod.status)} className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition cursor-pointer ${mod.status === 'Mastered' ? 'text-[var(--accent-emerald)] bg-emerald-400/10' : 'text-[var(--accent-blue)] bg-blue-400/10'}`}>
                          {mod.status === 'Mastered' ? (t('mastered') || 'Mastered') : (t('inProgress') || 'In Progress')}
                        </button>
                        <button onClick={() => openFolder(mod)} className="text-[11px] text-[var(--accent-amber)] hover:underline flex items-center gap-1 cursor-pointer">
                          {t('openFolder') || 'Open'} →
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ============ DRIVE TAB ============ */}
          {activeTab === 'drive' && (
            <div key="drive" className="panel rounded-2xl p-6 fade-in">
              <ResourceDrive />
            </div>
          )}

          {/* ============ STUDY BUDDIES TAB ============ */}
          {activeTab === 'buddies' && (
            <div key="buddies" className="panel rounded-2xl p-6 fade-in">
              <StudyBuddies />
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
              <AssistantFullScreen />
            </div>
          )}

          {/* ============ REVIEWS TAB ============ */}
          {activeTab === 'reviews' && (
            <div key="reviews" className="panel rounded-2xl p-6 fade-in">
              <FeedbackTab />
            </div>
          )}

          {/* ============ ACCOUNT TAB ============ */}
          {activeTab === 'account' && (
            <div key="account" className="panel rounded-2xl p-6 fade-in">
              <AccountCenter session={session} />
            </div>
          )}

        </div>
      </div>

      {/* --- AI Assistant bubble: floats on every tab EXCEPT Assistant, where the full-screen chat is already shown --- */}
      {activeTab !== 'assistant' && <StudyAiWidget />}

           {/* --- Floating focus timer: shows on every OTHER tab while a session is active, sits just above the AI bubble --- */}
      {activeTab !== 'focus' && (isRunning || roomActive) && (
        <button
          onClick={() => setActiveTab('focus')}
          className="fixed bottom-24 right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg border border-[#D9C3A9] bg-[#F0DFC8] hover:bg-[#EAD5B5] transition cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#B08D5F] animate-ping opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8C6D45]" />
          </span>
          <span className="font-['JetBrains_Mono'] text-sm font-bold text-[#4A3B2C]">
            {isRunning ? formatTime(timeLeft) : formatRoomTime(roomElapsedSeconds)}
          </span>
          <span className="text-[11px] text-[#6E5D4C]">
            {isRunning ? (mode === 'work' ? 'Focusing' : 'Break') : 'Focus Room'}
          </span>
        </button>
      )}

      {/* --- Folder Drive Modal --- */}
      {activeFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="panel rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div className="flex items-center space-x-2.5 truncate">
                <Folder size={19} className="text-[var(--accent-amber)] shrink-0" />
                <div>
                  <h3 className="font-bold text-[var(--text)] truncate text-sm">{activeFolder.title}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{t('folderDriveFiles') || 'Manage files, PDFs, and resources for this subject'}</p>
                </div>
              </div>
              <button onClick={() => setActiveFolder(null)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-lg transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between border border-[var(--border)] p-3.5 rounded-lg">
                <div className="flex items-center space-x-2 text-xs text-[var(--text)]">
                  <FileText size={14} className="text-[var(--accent-amber)]" />
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
                  <div className="text-center py-8 text-[var(--text-faint)] text-xs">
                    {t('noFilesYet') || 'No files uploaded to this folder yet.'}
                  </div>
                ) : (
                  folderFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between border border-[var(--border)] hover:border-[var(--border-strong)] p-2.5 rounded-lg transition">
                      <div className="flex items-center space-x-2.5 truncate">
                        <FileText size={16} className="text-[var(--accent-amber)] shrink-0" />
                        <div className="truncate">
                          <p className="text-sm font-medium text-[var(--text)] truncate">{file.file_name}</p>
                          <span className="text-[10px] text-[var(--text-faint)]">{file.file_size}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-[var(--surface-2)] text-[var(--text)] rounded-md transition cursor-pointer">
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
            <h4 className="text-sm font-semibold text-[var(--text)] mb-1">{t('howFeeling') || 'How are you feeling?'}</h4>
            <p className="text-xs text-[var(--text-muted)] mb-4">{moodPickerDate}</p>
            <div className="grid grid-cols-3 gap-2.5">
              {MOOD_OPTIONS.map((m) => (
                <button key={m.emoji} onClick={() => setMoodForDate(moodPickerDate, m.emoji)} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-[var(--border)] hover:border-teal-400/40 transition cursor-pointer">
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-[9px] text-[var(--text-muted)] text-center">{m.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setMoodPickerDate(null)} className="w-full mt-4 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer">
              {t('cancel') || 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* --- Command Menu (Cmd/Ctrl+K) --- */}
      {commandOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm p-4" onClick={() => setCommandOpen(false)}>
          <div className="panel rounded-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--border)]">
              <Command size={15} className="text-[var(--text-muted)]" />
              <input
                ref={commandInputRef}
                type="text"
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder={t('commandPlaceholder') || 'Jump to...'}
                className="flex-1 bg-transparent text-sm text-[var(--text)] focus:outline-none placeholder:text-[var(--text-faint)]"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)] font-['JetBrains_Mono']">ESC</kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {commandResults.length === 0 ? (
                <p className="text-[var(--text-faint)] text-xs text-center py-6">{t('noResults') || 'No matches.'}</p>
              ) : (
                commandResults.map((tabItem) => {
                  const Icon = tabItem.icon;
                  return (
                    <button
                      key={tabItem.key}
                      onClick={() => { setActiveTab(tabItem.key); setCommandOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition cursor-pointer"
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

// The default export is gated: PlanGate checks the user's plan/trial status
// and only renders the actual dashboard (StudyDashboardInner) once access
// is confirmed. It also shows the plan picker and the trial countdown banner.
export default function StudyDashboard() {
  return (
    <PlanGate>
      <StudyDashboardInner />
    </PlanGate>
  );
}