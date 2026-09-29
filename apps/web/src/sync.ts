import { db } from "./db";
import type { AthleteSettings, ReadinessEntry, TrainingSession } from "./types";

export interface CloudSnapshot {
  version: 1;
  updatedAt: string;
  sessions: TrainingSession[];
  readiness: ReadinessEntry[];
  settings: AthleteSettings[];
}

export type SyncState = "idle" | "syncing" | "synced" | "offline" | "error" | "unconfigured";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const cloudConfigured = Boolean(supabaseUrl && supabaseKey);

function headers(extra?: Record<string, string>) {
  return {
    apikey: supabaseKey || "",
    Authorization: `Bearer ${supabaseKey || ""}`,
    "Content-Type": "application/json",
    ...extra
  };
}

export function normalizeAccount(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function validAccount(value: string) {
  return /^[a-z0-9_-]{3,24}$/.test(normalizeAccount(value));
}

export async function snapshotLocal(): Promise<CloudSnapshot> {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sessions: await db.sessions.toArray(),
    readiness: await db.readiness.toArray(),
    settings: await db.settings.toArray()
  };
}

export async function replaceLocal(snapshot: CloudSnapshot) {
  await db.transaction("rw", db.sessions, db.readiness, db.settings, async () => {
    await db.sessions.clear();
    await db.readiness.clear();
    await db.settings.clear();
    if (snapshot.sessions?.length) await db.sessions.bulkAdd(snapshot.sessions.map(({ id: _id, ...session }) => session));
    if (snapshot.readiness?.length) await db.readiness.bulkAdd(snapshot.readiness.map(({ id: _id, ...entry }) => entry));
    if (snapshot.settings?.length) await db.settings.bulkPut(snapshot.settings);
  });
}

export function cacheSnapshot(account: string, snapshot: CloudSnapshot) {
  localStorage.setItem(`velocity-lab:cache:${account}`, JSON.stringify(snapshot));
}

export function readCachedSnapshot(account: string): CloudSnapshot | null {
  try {
    const raw = localStorage.getItem(`velocity-lab:cache:${account}`);
    return raw ? JSON.parse(raw) as CloudSnapshot : null;
  } catch {
    return null;
  }
}

export async function pullCloud(account: string): Promise<CloudSnapshot | null> {
  if (!cloudConfigured) return null;
  const response = await fetch(`${supabaseUrl}/rest/v1/athlete_data?account=eq.${encodeURIComponent(account)}&select=payload&limit=1`, {
    headers: headers()
  });
  if (!response.ok) throw new Error(`Cloud pull failed: ${response.status}`);
  const rows = await response.json() as { payload: CloudSnapshot }[];
  return rows[0]?.payload || null;
}

export async function pushCloud(account: string, snapshot: CloudSnapshot) {
  cacheSnapshot(account, snapshot);
  if (!cloudConfigured) return false;
  const response = await fetch(`${supabaseUrl}/rest/v1/athlete_data?on_conflict=account`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ account, payload: snapshot, updated_at: snapshot.updatedAt })
  });
  if (!response.ok) throw new Error(`Cloud push failed: ${response.status}`);
  return true;
}
