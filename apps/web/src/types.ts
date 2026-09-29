export type ExerciseName = "深蹲" | "卧推" | "硬拉" | "高抓" | "高翻";

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
  type: "下肢力量" | "上肢力量" | "举重技术" | "测试" | "恢复";
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
  score: number;
  recommendation: string;
}

export interface AthleteSettings {
  id: string;
  name: string;
  bodyWeight: number;
  unit: "kg" | "lb";
  theme: "light" | "dark" | "system";
  mvt: Record<ExerciseName, number>;
}

export const exercises: ExerciseName[] = ["深蹲", "卧推", "硬拉", "高抓", "高翻"];
