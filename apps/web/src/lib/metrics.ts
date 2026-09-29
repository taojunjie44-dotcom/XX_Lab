import type { ReadinessEntry, SetEntry } from "../types";

export function velocityLoss(sets: Pick<SetEntry, "velocity">[]): number {
  const valid = sets.map((set) => set.velocity).filter((value) => value > 0);
  if (valid.length < 2) return 0;
  const peak = Math.max(...valid);
  const latest = valid.at(-1) ?? peak;
  return Math.max(0, ((peak - latest) / peak) * 100);
}

export function readinessScore(input: Omit<ReadinessEntry, "id" | "score" | "recommendation">): number {
  const sleepDuration = Math.min(100, Math.max(0, (input.sleepHours / 8) * 100));
  const sleepQuality = input.sleepQuality * 20;
  const fatigue = (6 - input.fatigue) * 20;
  const soreness = (6 - input.soreness) * 20;
  const stress = (6 - input.stress) * 20;
  const hrv = Math.min(110, Math.max(40, (input.hrv / 62) * 100));
  const restingHr = Math.min(105, Math.max(45, (58 / input.restingHr) * 100));
  return Math.round(
    sleepDuration * 0.2 + sleepQuality * 0.15 + fatigue * 0.2 + soreness * 0.1 + stress * 0.1 + hrv * 0.15 + restingHr * 0.1
  );
}

export function readinessRecommendation(score: number): string {
  if (score >= 85) return "状态很好，可按计划训练并保留冲重选择";
  if (score >= 70) return "状态正常，执行计划并监控速度下降";
  if (score >= 55) return "轻度疲劳，主项减少 5–10% 负荷或一组";
  return "恢复优先，建议技术训练或低强度活动";
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  estimated1RM: number;
}

export function linearRegression(points: { weight: number; velocity: number }[], mvt: number): RegressionResult | null {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.weight, 0);
  const sumY = points.reduce((sum, p) => sum + p.velocity, 0);
  const sumXY = points.reduce((sum, p) => sum + p.weight * p.velocity, 0);
  const sumXX = points.reduce((sum, p) => sum + p.weight * p.weight, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  const ssTotal = points.reduce((sum, p) => sum + (p.velocity - meanY) ** 2, 0);
  const ssResidual = points.reduce((sum, p) => sum + (p.velocity - (slope * p.weight + intercept)) ** 2, 0);
  const r2 = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;
  const estimated1RM = slope < 0 ? (mvt - intercept) / slope : 0;
  return { slope, intercept, r2, estimated1RM };
}

export function sessionVolume(session: { exercises: { sets: Pick<SetEntry, "weight" | "reps" | "completed">[] }[] }): number {
  return session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed).reduce((sum, set) => sum + set.weight * set.reps, 0);
}
