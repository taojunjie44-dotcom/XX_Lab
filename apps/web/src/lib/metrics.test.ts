import { describe, expect, it } from "vitest";
import { linearRegression, readinessScore, velocityLoss } from "./metrics";

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
});
