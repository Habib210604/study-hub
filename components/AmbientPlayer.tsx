'use client';
import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, CloudRain, BookOpen, SkipBack, SkipForward } from 'lucide-react';

const SURAH_NAMES = [
  'Al-Fatihah','Al-Baqarah','Aal-Imran','An-Nisa','Al-Maidah','Al-Anam','Al-Araf','Al-Anfal','At-Tawbah','Yunus',
  'Hud','Yusuf','Ar-Rad','Ibrahim','Al-Hijr','An-Nahl','Al-Isra','Al-Kahf','Maryam','Ta-Ha',
  'Al-Anbiya','Al-Hajj','Al-Muminun','An-Nur','Al-Furqan','Ash-Shuara','An-Naml','Al-Qasas','Al-Ankabut','Ar-Rum',
  'Luqman','As-Sajdah','Al-Ahzab','Saba','Fatir','Ya-Sin','As-Saffat','Sad','Az-Zumar','Ghafir',
  'Fussilat','Ash-Shura','Az-Zukhruf','Ad-Dukhan','Al-Jathiyah','Al-Ahqaf','Muhammad','Al-Fath','Al-Hujurat','Qaf',
  'Adh-Dhariyat','At-Tur','An-Najm','Al-Qamar','Ar-Rahman','Al-Waqiah','Al-Hadid','Al-Mujadila','Al-Hashr','Al-Mumtahanah',
  'As-Saff','Al-Jumuah','Al-Munafiqun','At-Taghabun','At-Talaq','At-Tahrim','Al-Mulk','Al-Qalam','Al-Haqqah','Al-Maarij',
  'Nuh','Al-Jinn','Al-Muzzammil','Al-Muddaththir','Al-Qiyamah','Al-Insan','Al-Mursalat','An-Naba','An-Naziat','Abasa',
  'At-Takwir','Al-Infitar','Al-Mutaffifin','Al-Inshiqaq','Al-Buruj','At-Tariq','Al-Ala','Al-Ghashiyah','Al-Fajr','Al-Balad',
  'Ash-Shams','Al-Layl','Ad-Duha','Ash-Sharh','At-Tin','Al-Alaq','Al-Qadr','Al-Bayyinah','Az-Zalzalah','Al-Adiyat',
  'Al-Qariah','At-Takathur','Al-Asr','Al-Humazah','Al-Fil','Quraysh','Al-Maun','Al-Kawthar','Al-Kafirun','An-Nasr',
  'Al-Masad','Al-Ikhlas','Al-Falaq','An-Nas'
];

const getSurahUrl = (index: number) => {
  const num = String(index + 1).padStart(3, '0');
  return `https://server8.mp3quran.net/afs/${num}.mp3`;
};

const RAIN_URL = 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg';

export default function AmbientPlayer({ visible = true }: { visible?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundType, setSoundType] = useState<'rain' | 'quran'>('rain');
  const [surahIndex, setSurahIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasRestoredRef = useRef(false);

  // --- Restore saved state on first mount (sound type, which surah, and time position) ---
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const savedType = localStorage.getItem('ambient_sound_type') as 'rain' | 'quran' | null;
    const savedSurah = localStorage.getItem('ambient_surah_index');
    if (savedType) setSoundType(savedType);
    if (savedSurah) setSurahIndex(Math.min(113, Math.max(0, parseInt(savedSurah, 10) || 0)));
  }, []);

  // --- Whenever the active source changes (sound type or surah), load the right file and seek to saved position ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const src = soundType === 'quran' ? getSurahUrl(surahIndex) : RAIN_URL;
    const wasPlaying = isPlaying;

    audio.src = src;
    audio.loop = soundType === 'rain'; // Quran advances to the next surah instead of looping the same one

    const savedTime = soundType === 'quran' ? parseFloat(localStorage.getItem('ambient_playback_time') || '0') : 0;

    const onLoaded = () => {
      if (savedTime > 0 && savedTime < audio.duration) {
        audio.currentTime = savedTime;
      }
      if (wasPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      }
    };

    audio.addEventListener('loadedmetadata', onLoaded, { once: true });
    audio.load();

    return () => audio.removeEventListener('loadedmetadata', onLoaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundType, surahIndex]);

  // --- Persist current position periodically so "resume" actually works ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const savePosition = () => {
      if (soundType === 'quran') {
        localStorage.setItem('ambient_playback_time', String(audio.currentTime));
      }
    };
    const interval = setInterval(savePosition, 3000);
    audio.addEventListener('pause', savePosition);

    return () => {
      clearInterval(interval);
      audio.removeEventListener('pause', savePosition);
    };
  }, [soundType]);

  // --- Auto-advance to the next surah when one finishes ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (soundType !== 'quran') return;
      const next = (surahIndex + 1) % SURAH_NAMES.length;
      localStorage.setItem('ambient_playback_time', '0');
      setSurahIndex(next);
      localStorage.setItem('ambient_surah_index', String(next));
    };

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [soundType, surahIndex]);

  // --- Media Session: lock-screen / notification controls, and the best available chance of continued background playback ---
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: soundType === 'quran' ? `Surah ${SURAH_NAMES[surahIndex]}` : 'Rain Sounds',
      artist: soundType === 'quran' ? 'Mishary Alafasy' : 'Ambient',
      album: 'StudySpace Focus Sounds',
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    if (soundType === 'quran') {
      navigator.mediaSession.setActionHandler('nexttrack', () => changeSurah(1));
      navigator.mediaSession.setActionHandler('previoustrack', () => changeSurah(-1));
    } else {
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundType, surahIndex, isPlaying]);

  const handleSoundSwitch = (type: 'rain' | 'quran') => {
    setSoundType(type);
    localStorage.setItem('ambient_sound_type', type);
    setIsPlaying(false);
  };

  const changeSurah = (direction: 1 | -1) => {
    const next = (surahIndex + direction + SURAH_NAMES.length) % SURAH_NAMES.length;
    localStorage.setItem('ambient_playback_time', '0');
    setSurahIndex(next);
    localStorage.setItem('ambient_surah_index', String(next));
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.error('Playback failed:', e));
    }
  };

  return (
    <div className={visible ? 'w-full' : 'hidden'}>
      <audio ref={audioRef} />
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mt-4 w-full flex flex-col gap-3 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSoundSwitch('rain')}
              className={`p-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${soundType === 'rain' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            >
              <CloudRain size={16} /> Rain
            </button>
            <button
              onClick={() => handleSoundSwitch('quran')}
              className={`p-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${soundType === 'quran' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            >
              <BookOpen size={16} /> Quran
            </button>
          </div>
          <button
            onClick={togglePlay}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center"
          >
            {isPlaying ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {soundType === 'quran' && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
            <button onClick={() => changeSurah(-1)} className="p-1.5 text-slate-400 hover:text-white transition cursor-pointer">
              <SkipBack size={15} />
            </button>
            <span className="text-xs text-slate-300 font-medium truncate">
              {surahIndex + 1}. {SURAH_NAMES[surahIndex]}
            </span>
            <button onClick={() => changeSurah(1)} className="p-1.5 text-slate-400 hover:text-white transition cursor-pointer">
              <SkipForward size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}