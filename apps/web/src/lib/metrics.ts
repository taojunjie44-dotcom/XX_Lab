import type { ReadinessEntry, SetEntry, TrainingSession } from "../types";

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

type PerformanceFields = Pick<ReadinessEntry, "armSwingCmj" | "noArmCmj" | "gripLeft" | "gripRight">;

export function performanceReadiness(current: PerformanceFields, history: PerformanceFields[]): number | null {
  const keys: (keyof PerformanceFields)[] = ["armSwingCmj", "noArmCmj", "gripLeft", "gripRight"];
  const ratios = keys.flatMap((key) => {
    const value = Number(current[key] || 0);
    const baselineValues = history.map((entry) => Number(entry[key] || 0)).filter((item) => item > 0).slice(0, 14);
    if (value <= 0 || baselineValues.length < 2) return [];
    const baseline = baselineValues.reduce((sum, item) => sum + item, 0) / baselineValues.length;
    return [Math.min(110, Math.max(75, value / baseline * 100))];
  });
  if (!ratios.length) return null;
  return Math.round(ratios.reduce((sum, value) => sum + value, 0) / ratios.length);
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

export interface VelocityProfilePoint {
  weight: number;
  velocity: number;
  date: string;
}

export function testProfilePoints(sessions: TrainingSession[], exercise: string, excludeSessionId?: number): VelocityProfilePoint[] {
  return sessions
    .filter((session) => session.completed && session.type === "测试" && session.id !== excludeSessionId)
    .flatMap((session) => {
      const fastestByWeight = new Map<number, number>();
      session.exercises.filter((block) => block.exercise === exercise).forEach((block) => block.sets.forEach((set) => {
        if (!set.completed || set.weight <= 0 || set.velocity <= 0) return;
        fastestByWeight.set(set.weight, Math.max(fastestByWeight.get(set.weight) ?? 0, set.velocity));
      }));
      return [...fastestByWeight].map(([weight, velocity]) => ({ weight, velocity, date: session.date }));
    })
    .sort((a, b) => a.weight - b.weight || a.date.localeCompare(b.date));
}

export interface DailyE1RMCalibration {
  estimated1RM: number;
  expectedVelocity: number;
  velocityDelta: number;
}

export function calibrateDailyE1RM(regression: RegressionResult | null, mvt: number, point?: { weight: number; velocity: number }): DailyE1RMCalibration | null {
  if (!regression || regression.slope >= 0 || !point || point.weight <= 0 || point.velocity <= 0) return null;
  const expectedVelocity = regression.slope * point.weight + regression.intercept;
  const velocityDelta = point.velocity - expectedVelocity;
  const estimated1RM = (mvt - (regression.intercept + velocityDelta)) / regression.slope;
  if (!Number.isFinite(estimated1RM) || estimated1RM <= 0) return null;
  return { estimated1RM, expectedVelocity, velocityDelta };
}

export function sessionVolume(session: { exercises: { sets: Pick<SetEntry, "weight" | "reps" | "completed">[] }[] }): number {
  return session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed).reduce((sum, set) => sum + set.weight * set.reps, 0);
}

