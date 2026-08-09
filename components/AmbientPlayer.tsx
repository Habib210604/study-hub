'use client';
import { useState, useRef } from 'react';
import { Volume2, VolumeX, CloudRain, BookOpen } from 'lucide-react';

export default function AmbientPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundType, setSoundType] = useState('rain');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reliable, verified audio streams
  const sounds = {
    rain: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
    quran: 'https://server8.mp3quran.net/afs/001.mp3'
  };

  const handleSoundSwitch = (type: string) => {
    setSoundType(type);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(e => console.error("Playback failed:", e));
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mt-4 w-full flex items-center justify-between shadow-inner">
      <audio ref={audioRef} src={sounds[soundType as keyof typeof sounds]} loop />
      <div className="flex items-center gap-2">
        <button 
          onClick={() => handleSoundSwitch('rain')} 
          className={`p-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${soundType === 'rain' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
        >
          <CloudRain size={16}/> Rain
        </button>
        <button 
          onClick={() => handleSoundSwitch('quran')} 
          className={`p-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${soundType === 'quran' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
        >
          <BookOpen size={16}/> Quran
        </button>
      </div>
      <button 
        onClick={togglePlay} 
        className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center"
      >
        {isPlaying ? <VolumeX size={18}/> : <Volume2 size={18}/>}
      </button>
    </div>
  );
}