import { useEffect, useRef } from 'react';
import { SoundType } from '../types';

export const useAudio = () => {
  const audioCtx = useRef<AudioContext | null>(null);

  const playBeep = (frequency: number = 440, duration: number = 0.1, volume: number = 0.5, type: SoundType = 'beep') => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const oscillator = audioCtx.current.createOscillator();
    const gainNode = audioCtx.current.createGain();

    switch (type) {
      case 'beep':
        oscillator.type = 'sine';
        break;
      case 'bell':
        oscillator.type = 'triangle';
        frequency = frequency * 1.5;
        duration = duration * 2;
        break;
      case 'whistle':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioCtx.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, audioCtx.current.currentTime + duration);
        break;
      case 'digital':
        oscillator.type = 'square';
        break;
      default:
        oscillator.type = 'sine';
    }

    if (type !== 'whistle') {
      oscillator.frequency.setValueAtTime(frequency, audioCtx.current.currentTime);
    }
    
    gainNode.gain.setValueAtTime(volume, audioCtx.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.current.destination);

    oscillator.start();
    oscillator.stop(audioCtx.current.currentTime + duration);
  };

  const playPhaseTransition = (isFinished: boolean = false, volume: number = 0.5, type: SoundType = 'beep') => {
    if (isFinished) {
      playBeep(880, 0.5, volume, type);
    } else {
      playBeep(440, 0.2, volume, type);
    }
  };

  return { playBeep, playPhaseTransition };
};
