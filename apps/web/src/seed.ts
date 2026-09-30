import { subDays, format } from "date-fns";
import { db } from "./db";
import type { AthleteSettings, ReadinessEntry, TrainingSession } from "./types";

const iso = (daysAgo: number) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd");

export async function seedDatabase() {
  const accountExists = Boolean(localStorage.getItem("velocity-lab:account"));
  const initialDataClaimed = localStorage.getItem("velocity-lab:initial-claimed") === "true";
  const shouldSeedDemo = !accountExists && !initialDataClaimed;
  if ((await db.settings.count()) === 0) {
    const settings: AthleteSettings = {
      id: "athlete",
      name: "Tao",
      bodyWeight: 78.5,
      heightCm: 0,
      birthDate: "",
      sport: "",
      trainingYears: 0,
      dominantSide: "双侧",
      unit: "kg",
      theme: "light",
      mvt: { 深蹲: 0.3, 杠铃卧推: 0.17, 传统硬拉: 0.15, 全程高抓: 1.7, 全程高翻: 1.3 },
      personalRecords: []
    };
    await db.settings.add(settings);
  }

  if ((await db.readiness.count()) === 0 && shouldSeedDemo) {
    const data: ReadinessEntry[] = [
      { date: iso(6), sleepHours: 7.1, sleepQuality: 4, fatigue: 3, soreness: 2, stress: 2, hrv: 59, restingHr: 60, score: 76, recommendation: "正常训练" },
      { date: iso(5), sleepHours: 7.8, sleepQuality: 4, fatigue: 2, soreness: 2, stress: 2, hrv: 63, restingHr: 58, score: 84, recommendation: "按计划训练" },
      { date: iso(4), sleepHours: 6.6, sleepQuality: 3, fatigue: 4, soreness: 3, stress: 3, hrv: 54, restingHr: 63, score: 64, recommendation: "轻度减量" },
      { date: iso(3), sleepHours: 8.0, sleepQuality: 5, fatigue: 2, soreness: 2, stress: 1, hrv: 66, restingHr: 56, score: 91, recommendation: "状态很好" },
      { date: iso(2), sleepHours: 7.4, sleepQuality: 4, fatigue: 2, soreness: 3, stress: 2, hrv: 61, restingHr: 59, score: 81, recommendation: "按计划训练" },
      { date: iso(1), sleepHours: 7.7, sleepQuality: 4, fatigue: 2, soreness: 2, stress: 2, hrv: 64, restingHr: 57, score: 86, recommendation: "按计划训练" },
      { date: iso(0), sleepHours: 7.6, sleepQuality: 4, fatigue: 2, soreness: 2, stress: 2, hrv: 64, restingHr: 57, score: 87, recommendation: "状态正常，执行计划并监控速度下降" }
    ];
    await db.readiness.bulkAdd(data);
  }

  if ((await db.sessions.count()) === 0 && shouldSeedDemo) {
    const makeSets = (weights: number[], velocities: number[]) => weights.map((weight, i) => ({ id: crypto.randomUUID(), weight, reps: i < 2 ? 3 : 2, velocity: velocities[i], rpe: 6 + i, completed: true }));
    const sessions: TrainingSession[] = [
      { date: iso(1), type: "下肢力量", duration: 72, notes: "主项速度稳定，最后一组保留。", completed: true, exercises: [{ id: crypto.randomUUID(), exercise: "深蹲", sets: makeSets([100, 120, 140, 140], [0.61, 0.51, 0.43, 0.39]) }] },
      { date: iso(3), type: "上肢力量", duration: 64, notes: "卧推完成计划。", completed: true, exercises: [{ id: crypto.randomUUID(), exercise: "杠铃卧推", sets: makeSets([60, 75, 85, 85], [0.71, 0.55, 0.42, 0.38]) }] },
      { date: iso(5), type: "举重技术", duration: 58, notes: "高抓技术流畅。", completed: true, exercises: [{ id: crypto.randomUUID(), exercise: "全程高抓", sets: makeSets([50, 60, 70, 75], [2.43, 2.27, 2.08, 1.96]) }] },
      { date: iso(8), type: "下肢力量", duration: 76, notes: "深蹲基线课。", completed: true, exercises: [{ id: crypto.randomUUID(), exercise: "深蹲", sets: makeSets([90, 110, 130, 140], [0.68, 0.57, 0.47, 0.42]) }] },
      { date: iso(11), type: "上肢力量", duration: 62, notes: "卧推稳定。", completed: true, exercises: [{ id: crypto.randomUUID(), exercise: "杠铃卧推", sets: makeSets([55, 70, 80, 90], [0.77, 0.61, 0.49, 0.31]) }] }
    ];
    await db.sessions.bulkAdd(sessions);
  }
}

