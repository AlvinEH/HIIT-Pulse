export type TimerPhase = 'prep' | 'work' | 'rest' | 'finished' | 'workoutStepComplete';

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
  isActive: boolean;
}

export interface SavedTimer extends TimerSettings {
  id: number;
  name: string;
  isDefault?: number;
  createdAt: string;
}

export interface WorkoutStep {
  id: number;
  timerId?: number; // Reference to a saved timer
  customSettings?: TimerSettings; // Or custom timer settings
  name: string;
}

export interface Workout {
  id: number;
  name: string;
  steps: WorkoutStep[];
  createdAt: string;
}
