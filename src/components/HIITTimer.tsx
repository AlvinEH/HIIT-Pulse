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
    timeLeft: DEFAULT_SETTINGS.prepTime * 1000,
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
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [musicVolume, setMusicVolume] = useState(() => {
    const saved = localStorage.getItem('hiit-music-volume');
    return saved !== null ? parseFloat(saved) : 0.5;
  });
  const [headerImage, setHeaderImage] = useState<string | null>(() => {
    return localStorage.getItem('hiit-header-image');
  });
  const { playPhaseTransition, playBeep } = useAudio();

  const displayRound = state.phase === 'prep' ? 0 : state.currentRound;

  // Music State
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [pendingMusicFiles, setPendingMusicFiles] = useState<Track[] | null>(null);
  const [showMusicConfirm, setShowMusicConfirm] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerImageInputRef = useRef<HTMLInputElement>(null);

  const isFirstLoad = useRef(true);

  // Track whether we've played the halfway sound for the current work phase
  const halfwayPlayedRef = useRef(false);

  // localStorage helpers for timer persistence
  const getStoredTimers = (): SavedTimer[] => {
    try {
      const stored = localStorage.getItem('hiit-saved-timers');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };
  
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

  // Apply volume to audio element when it's created or tracks change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
  }, [playlist]);

  const saveTimersToStorage = (timers: SavedTimer[]) => {
    try {
      localStorage.setItem('hiit-saved-timers', JSON.stringify(timers));
    } catch (error) {
      console.error('Failed to save timers to storage:', error);
    }
  };

  const fetchTimers = () => {
    const data = getStoredTimers();
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
        setState(s => ({ ...s, timeLeft: defaultTimer.prepTime * 1000 }));
      }
      isFirstLoad.current = false;
    }
  };

  useEffect(() => {
    fetchTimers();
  }, []);

  const saveTimer = () => {
    if (!timerName.trim()) return;
    const timers = getStoredTimers();
    const newTimer: SavedTimer = {
      id: Date.now(),
      name: timerName,
      prepTime: settings.prepTime,
      workTime: settings.workTime,
      restTime: settings.restTime,
      rounds: settings.rounds,
      isDefault: 0,
      createdAt: new Date().toISOString(),
    };
    timers.push(newTimer);
    saveTimersToStorage(timers);
    setTimerName('');
    fetchTimers();
  };

  const deleteTimer = (id: number) => {
    const timers = getStoredTimers();
    const filtered = timers.filter(t => t.id !== id);
    saveTimersToStorage(filtered);
    fetchTimers();
  };

  const renameTimer = (id: number) => {
    if (!editingName.trim()) {
      setEditingTimerId(null);
      return;
    }
    const timers = getStoredTimers();
    const updated = timers.map(t => t.id === id ? { ...t, name: editingName } : t);
    saveTimersToStorage(updated);
    setEditingTimerId(null);
    fetchTimers();
  };

  const setDefaultTimer = (id: number, isDefault: boolean) => {
    const timers = getStoredTimers();
    const updated = timers.map(t => ({
      ...t,
      isDefault: t.id === id && isDefault ? 1 : 0,
    }));
    saveTimersToStorage(updated);
    fetchTimers();
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
      timeLeft: settings.prepTime * 1000,
      isActive: false,
    });
    if (audioRef.current) {
      audioRef.current.pause();
      setIsMusicPlaying(false);
    }
  }, [settings.prepTime]);

  // close settings and reset timer
  const closeSettings = () => {
    setShowSettings(false);
    resetTimer();
  };

  // Play/pause music with timer
  useEffect(() => {
    if (!audioRef.current) return;

    if (state.isActive && playlist.length > 0) {
      audioRef.current.play().catch(err => console.log('Could not play audio:', err));
    } else {
      audioRef.current.pause();
    }
  }, [state.isActive, playlist.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (state.isActive && state.timeLeft > 0) {
      let lastTick = Date.now();
      interval = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTick;
        lastTick = now;

        setState((prev) => {
          const nextTime = Math.max(0, prev.timeLeft - delta);
          
          // If we're in a Work phase, fire a halfway sound once when hitting the half point
          if (prev.phase === 'work') {
            const halfPointMs = (settings.workTime * 1000) / 2;
            if (prev.timeLeft > halfPointMs && nextTime <= halfPointMs && !halfwayPlayedRef.current) {
              playBeep(880, 0.08, soundVolume, soundType);
              halfwayPlayedRef.current = true;
            }
          }
          
          const prevSec = Math.ceil(prev.timeLeft / 1000);
          const nextSec = Math.ceil(nextTime / 1000);
          
          if (prevSec !== nextSec && nextSec <= 3 && nextSec > 0) {
            playBeep(330, 0.05, soundVolume, soundType);
          }
          return { ...prev, timeLeft: nextTime };
        });
      }, 16); // ~60fps
    } else if (state.isActive && state.timeLeft <= 0) {
      handlePhaseTransition();
    }

    return () => clearInterval(interval);
  }, [state.isActive, state.timeLeft <= 0, settings.workTime, soundVolume, soundType]);
  
  // Reset halfway flag whenever the phase, round or work duration changes
  useEffect(() => {
    halfwayPlayedRef.current = false;
  }, [state.phase, state.currentRound, settings.workTime]);

  const handlePhaseTransition = () => {
    setState((prev) => {
      let nextPhase: TimerPhase = prev.phase;
      let nextRound = prev.currentRound;
      let nextTime = 0;

      if (prev.phase === 'prep') {
        nextPhase = 'work';
        nextTime = settings.workTime * 1000;
        playPhaseTransition(false, soundVolume, soundType);
      } else if (prev.phase === 'work') {
        if (prev.currentRound >= settings.rounds) {
          nextPhase = 'finished';
          nextTime = 0;
          // play three short beeps on workout completion
          playTripleBeep();
        } else {
          nextPhase = 'rest';
          nextTime = settings.restTime * 1000;
          playPhaseTransition(false, soundVolume, soundType);
        }
      } else if (prev.phase === 'rest') {
        nextPhase = 'work';
        nextRound = prev.currentRound + 1;
        nextTime = settings.workTime * 1000;
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

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const confirmMusicSelection = () => {
    if (pendingMusicFiles && pendingMusicFiles.length > 0) {
      setPlaylist(pendingMusicFiles);
      setCurrentTrackIndex(0);
      setPendingMusicFiles(null);
      setShowMusicConfirm(false);
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Filter for audio files and include the full path for sorting
    const audioFiles = files.filter(f => {
      const type = (f as File).type;
      return type.startsWith('audio/') ||
             /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name);
    }) as File[];

    if (audioFiles.length === 0) {
      alert('No audio files found in the selected folder.');
      return;
    }

    // Sort by full path to preserve directory structure
    audioFiles.sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath));

    const newTracks = audioFiles.map(file => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, "")
    }));

    // Show confirmation modal on both desktop and mobile
    setPendingMusicFiles(newTracks);
    setShowMusicConfirm(true);
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
        return { ...prev, phase: 'work', timeLeft: settings.workTime * 1000 };
      }
      if (prev.currentRound < settings.rounds) {
        return {
          ...prev,
          currentRound: prev.currentRound + 1,
          phase: 'work',
          timeLeft: settings.workTime * 1000,
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
        return { ...prev, phase: 'work', currentRound: settings.rounds, timeLeft: settings.workTime * 1000, isActive: false };
      }
      if (prev.phase === 'rest') {
        return { ...prev, phase: 'work', timeLeft: settings.workTime * 1000 };
      }
      if (prev.currentRound > 1) {
        return {
          ...prev,
          currentRound: prev.currentRound - 1,
          phase: 'work',
          timeLeft: settings.workTime * 1000,
        };
      }
      if (prev.currentRound === 1 && prev.phase === 'work') {
        return { ...prev, phase: 'prep', timeLeft: settings.prepTime * 1000 };
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
      case 'prep': return 'text-red-400';
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

  const playTripleBeep = (count = 3, intervalMs = 100) => {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        playBeep(880, 0.08, soundVolume, soundType);
      }, i * intervalMs);
    }
  };

  // total progress calculation (prep + all rounds; last round has no rest)
  const totalDuration = settings.prepTime + settings.rounds * settings.workTime + Math.max(0, settings.rounds - 1) * settings.restTime;
  const totalElapsed = (() => {
    const timeLeftSec = state.timeLeft / 1000;
    if (state.phase === 'prep') {
      return Math.max(0, settings.prepTime - timeLeftSec);
    }
    if (state.phase === 'work') {
      return settings.prepTime + (state.currentRound - 1) * (settings.workTime + settings.restTime) + Math.max(0, settings.workTime - timeLeftSec);
    }
    if (state.phase === 'rest') {
      return settings.prepTime + (state.currentRound - 1) * (settings.workTime + settings.restTime) + settings.workTime + Math.max(0, settings.restTime - timeLeftSec);
    }
    if (state.phase === 'finished') {
      return totalDuration;
    }
    return 0;
  })();
  const totalProgress = Math.max(0, Math.min(1, totalElapsed / Math.max(1, totalDuration)));

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
        webkitdirectory=""
        mozdirectory=""
        multiple
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
              className="fixed top-0 left-0 bottom-0 w-65 bg-zinc-900 border-r border-zinc-800 z-[70] p-8 flex flex-col shadow-2xl overflow-hidden"
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

              <div className="flex justify-between items-center mb-2">
                <div className="flex flex-col">
                  <span className="text-[12px] uppercase tracking-[0.2em] text-zinc-500 font-mono">HIIT PULSE</span>
                </div>
                <button onClick={() => setShowSidebar(false)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <nav className="relative z-20">
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
            {state.phase === 'finished' ? (
              <div className="w-[80%] flex items-center justify-center">
                <svg viewBox="0 0 100 35" className="w-full h-auto">
                  <text
                    x="50%"
                    y="50%"
                    dominantBaseline="central"
                    textAnchor="middle"
                    className="fill-current font-light tracking-tighter"
                    style={{ fontSize: '32px' }}
                  >
                    DONE
                  </text>
                </svg>
              </div>
            ) : (
              <span className="text-[110px] font-light leading-none tracking-tighter tabular-nums">
                {formatTime(Math.ceil(state.timeLeft / 1000))}
              </span>
            )}
            {state.phase !== 'finished' && (
              <span className="text-zinc-500 text-sm mt-4 tracking-widest uppercase">
                Round {displayRound} / {settings.rounds}
              </span>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Progress Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
          {/* outer background */}
          <circle
            cx="50%"
            cy="50%"
            r="48%"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-zinc-900"
          />
          
          {/* outer phase progress */}
          {state.phase !== 'finished' && (
            <motion.circle
              cx="50%"
              cy="50%"
              r="48%"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeDasharray="100 100"
              pathLength="100"
              animate={{ 
                strokeDashoffset: 100 - (state.timeLeft / (
                  (state.phase === 'prep' ? settings.prepTime : 
                  state.phase === 'work' ? settings.workTime : 
                  settings.restTime) * 1000
                )) * 100 
              }}
              transition={{ duration: state.isActive ? 0.05 : 0, ease: "linear" }}
              className={cn(getPhaseColor(state.phase))}
            />
          )}
          
          {/* inner background (total progress) */}
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-zinc-900/50"
          />
          
          {/* inner total-progress ring (just inside the existing progress bar) */}
          <motion.circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray="100 100"
            pathLength="100"
            animate={{ strokeDashoffset: 100 - totalProgress * 100 }}
            transition={{ duration: state.isActive ? 0.05 : 0, ease: "linear" }}
            className="text-purple-400/80"
          />
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
            disabled={state.phase === 'prep' || state.phase === 'finished'}
            className="p-2 transition-colors text-zinc-500 hover:text-white disabled:opacity-10 disabled:cursor-not-allowed"
            title="Previous Round"
          >
            <SkipBack size={28} />
          </button>

          {state.phase === 'finished' ? (
            <button
              onClick={resetTimer}
              title="Reset"
              className={cn(
                "w-24 h-24 flex items-center justify-center transition-all transform active:scale-95 rounded-full border-2 border-purple-500/20 bg-purple-500/6 text-purple-400",
              )}
            >
              <RotateCcw size={36} />
            </button>
          ) : (
            <button 
              onClick={toggleTimer}
              className={cn(
                "w-24 h-24 flex items-center justify-center transition-all transform active:scale-95 rounded-full border-2 border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500",
                getPhaseColor(state.phase)
              )}
             title="Pause Timer"
            >
              {state.isActive ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-2" />}
            </button>
          )}
 
           <button 
             onClick={nextRound}
             disabled={!['prep', 'work', 'rest'].includes(state.phase)}
             className="p-2 transition-colors text-zinc-500 hover:text-white disabled:opacity-10 disabled:cursor-not-allowed"
             title="Next Round"
           >
             <SkipForward size={28} />
           </button>
         </div>
      </div>

      {/* Reset Button - Positioned at bottom */}
      {state.phase !== 'finished' && (
        <button 
          onClick={resetTimer}
          className="fixed bottom-[25px] left-1/2 -translate-x-1/2 p-2 transition-colors text-zinc-600 hover:text-white z-50"
          title="Reset Timer"
        >
          <RotateCcw size={20} />
        </button>
      )}

      {/* Timer Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={closeSettings}
            className="fixed inset-0 z-50 flex items-center justify-center p-[10px] bg-black/80 backdrop-blur-sm"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-[22px] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-medium">Timer Settings</h2>
                <button 
                  onClick={closeSettings} 
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
                    autoCapitalize="words"
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
                    <option value="chime">Chime</option>
                    <option value="ding">Ding</option>
                    <option value="ping">Ping</option>
                    <option value="laser">Laser</option>
                    <option value="power-up">Power Up</option>
                    <option value="notification">Notification</option>
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

      {/* Music Confirmation Modal (Mobile) */}
      <AnimatePresence>
        {showMusicConfirm && pendingMusicFiles && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => { setShowMusicConfirm(false); setPendingMusicFiles(null); }}
            className="fixed inset-0 z-50 flex items-center justify-center p-[10px] bg-black/80 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-[22px] shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-medium">Select This Folder</h2>
                <button
                  onClick={() => { setShowMusicConfirm(false); setPendingMusicFiles(null); }}
                  className="text-zinc-500 hover:text-white transition-colors p-1"
                  aria-label="Close confirmation"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 custom-scrollbar">
                <p className="text-zinc-400 text-sm mb-4">
                  Found {pendingMusicFiles.length} song{pendingMusicFiles.length !== 1 ? 's' : ''} in this folder:
                </p>
                {pendingMusicFiles.map((track, index) => (
                  <div key={index} className="text-sm text-zinc-300 p-2 rounded bg-zinc-800/50">
                    {track.name}
                  </div>
                ))}
              </div>

              <button
                onClick={confirmMusicSelection}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
              >
                Select This Folder
              </button>
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
      className="w-full flex items-center gap-4 py-4 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all group"
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
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
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
