import { describe, expect, it } from "vitest";
import { calibrateDailyE1RM, linearRegression, performanceReadiness, readinessScore, testProfilePoints, velocityLoss } from "./metrics";

describe("VBT metrics", () => {
  it("calculates velocity loss from fastest to latest set", () => {
    expect(velocityLoss([{ velocity: 0.5 }, { velocity: 0.4 }])).toBeCloseTo(20);
  });

  it("creates a bounded readiness score", () => {
    const score = readinessScore({ date: "2026-09-29", sleepHours: 8, sleepQuality: 4, fatigue: 2, soreness: 2, stress: 2, hrv: 64, restingHr: 57 });
    expect(score).toBeGreaterThan(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("fits a descending load velocity profile", () => {
    const result = linearRegression([{ weight: 60, velocity: 0.72 }, { weight: 80, velocity: 0.52 }, { weight: 95, velocity: 0.33 }], 0.2);
    expect(result).not.toBeNull();
    expect(result!.slope).toBeLessThan(0);
    expect(result!.estimated1RM).toBeGreaterThan(95);
  });

  it("compares jump and grip results with the athlete baseline", () => {
    const score = performanceReadiness(
      { armSwingCmj: 60, noArmCmj: 50, gripLeft: 55, gripRight: 57 },
      [
        { armSwingCmj: 58, noArmCmj: 49, gripLeft: 54, gripRight: 56 },
        { armSwingCmj: 59, noArmCmj: 50, gripLeft: 55, gripRight: 56 }
      ]
    );
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(100);
  });

  it("uses only the fastest completed set at each load from test sessions", () => {
    const points = testProfilePoints([
      { id: 1, date: "2026-09-01", type: "下肢力量", duration: 60, notes: "", completed: true, exercises: [{ id: "a", exercise: "深蹲", sets: [{ id: "1", weight: 100, reps: 3, velocity: .55, rpe: 7, completed: true }] }] },
      { id: 2, date: "2026-09-15", type: "测试", duration: 50, notes: "", completed: true, exercises: [{ id: "b", exercise: "深蹲", sets: [
        { id: "2", weight: 100, reps: 1, velocity: .60, rpe: 6, completed: true },
        { id: "3", weight: 100, reps: 1, velocity: .54, rpe: 8, completed: true },
        { id: "4", weight: 130, reps: 1, velocity: .40, rpe: 8, completed: true }
      ] }] }
    ], "深蹲");
    expect(points).toEqual([
      { weight: 100, velocity: .60, date: "2026-09-15" },
      { weight: 130, velocity: .40, date: "2026-09-15" }
    ]);
  });

  it("calibrates today's 1RM with only one fresh observation", () => {
    const baseline = linearRegression([{ weight: 80, velocity: .70 }, { weight: 120, velocity: .42 }], .30);
    const fresh = calibrateDailyE1RM(baseline, .30, { weight: 100, velocity: .60 });
    expect(fresh).not.toBeNull();
    expect(fresh!.velocityDelta).toBeGreaterThan(0);
    expect(fresh!.estimated1RM).toBeGreaterThan(baseline!.estimated1RM);
  });
});

