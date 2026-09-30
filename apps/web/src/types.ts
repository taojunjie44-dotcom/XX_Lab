export type ExerciseName = string;

export type TrainingType = "下肢力量" | "上肢力量" | "全身力量" | "举重技术" | "速度力量" | "增强式" | "体能" | "测试" | "恢复" | "其他";

export interface SetEntry {
  id: string;
  weight: number;
  reps: number;
  velocity: number;
  rpe: number;
  completed: boolean;
}

export interface ExerciseBlock {
  id: string;
  exercise: ExerciseName;
  sets: SetEntry[];
}

export interface TrainingSession {
  id?: number;
  date: string;
  type: TrainingType;
  duration: number;
  notes: string;
  exercises: ExerciseBlock[];
  completed: boolean;
}

export interface ReadinessEntry {
  id?: number;
  date: string;
  sleepHours: number;
  sleepQuality: number;
  fatigue: number;
  soreness: number;
  stress: number;
  hrv: number;
  restingHr: number;
  armSwingCmj?: number;
  noArmCmj?: number;
  gripLeft?: number;
  gripRight?: number;
  healthSource?: "manual" | "apple-health";
  score: number;
  recommendation: string;
}

export interface AthleteSettings {
  id: string;
  name: string;
  bodyWeight: number;
  unit: "kg" | "lb";
  theme: "light" | "dark" | "system";
  mvt: Record<string, number>;
  personalRecords?: PersonalRecord[];
}

export interface PersonalRecord {
  id: string;
  exercise: ExerciseName;
  weight: number;
  date: string;
  notes?: string;
}

