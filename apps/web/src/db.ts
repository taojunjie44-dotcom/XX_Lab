import Dexie, { type EntityTable } from "dexie";
import type { AthleteSettings, ReadinessEntry, TrainingSession } from "./types";

class VbtDatabase extends Dexie {
  sessions!: EntityTable<TrainingSession, "id">;
  readiness!: EntityTable<ReadinessEntry, "id">;
  settings!: EntityTable<AthleteSettings, "id">;

  constructor() {
    super("velocity-lab");
    this.version(1).stores({
      sessions: "++id, date, type, completed",
      readiness: "++id, date, score",
      settings: "id"
    });
  }
}

export const db = new VbtDatabase();
