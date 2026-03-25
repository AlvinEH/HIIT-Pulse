import { useEffect, useRef } from 'react';
import { SoundType } from '../types';

export const useAudio = () => {
  const audioCtx = useRef<AudioContext | null>(null);

  const playBeep = async (frequency: number = 440, duration: number = 0.1, volume: number = 0.5, type: SoundType = 'beep') => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Ensure audio context is running - critical when music is playing
      if (audioCtx.current.state === 'suspended') {
        try {
          await audioCtx.current.resume();
        } catch (error) {
          console.warn('Failed to resume audio context:', error);
          return;
        }
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
        case 'chime':
          oscillator.type = 'triangle';
          frequency = frequency * 2;
          duration = duration * 3;
          gainNode.gain.setValueAtTime(volume, audioCtx.current.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + duration * 0.7);
          break;
        case 'ding':
          oscillator.type = 'sine';
          frequency = frequency * 1.25;
          duration = duration * 1.5;
          break;
        case 'ping':
          oscillator.type = 'square';
          frequency = frequency * 0.8;
          duration = duration * 0.8;
          break;
        case 'laser':
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(frequency * 2, audioCtx.current.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.3, audioCtx.current.currentTime + duration);
          break;
        case 'power-up':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency * 0.5, audioCtx.current.currentTime);
          oscillator.frequency.linearRampToValueAtTime(frequency * 2, audioCtx.current.currentTime + duration);
          break;
        case 'notification':
          oscillator.type = 'triangle';
          duration = duration * 1.2;
          break;
        default:
          oscillator.type = 'sine';
      }

      if (type !== 'whistle' && type !== 'laser' && type !== 'power-up') {
        oscillator.frequency.setValueAtTime(frequency, audioCtx.current.currentTime);
      }

      if (type !== 'chime') {
        gainNode.gain.setValueAtTime(volume, audioCtx.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + duration);
      }

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.current.destination);

      const startTime = audioCtx.current.currentTime + 0.01; // Small delay to ensure proper scheduling
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    } catch (error) {
      console.warn('Failed to play beep:', error);
    }
  };

  const playPhaseTransition = async (isFinished: boolean = false, volume: number = 0.5, type: SoundType = 'beep') => {
    if (isFinished) {
      await playBeep(880, 0.5, volume, type);
    } else {
      await playBeep(440, 0.2, volume, type);
    }
  };

  return { playBeep, playPhaseTransition };
};
