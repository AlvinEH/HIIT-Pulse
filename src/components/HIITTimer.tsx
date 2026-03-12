import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Settings as SettingsIcon, ChevronUp, ChevronDown, Music, SkipForward, SkipBack, Save, Trash2, List, Pencil, Volume2, VolumeX, Menu, X, Check, Star, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TimerSettings, TimerState, TimerPhase, SavedTimer } from '../types';
import { useAudio } from '../hooks/useAudio';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_SETTINGS: TimerSettings = {
  prepTime: 10,
  workTime: 30,
  restTime: 15,
  rounds: 4,
};

interface Track {
  file: File;
  url: string;
  name: string;
}

export default function HIITTimer() {
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<TimerState>({
    phase: 'prep',
    currentRound: 1,
    timeLeft: DEFAULT_SETTINGS.prepTime,
    isActive: false,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [timerName, setTimerName] = useState('');
  const [savedTimers, setSavedTimers] = useState<SavedTimer[]>([]);
  const [editingTimerId, setEditingTimerId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [soundType, setSoundType] = useState<'beep' | 'bell' | 'whistle' | 'digital'>(() => {
    return (localStorage.getItem('hiit-sound-type') as any) || 'beep';
  });
  const [soundVolume, setSoundVolume] = useState(() => {
    const saved = localStorage.getItem('hiit-sound-volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [musicVolume, setMusicVolume] = useState(() => {
    const saved = localStorage.getItem('hiit-music-volume');
    return saved !== null ? parseFloat(saved) : 0.3;
  });
  const [headerImage, setHeaderImage] = useState<string | null>(() => {
    return localStorage.getItem('hiit-header-image');
  });
  const { playPhaseTransition, playBeep } = useAudio();

  useEffect(() => {
    localStorage.setItem('hiit-sound-type', soundType);
  }, [soundType]);

  useEffect(() => {
    localStorage.setItem('hiit-sound-volume', soundVolume.toString());
  }, [soundVolume]);

  useEffect(() => {
    localStorage.setItem('hiit-music-volume', musicVolume.toString());
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  // Music State
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerImageInputRef = useRef<HTMLInputElement>(null);

  const isFirstLoad = useRef(true);

  const fetchTimers = async () => {
    try {
      const res = await fetch('/api/timers');
      if (res.ok) {
        const data: SavedTimer[] = await res.json();
        setSavedTimers(data);
        
        if (isFirstLoad.current) {
          const defaultTimer = data.find(t => t.isDefault === 1);
          if (defaultTimer) {
            setSettings({
              prepTime: defaultTimer.prepTime,
              workTime: defaultTimer.workTime,
              restTime: defaultTimer.restTime,
              rounds: defaultTimer.rounds,
            });
            setState(s => ({ ...s, timeLeft: defaultTimer.prepTime }));
          }
          isFirstLoad.current = false;
        }
      }
    } catch (error) {
      console.error('Failed to fetch timers:', error);
    }
  };

  useEffect(() => {
    fetchTimers();
  }, []);

  const saveTimer = async () => {
    if (!timerName.trim()) return;
    try {
      const res = await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, name: timerName }),
      });
      if (res.ok) {
        setTimerName('');
        fetchTimers();
      }
    } catch (error) {
      console.error('Failed to save timer:', error);
    }
  };

  const deleteTimer = async (id: number) => {
    try {
      const res = await fetch(`/api/timers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTimers();
      }
    } catch (error) {
      console.error('Failed to delete timer:', error);
    }
  };

  const renameTimer = async (id: number) => {
    if (!editingName.trim()) {
      setEditingTimerId(null);
      return;
    }
    try {
      const res = await fetch(`/api/timers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });
      if (res.ok) {
        setEditingTimerId(null);
        fetchTimers();
      }
    } catch (error) {
      console.error('Failed to rename timer:', error);
    }
  };

  const setDefaultTimer = async (id: number, isDefault: boolean) => {
    try {
      const res = await fetch(`/api/timers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: isDefault ? 1 : 0 }),
      });
      if (res.ok) {
        fetchTimers();
      }
    } catch (error) {
      console.error('Failed to set default timer:', error);
    }
  };

  const loadTimer = (timer: SavedTimer) => {
    setSettings({
      prepTime: timer.prepTime,
      workTime: timer.workTime,
      restTime: timer.restTime,
      rounds: timer.rounds,
    });
    setShowSaved(false);
    resetTimer();
  };

  const resetTimer = useCallback(() => {
    setState({
      phase: 'prep',
      currentRound: 1,
      timeLeft: settings.prepTime,
      isActive: false,
    });
    if (audioRef.current) {
      audioRef.current.pause();
      setIsMusicPlaying(false);
    }
  }, [settings.prepTime]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (state.isActive && state.timeLeft > 0) {
      interval = setInterval(() => {
        setState((prev) => {
          const nextTime = prev.timeLeft - 1;
          if (nextTime <= 3 && nextTime > 0) {
            playBeep(330, 0.05, soundVolume, soundType);
          }
          return { ...prev, timeLeft: nextTime };
        });
      }, 1000);
    } else if (state.isActive && state.timeLeft === 0) {
      handlePhaseTransition();
    }

    return () => clearInterval(interval);
  }, [state.isActive, state.timeLeft]);

  // Sync music with timer
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
    if (state.isActive && playlist.length > 0 && !isMusicPlaying) {
      audioRef.current?.play().catch(console.error);
      setIsMusicPlaying(true);
    } else if (!state.isActive && isMusicPlaying) {
      audioRef.current?.pause();
      setIsMusicPlaying(false);
    }
  }, [state.isActive, playlist.length, musicVolume]);

  const handlePhaseTransition = () => {
    setState((prev) => {
      let nextPhase: TimerPhase = prev.phase;
      let nextRound = prev.currentRound;
      let nextTime = 0;

      if (prev.phase === 'prep') {
        nextPhase = 'work';
        nextTime = settings.workTime;
        playPhaseTransition(false, soundVolume, soundType);
      } else if (prev.phase === 'work') {
        if (prev.currentRound >= settings.rounds) {
          nextPhase = 'finished';
          nextTime = 0;
          playPhaseTransition(true, soundVolume, soundType);
        } else {
          nextPhase = 'rest';
          nextTime = settings.restTime;
          playPhaseTransition(false, soundVolume, soundType);
        }
      } else if (prev.phase === 'rest') {
        nextPhase = 'work';
        nextRound = prev.currentRound + 1;
        nextTime = settings.workTime;
        playPhaseTransition(false, soundVolume, soundType);
      }

      return {
        ...prev,
        phase: nextPhase,
        currentRound: nextRound,
        timeLeft: nextTime,
        isActive: nextPhase !== 'finished',
      };
    });
  };

  const toggleTimer = () => {
    if (state.phase === 'finished') {
      resetTimer();
    } else {
      setState((prev) => ({ ...prev, isActive: !prev.isActive }));
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const audioFiles = files.filter(f => (f as File).type.startsWith('audio/')) as File[];
    
    const newTracks = audioFiles.map(file => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, "")
    }));

    setPlaylist(newTracks);
    setCurrentTrackIndex(0);
  };

  const nextTrack = () => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  };

  const prevTrack = () => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  };

  const handleHeaderImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setHeaderImage(base64String);
        localStorage.setItem('hiit-header-image', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeHeaderImage = () => {
    setHeaderImage(null);
    localStorage.removeItem('hiit-header-image');
  };

  const nextRound = () => {
    setState((prev) => {
      if (prev.phase === 'prep') {
        return { ...prev, phase: 'work', timeLeft: settings.workTime };
      }
      if (prev.currentRound < settings.rounds) {
        return {
          ...prev,
          currentRound: prev.currentRound + 1,
          phase: 'work',
          timeLeft: settings.workTime,
        };
      }
      if (prev.currentRound === settings.rounds && prev.phase !== 'finished') {
        return { ...prev, phase: 'finished', timeLeft: 0, isActive: false };
      }
      return prev;
    });
  };

  const prevRound = () => {
    setState((prev) => {
      if (prev.phase === 'finished') {
        return { ...prev, phase: 'work', currentRound: settings.rounds, timeLeft: settings.workTime, isActive: false };
      }
      if (prev.phase === 'rest') {
        return { ...prev, phase: 'work', timeLeft: settings.workTime };
      }
      if (prev.currentRound > 1) {
        return {
          ...prev,
          currentRound: prev.currentRound - 1,
          phase: 'work',
          timeLeft: settings.workTime,
        };
      }
      if (prev.currentRound === 1 && prev.phase === 'work') {
        return { ...prev, phase: 'prep', timeLeft: settings.prepTime };
      }
      return prev;
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseColor = (phase: TimerPhase) => {
    switch (phase) {
      case 'prep': return 'text-amber-400';
      case 'work': return 'text-emerald-400';
      case 'rest': return 'text-sky-400';
      case 'finished': return 'text-purple-400';
      default: return 'text-white';
    }
  };

  const getPhaseLabel = (phase: TimerPhase) => {
    switch (phase) {
      case 'prep': return 'PREPARE';
      case 'work': return 'WORK';
      case 'rest': return 'REST';
      case 'finished': return 'FINISHED';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-emerald-500/30 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Hidden Audio Element */}
      {playlist.length > 0 && (
        <audio 
          ref={audioRef}
          src={playlist[currentTrackIndex].url}
          onEnded={nextTrack}
          onPlay={() => setIsMusicPlaying(true)}
          onPause={() => setIsMusicPlaying(false)}
        />
      )}

      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFolderSelect} 
        multiple 
        accept="audio/*" 
        className="hidden" 
      />

      <input 
        type="file" 
        ref={headerImageInputRef} 
        onChange={handleHeaderImageUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Sidebar / Hamburger Menu */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-zinc-900 border-r border-zinc-800 z-[70] p-8 flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Sidebar Header Background Image */}
              {headerImage && (
                <div className="absolute top-0 left-0 right-0 h-32 z-0 pointer-events-none overflow-hidden">
                  <img 
                    src={headerImage} 
                    alt="Sidebar Header Background" 
                    className="w-full h-full object-cover opacity-40 blur-[1px]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900" />
                </div>
              )}

              <div className="flex justify-between items-center mb-12 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">HIIT PULSE</span>
                </div>
                <button onClick={() => setShowSidebar(false)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <nav className="space-y-2 relative z-10">
                <SidebarButton 
                  icon={<List size={20} />} 
                  label="Saved Workouts" 
                  onClick={() => { setShowSaved(true); setShowSidebar(false); }} 
                />
                <SidebarButton 
                  icon={<SettingsIcon size={20} />} 
                  label="Timer Settings" 
                  onClick={() => { setShowSettings(true); setShowSidebar(false); }} 
                />
                <SidebarButton 
                  icon={<Volume2 size={20} />} 
                  label="Audio Settings" 
                  onClick={() => { setShowAudioSettings(true); setShowSidebar(false); }} 
                />
                <SidebarButton 
                  icon={<Music size={20} className={playlist.length > 0 ? "text-emerald-400" : ""} />} 
                  label="Music Library" 
                  onClick={() => { fileInputRef.current?.click(); setShowSidebar(false); }} 
                />
                <SidebarButton 
                  icon={<ImageIcon size={20} className={headerImage ? "text-emerald-400" : ""} />} 
                  label={headerImage ? "Change Header Image" : "Upload Header Image"} 
                  onClick={() => { headerImageInputRef.current?.click(); setShowSidebar(false); }} 
                />
                {headerImage && (
                  <SidebarButton 
                    icon={<Trash2 size={20} className="text-red-400" />} 
                    label="Remove Header Image" 
                    onClick={() => { removeHeaderImage(); setShowSidebar(false); }} 
                  />
                )}
              </nav>

              <div className="mt-auto pt-8 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                  Ready for your next session?
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-from-left trigger area */}
      <div 
        className="fixed top-0 left-0 bottom-0 w-4 z-[55] cursor-e-resize"
        onMouseEnter={() => !showSidebar && setShowSidebar(true)}
      />

      {/* Header */}
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setShowSidebar(true)}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
            title="Open Menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      <div className="relative w-full max-w-md aspect-square flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.phase}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="flex flex-col items-center"
          >
            <span className={cn("text-xs font-mono tracking-[0.3em] mb-2", getPhaseColor(state.phase))}>
              {getPhaseLabel(state.phase)}
            </span>
            <span className="text-[120px] font-light leading-none tracking-tighter tabular-nums">
              {state.phase === 'finished' ? 'DONE' : formatTime(state.timeLeft)}
            </span>
            {state.phase !== 'finished' && (
              <span className="text-zinc-500 text-sm mt-4 tracking-widest uppercase">
                Round {state.currentRound} / {settings.rounds}
              </span>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Progress Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
          <circle
            cx="50%"
            cy="50%"
            r="48%"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-zinc-900"
          />
          {state.phase !== 'finished' && (
            <motion.circle
              cx="50%"
              cy="50%"
              r="48%"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="100 100"
              initial={{ strokeDashoffset: 100 }}
              animate={{ 
                strokeDashoffset: 100 - (state.timeLeft / (
                  state.phase === 'prep' ? settings.prepTime : 
                  state.phase === 'work' ? settings.workTime : 
                  settings.restTime
                )) * 100 
              }}
              className={cn("transition-all duration-1000 ease-linear", getPhaseColor(state.phase))}
            />
          )}
        </svg>
      </div>

      {/* Music Info Bar */}
      <AnimatePresence>
        {playlist.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-4 text-zinc-400">
              <button onClick={prevTrack} className="hover:text-white transition-colors"><SkipBack size={20} /></button>
              <div className="flex flex-col items-center w-48 overflow-hidden">
                <span className="text-xs font-medium text-emerald-400 uppercase tracking-widest truncate w-full text-center">
                  {playlist[currentTrackIndex].name}
                </span>
              </div>
              <button onClick={nextTrack} className="hover:text-white transition-colors"><SkipForward size={20} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="mt-12 flex flex-col items-center gap-6">
        <div className="flex items-center gap-12">
          <button 
            onClick={prevRound}
            disabled={state.currentRound === 1 && state.phase === 'prep'}
            className="p-2 transition-colors text-zinc-500 hover:text-white disabled:opacity-10 disabled:cursor-not-allowed"
            title="Previous Round"
          >
            <SkipBack size={28} />
          </button>

          <button 
            onClick={toggleTimer}
            className={cn(
              "w-24 h-24 flex items-center justify-center transition-all transform active:scale-95 rounded-full border-2 border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500",
              state.isActive && "bg-emerald-500/20 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            )}
          >
            {state.isActive ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-2" />}
          </button>

          <button 
            onClick={nextRound}
            disabled={state.phase === 'finished'}
            className="p-2 transition-colors text-zinc-500 hover:text-white disabled:opacity-10 disabled:cursor-not-allowed"
            title="Next Round"
          >
            <SkipForward size={28} />
          </button>
        </div>
      </div>

      {/* Reset Button - Positioned at bottom */}
      <button 
        onClick={resetTimer}
        className="fixed bottom-[25px] left-1/2 -translate-x-1/2 p-2 transition-colors text-zinc-600 hover:text-white z-50"
        title="Reset Timer"
      >
        <RotateCcw size={20} />
      </button>

      {/* Timer Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => setShowSettings(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-[10px] bg-black/80 backdrop-blur-sm"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-[22px] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-medium">Timer Settings</h2>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="text-zinc-500 hover:text-white transition-colors p-1"
                  aria-label="Close settings"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-[1fr_40px_48px_40px] gap-y-2 gap-x-0 items-center">
                <SettingRow 
                  label="Prepare" 
                  value={settings.prepTime} 
                  onChange={(v) => setSettings(s => ({...s, prepTime: v}))} 
                  unit="s"
                />
                <SettingRow 
                  label="Work" 
                  value={settings.workTime} 
                  onChange={(v) => setSettings(s => ({...s, workTime: v}))} 
                  unit="s"
                />
                <SettingRow 
                  label="Rest" 
                  value={settings.restTime} 
                  onChange={(v) => setSettings(s => ({...s, restTime: v}))} 
                  unit="s"
                />
                <SettingRow 
                  label="Rounds" 
                  value={settings.rounds} 
                  onChange={(v) => setSettings(s => ({...s, rounds: v}))} 
                />
              </div>

              <div className="mt-8 pt-8 border-t border-zinc-800">
                <div className="flex gap-2 w-full">
                  <input 
                    type="text" 
                    placeholder="Timer Name" 
                    value={timerName}
                    onChange={(e) => setTimerName(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <button 
                    onClick={saveTimer}
                    disabled={!timerName.trim()}
                    className="p-2 rounded-xl bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors"
                  >
                    <Save size={20} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Settings Modal */}
      <AnimatePresence>
        {showAudioSettings && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => setShowAudioSettings(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-[10px] bg-black/80 backdrop-blur-sm"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-[22px] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-medium">Audio Settings</h2>
                <button 
                  onClick={() => setShowAudioSettings(false)} 
                  className="text-zinc-500 hover:text-white transition-colors p-1"
                  aria-label="Close audio settings"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Sound Type</span>
                  <select 
                    value={soundType}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setSoundType(newType);
                      playPhaseTransition(false, soundVolume, newType);
                    }}
                    className="bg-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none border border-zinc-700"
                  >
                    <option value="beep">Beep</option>
                    <option value="bell">Bell</option>
                    <option value="whistle">Whistle</option>
                    <option value="digital">Digital</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Timer Volume</span>
                    <span className="text-zinc-500 text-sm">{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <VolumeX size={16} className="text-zinc-600" />
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={soundVolume}
                      onChange={(e) => {
                        const newVolume = parseFloat(e.target.value);
                        setSoundVolume(newVolume);
                      }}
                      onMouseUp={() => playPhaseTransition(false, soundVolume, soundType)}
                      onTouchEnd={() => playPhaseTransition(false, soundVolume, soundType)}
                      className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <Volume2 size={16} className="text-zinc-600" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Music Volume</span>
                    <span className="text-zinc-500 text-sm">{Math.round(musicVolume * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <VolumeX size={16} className="text-zinc-600" />
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={musicVolume}
                      onChange={(e) => {
                        const newVolume = parseFloat(e.target.value);
                        setMusicVolume(newVolume);
                      }}
                      className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <Volume2 size={16} className="text-zinc-600" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Timers Modal */}
      <AnimatePresence>
        {showSaved && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => setShowSaved(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-[10px] bg-black/80 backdrop-blur-sm"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-[22px] shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-medium">Saved Timers</h2>
                <button 
                  onClick={() => setShowSaved(false)} 
                  className="text-zinc-500 hover:text-white transition-colors p-1"
                  aria-label="Close saved timers"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {savedTimers.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    <p>No saved timers yet.</p>
                  </div>
                ) : (
                  savedTimers.map((timer) => (
                    <div 
                      key={timer.id}
                      className="group relative rounded-2xl bg-zinc-800/50 border border-zinc-800 hover:border-zinc-700 transition-all overflow-hidden"
                    >
                      {editingTimerId === timer.id ? (
                        <div className="w-full pl-2 pr-4 py-3 flex gap-2 items-center">
                          <input
                            autoFocus
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameTimer(timer.id);
                              if (e.key === 'Escape') setEditingTimerId(null);
                            }}
                            onBlur={(e) => {
                              // Only save on blur if we didn't click the checkmark button
                              if (e.relatedTarget && (e.relatedTarget as HTMLElement).id === `save-name-${timer.id}`) return;
                              renameTimer(timer.id);
                            }}
                            className="flex-1 bg-transparent border-none px-2 py-1 text-sm focus:outline-none min-w-0 font-medium text-zinc-200"
                          />
                          <button
                            id={`save-name-${timer.id}`}
                            onClick={() => renameTimer(timer.id)}
                            className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors flex-shrink-0"
                            title="Save name"
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative p-4">
                          <button 
                            onClick={() => loadTimer(timer)}
                            className="absolute inset-0 z-0 w-full h-full text-left"
                            aria-label={`Load ${timer.name}`}
                          />
                          <div className="relative z-10 pointer-events-none">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h3 className="font-medium text-zinc-200">{timer.name}</h3>
                              {Number(timer.isDefault) === 1 && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded-md">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex justify-between items-center">
                              <div className="text-xs text-zinc-500 space-y-0.5 font-medium">
                                <div>{timer.rounds} Rounds</div>
                                <div>{timer.workTime}s Work</div>
                                <div>{timer.restTime}s Rest</div>
                              </div>
                              <div className="flex items-center gap-0.5 pointer-events-auto">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDefaultTimer(timer.id, Number(timer.isDefault) !== 1);
                                  }}
                                  className={cn(
                                    "p-2 transition-all rounded-lg",
                                    Number(timer.isDefault) === 1 
                                      ? "text-amber-400" 
                                      : "text-zinc-500 hover:text-amber-400 opacity-40 group-hover:opacity-100"
                                  )}
                                  title={Number(timer.isDefault) === 1 ? "Remove as default" : "Set as default"}
                                >
                                  <Star size={16} fill={Number(timer.isDefault) === 1 ? "currentColor" : "none"} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTimerId(timer.id);
                                    setEditingName(timer.name);
                                  }}
                                  className="p-2 text-zinc-500 hover:text-emerald-400 opacity-40 group-hover:opacity-100 transition-all rounded-lg"
                                  title="Rename timer"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTimer(timer.id);
                                  }}
                                  className="p-2 text-zinc-500 hover:text-red-400 opacity-40 group-hover:opacity-100 transition-all rounded-lg"
                                  title="Delete timer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Atmosphere */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 transition-colors duration-1000",
          state.phase === 'work' ? "bg-emerald-500" : 
          state.phase === 'rest' ? "bg-sky-500" : 
          state.phase === 'prep' ? "bg-amber-500" : "bg-purple-500"
        )} />
      </div>
    </div>
  );
}

interface SidebarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function SidebarButton({ icon, label, onClick }: SidebarButtonProps) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all group"
    >
      <span className="group-hover:scale-110 transition-transform duration-300">
        {icon}
      </span>
      <span className="text-sm font-medium tracking-wide">{label}</span>
    </button>
  );
}

function SettingRow({ label, value, onChange, unit = '' }: { label: string, value: number, onChange: (v: number) => void, unit?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    const num = parseInt(inputValue);
    if (!isNaN(num) && num > 0) {
      onChange(num);
    } else {
      setInputValue(value.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <>
      <span className="text-zinc-400 font-medium pr-10">{label}</span>
      
      <div className="">
        <button 
          onClick={() => onChange(Math.max(1, value - 1))}
          className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronDown size={18} />
        </button>
      </div>
      
      <div className="flex items-center justify-center">
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-zinc-800 border border-emerald-500/50 rounded text-center font-mono text-lg focus:outline-none"
          />
        ) : (
          <button 
            onClick={() => setIsEditing(true)}
            className="w-full text-center font-mono text-lg hover:text-emerald-400 transition-colors cursor-text"
          >
            {value}{unit}
          </button>
        )}
      </div>

      <button 
        onClick={() => onChange(value + 1)}
        className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
      >
        <ChevronUp size={18} />
      </button>
    </>
  );
}
