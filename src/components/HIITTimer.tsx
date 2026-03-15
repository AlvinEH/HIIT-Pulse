import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Settings as SettingsIcon, ChevronUp, ChevronDown, Music, SkipForward, SkipBack, Save, Trash2, List, Pencil, Volume2, VolumeX, Menu, X, Check, Star, Image as ImageIcon, Sun, Moon, Crop } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/imageUtils';
import { TimerSettings, TimerState, TimerPhase, SavedTimer, SoundType } from '../types';
import { useAudio } from '../hooks/useAudio';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  sourceColorFromImage, 
  SchemeContent, 
  hexFromArgb,
  Hct
} from '@material/material-color-utilities';

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
  const [showImageEditModal, setShowImageEditModal] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [timerName, setTimerName] = useState('');
  const [savedTimers, setSavedTimers] = useState<SavedTimer[]>([]);
  const [editingTimerId, setEditingTimerId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [soundType, setSoundType] = useState<SoundType>(() => {
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
  const [cachedThemeColors, setCachedThemeColors] = useState<{light: any, dark: any} | null>(() => {
    const saved = localStorage.getItem('hiit-theme-colors');
    return saved ? JSON.parse(saved) : null;
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('hiit-pulse-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Prefetch and cache theme color values to ensure seamless transitions
  // and availability for JS-driven animations if needed
  const [themeCache, setThemeCache] = useState<Record<string, string>>({});

  const { playPhaseTransition, playBeep } = useAudio();

  useEffect(() => {
    localStorage.setItem('hiit-pulse-theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.add('light-mode');
    }

    // Cache the current theme colors after the class has been applied
    // This ensures that any JS-driven animations have immediate access to the correct colors
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    setThemeCache({
      bg: styles.getPropertyValue('--bg').trim(),
      text: styles.getPropertyValue('--text').trim(),
      accent: styles.getPropertyValue('--accent').trim(),
      prep: styles.getPropertyValue('--phase-prep').trim(),
      work: styles.getPropertyValue('--phase-work').trim(),
      rest: styles.getPropertyValue('--phase-rest').trim(),
      finished: styles.getPropertyValue('--phase-finished').trim(),
    });
  }, [isDarkMode]);

  // Material 3 Dynamic Theming
  useEffect(() => {
    if (!headerImage) {
      // Reset to Catppuccin defaults if no image
      document.documentElement.style.removeProperty('--bg');
      document.documentElement.style.removeProperty('--text');
      document.documentElement.style.removeProperty('--surface');
      document.documentElement.style.removeProperty('--surface-hover');
      document.documentElement.style.removeProperty('--border');
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-hover');
      return;
    }

    const applyTheme = (scheme: any) => {
      const root = document.documentElement;
      root.style.setProperty('--bg', hexFromArgb(scheme.surfaceContainerLowest));
      root.style.setProperty('--text', hexFromArgb(scheme.onSurface));
      root.style.setProperty('--surface', hexFromArgb(scheme.surfaceContainerLow));
      root.style.setProperty('--surface-hover', hexFromArgb(scheme.surfaceContainerHigh));
      root.style.setProperty('--border', hexFromArgb(scheme.outlineVariant));
      root.style.setProperty('--accent', hexFromArgb(scheme.primary));
      root.style.setProperty('--accent-hover', hexFromArgb(scheme.primaryContainer));
    };

    if (cachedThemeColors) {
      applyTheme(isDarkMode ? cachedThemeColors.dark : cachedThemeColors.light);
      return;
    }

    const updateThemeFromImage = async () => {
      const img = new Image();
      img.src = headerImage;
      img.crossOrigin = 'Anonymous';
      
      img.onload = async () => {
        try {
          const sourceColor = await sourceColorFromImage(img);
          const hct = Hct.fromInt(sourceColor);
          
          // Generate both schemes at once
          const lightScheme = new SchemeContent(hct, false, 0.0);
          const darkScheme = new SchemeContent(hct, true, 0.0);
          
          const colors = {
            light: {
              surfaceContainerLowest: lightScheme.surfaceContainerLowest,
              onSurface: lightScheme.onSurface,
              surfaceContainerLow: lightScheme.surfaceContainerLow,
              surfaceContainerHigh: lightScheme.surfaceContainerHigh,
              outlineVariant: lightScheme.outlineVariant,
              primary: lightScheme.primary,
              primaryContainer: lightScheme.primaryContainer,
            },
            dark: {
              surfaceContainerLowest: darkScheme.surfaceContainerLowest,
              onSurface: darkScheme.onSurface,
              surfaceContainerLow: darkScheme.surfaceContainerLow,
              surfaceContainerHigh: darkScheme.surfaceContainerHigh,
              outlineVariant: darkScheme.outlineVariant,
              primary: darkScheme.primary,
              primaryContainer: darkScheme.primaryContainer,
            }
          };

          setCachedThemeColors(colors);
          localStorage.setItem('hiit-theme-colors', JSON.stringify(colors));
          applyTheme(isDarkMode ? colors.dark : colors.light);
        } catch (err) {
          console.error('Failed to extract color from image:', err);
        }
      };
    };

    updateThemeFromImage();
  }, [headerImage, isDarkMode, cachedThemeColors]);

  const displayRound = state.phase === 'prep' ? 0 : state.currentRound;

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
  const [pendingMusicFiles, setPendingMusicFiles] = useState<Track[]>([]);
  const [showMusicConfirm, setShowMusicConfirm] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerImageInputRef = useRef<HTMLInputElement>(null);

  const isFirstLoad = useRef(true);

  // Track whether we've played the halfway sound for the current work phase
  const halfwayPlayedRef = useRef(false);

  // Touch swipe tracking for mobile sidebar opening
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleEdgeTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    // Only start tracking if touch begins in the leftmost 20px
    if (touch.clientX > 100) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleEdgeTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    e.preventDefault(); // Prevent scrolling while swiping
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartXRef.current;
    const dy = touch.clientY - (touchStartYRef.current ?? 0);

    // Swipe right from the left edge with a mostly horizontal gesture
    if (dx > 40 && Math.abs(dy) < 80) {
      setShowSidebar(true);
      touchStartXRef.current = null;
      touchStartYRef.current = null;
    }
  };

  const handleEdgeTouchEnd = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

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
      setState((prev) => {
        const nextState = { ...prev, isActive: !prev.isActive };

        // Keep music in sync with the timer play/pause state.
        // Some browsers require a user interaction to start playback, so we do it in response to the button click.
        if (audioRef.current) {
          if (nextState.isActive && playlist.length > 0) {
            audioRef.current.play().catch(() => {});
          } else {
            audioRef.current.pause();
          }
        }

        return nextState;
      });
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

    if (newTracks.length > 0) {
      setPendingMusicFiles(newTracks);
      setShowMusicConfirm(true);
    }
  };

  const confirmMusicFolder = () => {
    setPlaylist(pendingMusicFiles);
    setCurrentTrackIndex(0);
    setPendingMusicFiles([]);
    setShowMusicConfirm(false);
  };

  const nextTrack = () => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  };

  const prevTrack = () => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  };

  // Keep the audio element playback in sync when the timer is running.
  useEffect(() => {
    if (!audioRef.current) return;

    if (state.isActive && playlist.length > 0) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [state.isActive, playlist.length]);

  // Auto-play the next/previous track when switching while the timer is active.
  useEffect(() => {
    if (!audioRef.current) return;
    if (!state.isActive) return;
    audioRef.current.play().catch(() => {});
  }, [currentTrackIndex, state.isActive]);

  const handleHeaderImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setHeaderImage(base64String);
        localStorage.setItem('hiit-header-image', base64String);
        
        // Extract and cache colors immediately
        const img = new Image();
        img.src = base64String;
        img.onload = async () => {
          try {
            const sourceColor = await sourceColorFromImage(img);
            const hct = Hct.fromInt(sourceColor);
            const lightScheme = new SchemeContent(hct, false, 0.0);
            const darkScheme = new SchemeContent(hct, true, 0.0);
            
            const colors = {
              light: {
                surfaceContainerLowest: lightScheme.surfaceContainerLowest,
                onSurface: lightScheme.onSurface,
                surfaceContainerLow: lightScheme.surfaceContainerLow,
                surfaceContainerHigh: lightScheme.surfaceContainerHigh,
                outlineVariant: lightScheme.outlineVariant,
                primary: lightScheme.primary,
                primaryContainer: lightScheme.primaryContainer,
              },
              dark: {
                surfaceContainerLowest: darkScheme.surfaceContainerLowest,
                onSurface: darkScheme.onSurface,
                surfaceContainerLow: darkScheme.surfaceContainerLow,
                surfaceContainerHigh: darkScheme.surfaceContainerHigh,
                outlineVariant: darkScheme.outlineVariant,
                primary: darkScheme.primary,
                primaryContainer: darkScheme.primaryContainer,
              }
            };
            setCachedThemeColors(colors);
            localStorage.setItem('hiit-theme-colors', JSON.stringify(colors));
          } catch (err) {
            console.error('Failed to extract colors on upload:', err);
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const removeHeaderImage = () => {
    setHeaderImage(null);
    setCachedThemeColors(null);
    localStorage.removeItem('hiit-header-image');
    localStorage.removeItem('hiit-theme-colors');
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!headerImage || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(headerImage, croppedAreaPixels);
      if (croppedImage) {
        setHeaderImage(croppedImage);
        localStorage.setItem('hiit-header-image', croppedImage);
        setIsCropping(false);
      }
    } catch (e) {
      console.error(e);
    }
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

  const getPhaseColor = (phase: TimerPhase, type: 'text' | 'bg' | 'border' = 'text') => {
    switch (phase) {
      case 'prep': 
        if (type === 'bg') return 'bg-[var(--phase-prep)]';
        if (type === 'border') return 'border-[var(--phase-prep)]';
        return 'text-[var(--phase-prep)]';
      case 'work': 
        if (type === 'bg') return 'bg-[var(--phase-work)]';
        if (type === 'border') return 'border-[var(--phase-work)]';
        return 'text-[var(--phase-work)]';
      case 'rest': 
        if (type === 'bg') return 'bg-[var(--phase-rest)]';
        if (type === 'border') return 'border-[var(--phase-rest)]';
        return 'text-[var(--phase-rest)]';
      case 'finished': 
        if (type === 'bg') return 'bg-[var(--phase-finished)]';
        if (type === 'border') return 'border-[var(--phase-finished)]';
        return 'text-[var(--phase-finished)]';
      default: return type === 'text' ? 'text-[var(--text)]' : '';
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans selection:bg-[var(--accent)]/30 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Hidden Audio Element */}
      {playlist.length > 0 && (
        <audio 
          ref={audioRef}
          src={playlist[currentTrackIndex].url}
          volume={musicVolume}
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
        webkitdirectory="" 
        directory="" 
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
              className="fixed top-0 left-0 bottom-0 w-65 bg-[var(--surface)] border-r border-[var(--border)] z-[70] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Top Bar (Branding & Close) */}
              <div className="absolute top-4 left-5 right-4 z-30 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.25em] font-mono transition-colors duration-300",
                    headerImage ? "text-white/95 drop-shadow-sm" : "text-[var(--icon-secondary)]"
                  )}>
                    HIIT PULSE
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setShowImageEditModal(true)} 
                    className={cn(
                      "p-1.5 transition-colors duration-300",
                      headerImage ? "text-white/70 hover:text-white" : "text-[var(--icon-secondary)] hover:text-[var(--text)]"
                    )}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>

              {/* Sidebar Header Background Image */}
              {headerImage && (
                <div className="absolute top-0 left-0 right-0 h-40 z-0 pointer-events-none overflow-hidden">
                  <img 
                    src={headerImage} 
                    alt="Sidebar Header Background" 
                    className="w-full h-full object-cover opacity-60 blur-[0.5px]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[var(--surface)]" />
                </div>
              )}

              <nav className={cn("relative z-20 flex-1 px-6", headerImage ? "mt-44" : "mt-16")}>
                <SidebarButton 
                  icon={<List size={20} className="text-[var(--phase-finished)]" />} 
                  label="Saved Workouts" 
                  onClick={() => { setShowSaved(true); setShowSidebar(false); }} 
                />
                <SidebarButton 
                  icon={<SettingsIcon size={20} className="text-[var(--accent)]" />} 
                  label="Timer Settings" 
                  onClick={() => { setShowSettings(true); setShowSidebar(false); }} 
                />
                <SidebarButton 
                  icon={<Volume2 size={20} className="text-[var(--phase-rest)]" />} 
                  label="Audio Settings" 
                  onClick={() => { setShowAudioSettings(true); setShowSidebar(false); }} 
                />
                <SidebarButton 
                  icon={<Music size={20} className={playlist.length > 0 ? "text-[var(--accent)]" : "text-[var(--phase-prep)]"} />} 
                  label="Music Library" 
                  onClick={() => { fileInputRef.current?.click(); setShowSidebar(false); }} 
                />
              </nav>

              <div className="relative z-20 p-6 border-t border-[var(--border)]">
                <SidebarButton 
                  icon={isDarkMode ? <Sun size={20} className="text-[var(--phase-prep)]" /> : <Moon size={20} className="text-[var(--accent)]" />} 
                  label={isDarkMode ? "Light Mode" : "Dark Mode"} 
                  onClick={() => setIsDarkMode(!isDarkMode)} 
                />
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-from-left trigger area */}
      <div 
        className="fixed top-0 left-0 bottom-0 w-4 z-[55] cursor-e-resize"
        onMouseEnter={() => !showSidebar && setShowSidebar(true)}
        onTouchStart={handleEdgeTouchStart}
        onTouchMove={handleEdgeTouchMove}
        onTouchEnd={handleEdgeTouchEnd}
      />

      {/* Header */}
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setShowSidebar(true)}
            className="p-2 text-[var(--accent)] hover:text-[var(--text)] transition-colors"
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
              <span className="text-[var(--icon-secondary)] text-sm mt-4 tracking-widest uppercase">
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
            className="text-[var(--surface)]"
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
            className="text-[var(--surface)]/50"
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
            className="text-[var(--phase-finished)]/80"
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
            <div className="flex items-center gap-4 text-[var(--accent)]/60">
              <button onClick={prevTrack} className="hover:text-[var(--accent)] transition-colors"><SkipBack size={20} /></button>
              <div className="flex flex-col items-center w-48 overflow-hidden">
                <span className="text-xs font-medium text-[var(--accent)] uppercase tracking-widest truncate w-full text-center">
                  {playlist[currentTrackIndex].name}
                </span>
              </div>
              <button onClick={nextTrack} className="hover:text-[var(--accent)] transition-colors"><SkipForward size={20} /></button>
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
            className="p-2 transition-colors text-[var(--accent)]/40 hover:text-[var(--accent)] disabled:opacity-10 disabled:cursor-not-allowed"
            title="Previous Round"
          >
            <SkipBack size={28} />
          </button>

          {state.phase === 'finished' ? (
            <button
              onClick={resetTimer}
              title="Reset"
              className={cn(
                "w-24 h-24 flex items-center justify-center transition-all transform active:scale-95 rounded-full border-2",
                getPhaseColor('finished', 'border'),
                "border-opacity-20",
                getPhaseColor('finished', 'bg'),
                "bg-opacity-5",
                getPhaseColor('finished', 'text')
              )}
            >
              <RotateCcw size={36} />
            </button>
          ) : (
            <button 
              onClick={toggleTimer}
              className={cn(
                "w-24 h-24 flex items-center justify-center transition-all transform active:scale-95 rounded-full border-2",
                getPhaseColor(state.phase, 'border'),
                "border-opacity-20 hover:border-opacity-40",
                getPhaseColor(state.phase, 'bg'),
                "bg-opacity-5 hover:bg-opacity-10",
                getPhaseColor(state.phase, 'text')
              )}
             title="Pause Timer"
            >
              {state.isActive ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-2" />}
            </button>
          )}
 
           <button 
             onClick={nextRound}
             disabled={!['prep', 'work', 'rest'].includes(state.phase)}
             className="p-2 transition-colors text-[var(--accent)]/40 hover:text-[var(--accent)] disabled:opacity-10 disabled:cursor-not-allowed"
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
          className="fixed bottom-[25px] left-1/2 -translate-x-1/2 p-2 transition-colors text-[var(--icon-secondary)] hover:text-[var(--text)] z-50"
          title="Reset Timer"
        >
          <RotateCcw size={20} />
        </button>
      )}

      {/* Header Image Edit Modal */}
      <AnimatePresence>
        {showImageEditModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImageEditModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 z-[110] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight">
                  {isCropping ? "Adjust Image" : "Edit Header Image"}
                </h2>
                <button 
                  onClick={() => {
                    if (isCropping) {
                      setIsCropping(false);
                    } else {
                      setShowImageEditModal(false);
                    }
                  }} 
                  className="p-2 text-[var(--icon-secondary)] hover:text-[var(--text)] transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-[var(--border)] bg-black/5">
                  {isCropping && headerImage ? (
                    <div className="absolute inset-0">
                      <Cropper
                        image={headerImage}
                        crop={crop}
                        zoom={zoom}
                        aspect={16 / 9}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                      />
                    </div>
                  ) : headerImage ? (
                    <img 
                      src={headerImage} 
                      alt="Current Header" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[var(--icon-secondary)] gap-2">
                      <ImageIcon size={48} strokeWidth={1} />
                      <span className="text-sm font-medium">No image uploaded</span>
                    </div>
                  )}
                </div>

                {isCropping ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[var(--icon-secondary)]">
                        <span>Zoom</span>
                        <span>{Math.round(zoom * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer accent-[var(--accent)]"
                      />
                    </div>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => setIsCropping(false)}
                        title="Cancel"
                        className="w-14 h-14 flex items-center justify-center bg-[var(--surface-hover)] hover:bg-[var(--border)] text-[var(--text)] rounded-2xl transition-all"
                      >
                        <X size={24} />
                      </button>
                      <button
                        onClick={handleCropSave}
                        title="Apply Crop"
                        className="w-14 h-14 flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-2xl transition-all shadow-lg shadow-[var(--accent)]/20"
                      >
                        <Check size={24} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => {
                        headerImageInputRef.current?.click();
                        setShowImageEditModal(false);
                      }}
                      title={headerImage ? "Change Image" : "Upload Image"}
                      className="w-14 h-14 flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-2xl transition-all shadow-lg shadow-[var(--accent)]/20"
                    >
                      <ImageIcon size={24} />
                    </button>

                    {headerImage && (
                      <>
                        <button
                          onClick={() => setIsCropping(true)}
                          title="Adjust Image"
                          className="w-14 h-14 flex items-center justify-center bg-[var(--surface-hover)] hover:bg-[var(--border)] text-[var(--text)] rounded-2xl transition-all"
                        >
                          <Crop size={24} />
                        </button>

                        <button
                          onClick={() => {
                            removeHeaderImage();
                            setShowImageEditModal(false);
                          }}
                          title="Remove Image"
                          className="w-14 h-14 flex items-center justify-center bg-[var(--phase-work)]/10 hover:bg-[var(--phase-work)]/20 text-[var(--phase-work)] rounded-2xl transition-all"
                        >
                          <Trash2 size={24} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              className="bg-[var(--surface)] border border-[var(--border)] w-full max-w-sm rounded-3xl p-[22px] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-medium text-[var(--text)]">Timer Settings</h2>
                <button 
                  onClick={closeSettings} 
                  className="text-[var(--accent)] hover:text-[var(--text)] transition-colors p-1"
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

              <div className="mt-8 pt-8 border-t border-[var(--border)]">
                <div className="flex gap-2 w-full">
                  <input 
                    type="text" 
                    placeholder="Timer Name" 
                    value={timerName}
                    onChange={(e) => setTimerName(e.target.value)}
                    className="flex-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]"
                  />
                  <button 
                    onClick={saveTimer}
                    disabled={!timerName.trim()}
                    className="p-2 rounded-xl bg-[var(--accent)] text-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-hover)] transition-colors"
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
              className="bg-[var(--surface)] border border-[var(--border)] w-full max-w-sm rounded-3xl p-[22px] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-medium text-[var(--text)]">Audio Settings</h2>
                <button 
                  onClick={() => setShowAudioSettings(false)} 
                  className="text-[var(--phase-rest)] hover:text-[var(--text)] transition-colors p-1"
                  aria-label="Close audio settings"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--icon-secondary)] font-medium">Sound Type</span>
                  <select 
                    value={soundType}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setSoundType(newType);
                      playPhaseTransition(false, soundVolume, newType);
                    }}
                    className="bg-[var(--surface-hover)] text-[var(--text)] rounded-lg px-3 py-2 text-sm focus:outline-none border border-[var(--border)]"
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
                    <span className="text-[var(--icon-secondary)] font-medium">Timer Volume</span>
                    <span className="text-[var(--icon-secondary)] text-sm">{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <VolumeX size={16} className="text-[var(--phase-work)]/60" />
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
                      className="flex-1 h-1.5 bg-[var(--surface-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                    />
                    <Volume2 size={16} className="text-[var(--phase-rest)]/60" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--icon-secondary)] font-medium">Music Volume</span>
                    <span className="text-[var(--icon-secondary)] text-sm">{Math.round(musicVolume * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <VolumeX size={16} className="text-[var(--phase-work)]/60" />
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
                      className="flex-1 h-1.5 bg-[var(--surface-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                    />
                    <Volume2 size={16} className="text-[var(--phase-rest)]/60" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Music Folder Confirmation Modal */}
      <AnimatePresence>
        {showMusicConfirm && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => setShowMusicConfirm(false)}
            className="fixed inset-0 z-[60] flex items-center justify-center p-[10px] bg-black/80 backdrop-blur-sm"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--surface)] border border-[var(--border)] w-full max-w-sm rounded-3xl p-[22px] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-medium text-[var(--text)]">Select This Folder</h2>
                <button 
                  onClick={() => setShowMusicConfirm(false)} 
                  className="text-[var(--icon-secondary)] hover:text-[var(--text)] transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-[var(--icon-secondary)] text-sm">
                  Found {pendingMusicFiles.length} song{pendingMusicFiles.length !== 1 ? 's' : ''} in this folder:
                </p>
                
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {pendingMusicFiles.slice(0, 5).map((track, i) => (
                    <div key={i} className="text-xs text-[var(--icon-secondary)]/70 truncate bg-[var(--surface-hover)]/50 px-3 py-2 rounded-lg">
                      {track.name}
                    </div>
                  ))}
                  {pendingMusicFiles.length > 5 && (
                    <div className="text-xs text-[var(--icon-secondary)]/50 italic px-3">
                      + {pendingMusicFiles.length - 5} more...
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowMusicConfirm(false)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-[var(--surface-hover)] text-[var(--text)] font-medium hover:bg-[var(--border)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmMusicFolder}
                    className="flex-1 px-4 py-3 rounded-2xl bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-colors"
                  >
                    Load Folder
                  </button>
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
              className="bg-[var(--surface)] border border-[var(--border)] w-full max-w-sm rounded-3xl p-[22px] shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-medium text-[var(--text)]">Saved Timers</h2>
                <button 
                  onClick={() => setShowSaved(false)} 
                  className="text-[var(--phase-finished)] hover:text-[var(--text)] transition-colors p-1"
                  aria-label="Close saved timers"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {savedTimers.length === 0 ? (
                  <div className="text-center py-12 text-[var(--icon-secondary)]">
                    <p>No saved timers yet.</p>
                  </div>
                ) : (
                  savedTimers.map((timer) => (
                    <div 
                      key={timer.id}
                      className="group relative rounded-2xl bg-[var(--surface-hover)]/50 border border-[var(--border)] hover:border-[var(--border-hover)] transition-all overflow-hidden"
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
                            className="flex-1 bg-transparent border-none px-2 py-1 text-sm focus:outline-none min-w-0 font-medium text-[var(--text)]"
                          />
                          <button
                            id={`save-name-${timer.id}`}
                            onClick={() => renameTimer(timer.id)}
                            className="p-1.5 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors flex-shrink-0"
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
                              <h3 className="font-medium text-[var(--text)]">{timer.name}</h3>
                              {Number(timer.isDefault) === 1 && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-md">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex justify-between items-center">
                              <div className="text-xs text-[var(--icon-secondary)]/60 space-y-0.5 font-medium">
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
                                      ? "text-[var(--accent)] bg-[var(--accent)]/10" 
                                      : "text-[var(--icon-secondary)]/40 hover:text-[var(--accent)] group-hover:opacity-100"
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
                                  className="p-2 text-[var(--icon-secondary)]/40 hover:text-[var(--text)] hover:bg-[var(--surface-hover)] group-hover:opacity-100 transition-all rounded-lg"
                                  title="Rename timer"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTimer(timer.id);
                                  }}
                                  className="p-2 text-[var(--icon-secondary)]/40 hover:text-red-400 hover:bg-red-400/10 group-hover:opacity-100 transition-all rounded-lg"
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
          state.phase === 'work' ? "bg-[var(--phase-work)]" : 
          state.phase === 'rest' ? "bg-[var(--phase-rest)]" : 
          state.phase === 'prep' ? "bg-[var(--phase-prep)]" : "bg-[var(--phase-finished)]"
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
      className="w-full flex items-center gap-4 py-4 pl-6 pr-4 rounded-2xl text-[var(--icon-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]/50 transition-all group"
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
      <span className="text-[var(--icon-secondary)] font-medium pr-10">{label}</span>
      
      <div className="">
        <button 
          onClick={() => onChange(Math.max(1, value - 1))}
          className="w-10 h-10 flex items-center justify-center text-[var(--icon-secondary)] hover:text-[var(--text)] transition-colors"
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
            className="w-full bg-[var(--surface)] border border-[var(--accent)]/50 rounded text-center font-mono text-lg focus:outline-none text-[var(--text)]"
          />
        ) : (
          <button 
            onClick={() => setIsEditing(true)}
            className="w-full text-center font-mono text-lg hover:text-[var(--accent)] transition-colors cursor-text text-[var(--text)]"
          >
            {value}{unit}
          </button>
        )}
      </div>

      <button 
        onClick={() => onChange(value + 1)}
        className="w-10 h-10 flex items-center justify-center text-[var(--icon-secondary)] hover:text-[var(--text)] transition-colors"
      >
        <ChevronUp size={18} />
      </button>
    </>
  );
}
