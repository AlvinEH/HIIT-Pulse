export type TimerPhase = 'prep' | 'work' | 'rest' | 'finished';

export type SoundType = 'beep' | 'bell' | 'whistle' | 'digital' | 'chime' | 'ding' | 'ping' | 'laser' | 'power-up' | 'notification';

export interface TimerSettings {
  prepTime: number;
  workTime: number;
  restTime: number;
  rounds: number;
}

export interface TimerState {
  phase: TimerPhase;
  currentRound: number;
  timeLeft: number;
  isActive: boolean8;
}

export interface SavedTimer extends TimerSettings {
  id: number;
  name: string;
  isDefault?: number;
  createdAt: string;
}
