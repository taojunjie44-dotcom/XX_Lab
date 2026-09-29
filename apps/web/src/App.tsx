import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Activity, BatteryCharging, CalendarDays, ChevronRight, CircleGauge, Cloud,
  ClipboardCheck, CloudOff, Database, Download, Dumbbell, FileUp, Flame, Gauge,
  HeartPulse, History, Home, Menu, Moon, MoreHorizontal, Plus, RefreshCw,
  Save, Sparkles, Target, Trash2, TrendingUp, Trophy, User, X, Zap, LogOut
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis
} from "recharts";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { db } from "./db";
import { linearRegression, readinessRecommendation, readinessScore, sessionVolume, velocityLoss } from "./lib/metrics";
import { exercises, type AthleteSettings, type ExerciseBlock, type ExerciseName, type ReadinessEntry, type SetEntry, type TrainingSession } from "./types";
import { cacheSnapshot, cloudConfigured, normalizeAccount, pullCloud, pushCloud, readCachedSnapshot, replaceLocal, snapshotLocal, validAccount, type SyncState } from "./sync";

type Page = "dashboard" | "readiness" | "session" | "vbt" | "history" | "data";

const pageMeta: Record<Page, { label: string; eyebrow: string; icon: typeof Home }> = {
  dashboard: { label: "总览", eyebrow: "训练控制台", icon: Home },
  readiness: { label: "状态评估", eyebrow: "每日检查", icon: BatteryCharging },
  session: { label: "训练记录", eyebrow: "实时训练", icon: Dumbbell },
  vbt: { label: "VBT 分析", eyebrow: "负荷–速度画像", icon: Gauge },
  history: { label: "训练历史", eyebrow: "长期趋势", icon: History },
  data: { label: "数据与设置", eyebrow: "本地优先", icon: Database }
};

const fmtDate = (date: string) => format(parseISO(date), "M月d日 EEE", { locale: zhCN });
const today = () => format(new Date(), "yyyy-MM-dd");
const uid = () => crypto.randomUUID();

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <header className="card-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>;
}

function ScoreRing({ value, size = "large" }: { value: number; size?: "large" | "small" }) {
  const color = value >= 85 ? "var(--lime)" : value >= 70 ? "var(--amber)" : "var(--coral)";
  return <div className={`score-ring ${size}`} style={{ "--score": `${value * 3.6}deg`, "--score-color": color } as React.CSSProperties}>
    <div><strong>{value}</strong><span>/100</span></div>
  </div>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return <div className="empty-state"><Icon /><h3>{title}</h3><p>{text}</p></div>;
}

function AppShell({ page, setPage, children, settings, account, syncState, onSync, onLogout }: { page: Page; setPage: (page: Page) => void; children: ReactNode; settings?: AthleteSettings; account: string; syncState: SyncState; onSync: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const navItems = Object.entries(pageMeta) as [Page, (typeof pageMeta)[Page]][];
  return <div className="app-shell">
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <button className="mobile-close" onClick={() => setOpen(false)} aria-label="关闭菜单"><X /></button>
      <div className="brand"><div className="brand-mark"><Activity /></div><div><strong>VELOCITY</strong><span>LAB</span></div></div>
      <nav aria-label="主要导航">
        {navItems.map(([key, item]) => <button key={key} className={page === key ? "active" : ""} onClick={() => { setPage(key); setOpen(false); }}>
          <item.icon /><span>{item.label}</span>{page === key && <ChevronRight className="nav-arrow" />}
        </button>)}
      </nav>
      <button className={`sidebar-status sync-${syncState}`} onClick={onSync}><Cloud /><div><strong>{syncState === "syncing" ? "正在同步" : syncState === "synced" ? "云端已同步" : syncState === "unconfigured" ? "待连接云端" : syncState === "error" ? "同步失败" : "本地已保存"}</strong><span>{syncState === "unconfigured" ? "需要配置同步服务" : "点击立即同步"}</span></div></button>
      <div className="profile"><div className="avatar">{settings?.name?.slice(0, 1) || account.slice(0, 1).toUpperCase()}</div><div><strong>{settings?.name || account}</strong><span>@{account}</span></div><button className="profile-logout" onClick={onLogout} aria-label="退出账号"><LogOut /></button></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><button className="menu-button" onClick={() => setOpen(true)} aria-label="打开菜单"><Menu /></button><div><span>{pageMeta[page].eyebrow}</span><h1>{pageMeta[page].label}</h1></div><div className="date-chip"><CalendarDays />{format(new Date(), "M月d日")}</div></header>
      <main>{children}</main>
    </div>
  </div>;
}

function LoginScreen({ onLogin, busy, error }: { onLogin: (account: string) => void; busy: boolean; error: string }) {
  const [value, setValue] = useState("");
  const valid = validAccount(value);
  return <main className="login-screen">
    <section className="login-panel">
      <div className="login-brand"><div className="brand-mark"><Activity /></div><div><strong>VELOCITY</strong><span>LAB</span></div></div>
      <div className="login-copy"><span className="login-kicker">PERSONAL ATHLETE SYSTEM</span><h1>用一个账号，继续你的训练数据。</h1><p>电脑和手机输入相同账号，即可进入同一份训练记录。</p></div>
      <form onSubmit={(event) => { event.preventDefault(); if (valid) onLogin(normalizeAccount(value)); }}>
        <label><span>账号</span><div className="login-input"><User /><input autoFocus autoComplete="username" placeholder="3–24 位英文、数字、_ 或 -" value={value} onChange={(e) => setValue(e.target.value)} /></div></label>
        {value && !valid && <p className="login-error">请输入至少 3 位英文、数字、下划线或短横线。</p>}
        {error && <p className="login-error">{error}</p>}
        <button className="btn primary full" disabled={!valid || busy}>{busy ? <><RefreshCw className="spin" />正在进入</> : <>进入账号<ChevronRight /></>}</button>
      </form>
      <div className="login-warning"><CloudOff /><p><strong>这是便捷账号，不是安全登录。</strong>任何知道账号名的人都可能访问该账号数据，请不要使用姓名、手机号等敏感信息作为账号。</p></div>
      {!cloudConfigured && <div className="login-setup">当前为本地账号模式；配置云数据库后自动启用跨设备同步。</div>}
    </section>
    <aside className="login-visual"><div className="visual-grid" /><div className="visual-content"><span>READINESS TODAY</span><strong>87</strong><em>/100</em><div className="visual-line"><i /><i /><i /><i /><i /><i /></div><p>状态正常，执行计划并监控速度下降</p></div></aside>
  </main>;
}

function Dashboard({ sessions, readiness, settings, go }: { sessions: TrainingSession[]; readiness: ReadinessEntry[]; settings?: AthleteSettings; go: (page: Page) => void }) {
  const latest = readiness[0];
  const lastSession = sessions[0];
  const trend = [...readiness].reverse().slice(-7).map((r) => ({ date: format(parseISO(r.date), "M/d"), score: r.score, hrv: r.hrv }));
  const weeklyVolume = sessions.filter((s) => (Date.now() - parseISO(s.date).getTime()) / 86400000 < 7).reduce((sum, s) => sum + sessionVolume(s), 0);
  const prs = useMemo(() => {
    const best: Partial<Record<ExerciseName, number>> = {};
    sessions.forEach((session) => session.exercises.forEach((block) => block.sets.forEach((set) => {
      if (set.completed) best[block.exercise] = Math.max(best[block.exercise] || 0, set.weight);
    })));
    return best;
  }, [sessions]);
  return <div className="page-grid dashboard-grid">
    <Card className="readiness-hero">
      <div className="hero-copy"><div className="kicker"><Sparkles /> GOOD MORNING, {settings?.name?.toUpperCase() || "ATHLETE"}</div><h2>今天的身体已经准备好训练。</h2><p>{latest?.recommendation || "完成今日状态评估后获得建议。"}</p><div className="hero-actions"><button className="btn primary" onClick={() => go("session")}><Dumbbell />开始训练</button><button className="btn ghost" onClick={() => go("readiness")}><ClipboardCheck />更新状态</button></div></div>
      <div className="ring-wrap"><ScoreRing value={latest?.score || 0} /><span>训练准备度</span></div>
    </Card>

    <div className="metric-strip">
      <Card><div className="metric-icon lime"><HeartPulse /></div><div><span>HRV</span><strong>{latest?.hrv || "—"}<small> ms</small></strong><em>接近个人基线</em></div></Card>
      <Card><div className="metric-icon blue"><Moon /></div><div><span>睡眠</span><strong>{latest?.sleepHours || "—"}<small> h</small></strong><em>质量 {latest?.sleepQuality || "—"}/5</em></div></Card>
      <Card><div className="metric-icon amber"><Flame /></div><div><span>7日训练量</span><strong>{Math.round(weeklyVolume / 100) / 10}<small> t</small></strong><em>{sessions.filter((s) => (Date.now() - parseISO(s.date).getTime()) / 86400000 < 7).length} 次训练</em></div></Card>
      <Card><div className="metric-icon violet"><Trophy /></div><div><span>本期最佳</span><strong>{prs.深蹲 || "—"}<small> kg</small></strong><em>深蹲负重</em></div></Card>
    </div>

    <Card className="trend-card">
      <CardHeader title="准备度趋势" subtitle="最近 7 次状态评估" action={<span className="legend-dot"><i />准备度</span>} />
      <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 12, right: 8, left: -26, bottom: 0 }}><defs><linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8bc34a" stopOpacity={0.32} /><stop offset="100%" stopColor="#8bc34a" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} /><YAxis domain={[50, 100]} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--line)" }} /><ReferenceLine y={70} stroke="var(--amber)" strokeDasharray="4 4" /><Area type="monotone" dataKey="score" stroke="#6e9f2b" strokeWidth={3} fill="url(#readinessFill)" activeDot={{ r: 5 }} /></AreaChart></ResponsiveContainer></div>
    </Card>

    <Card className="today-card">
      <CardHeader title="今日计划" subtitle="下肢力量 · 预计 70 分钟" action={<button className="icon-button"><MoreHorizontal /></button>} />
      <div className="plan-feature"><div className="plan-number">01</div><div><span>主项</span><h3>高杠深蹲</h3><p>4 × 3 · 目标速度 0.42–0.55 m/s</p></div><div className="target-load"><span>建议负荷</span><strong>135–145<small> kg</small></strong></div></div>
      <div className="plan-row"><span>02</span><div><strong>罗马尼亚硬拉</strong><small>3 × 6 · RPE 7</small></div><ChevronRight /></div>
      <div className="plan-row"><span>03</span><div><strong>保加利亚分腿蹲</strong><small>3 × 8 / 侧</small></div><ChevronRight /></div>
      <button className="btn primary full" onClick={() => go("session")}><Zap />进入训练模式</button>
    </Card>

    <Card className="performance-card">
      <CardHeader title="能力快照" subtitle="近期最佳表现" action={<button className="text-button" onClick={() => go("vbt")}>查看画像 <ChevronRight /></button>} />
      <div className="performance-list">
        {[{ name: "深蹲", value: prs.深蹲, velocity: "0.39 m/s", tone: "lime" }, { name: "卧推", value: prs.卧推, velocity: "0.31 m/s", tone: "blue" }, { name: "高抓", value: prs.高抓, velocity: "1.96 m/s", tone: "amber" }].map((item, i) => <div className="performance-row" key={item.name}><div className={`rank ${item.tone}`}>{i + 1}</div><div><strong>{item.name}</strong><span>近期最佳组</span></div><div className="perf-value"><strong>{item.value || "—"}<small> kg</small></strong><span>{item.velocity}</span></div></div>)}
      </div>
    </Card>

    <Card className="recent-card">
      <CardHeader title="最近训练" subtitle="自动保存在本机" action={<button className="text-button" onClick={() => go("history")}>全部记录 <ChevronRight /></button>} />
      {lastSession ? <div className="recent-session"><div className="session-date"><strong>{format(parseISO(lastSession.date), "dd")}</strong><span>{format(parseISO(lastSession.date), "MMM", { locale: zhCN })}</span></div><div className="session-main"><strong>{lastSession.type}</strong><span>{lastSession.exercises.map((e) => e.exercise).join(" · ")}</span></div><div className="session-meta"><span>{lastSession.duration} 分钟</span><strong>{Math.round(sessionVolume(lastSession) / 100) / 10} t</strong></div></div> : <EmptyState icon={History} title="暂无训练记录" text="完成第一节训练后会显示在这里。" />}
    </Card>
  </div>;
}

function ReadinessPage({ latest, onChanged }: { latest?: ReadinessEntry; onChanged: () => void }) {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ date: today(), sleepHours: latest?.sleepHours ?? 7.5, sleepQuality: latest?.sleepQuality ?? 4, fatigue: 2, soreness: 2, stress: 2, hrv: latest?.hrv ?? 62, restingHr: latest?.restingHr ?? 58 });
  const score = readinessScore(form);
  const recommendation = readinessRecommendation(score);
  const update = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: typeof current[key] === "number" ? Number(value) : value }));
  const submit = async () => { const existing = await db.readiness.where("date").equals(form.date).first(); if (existing?.id) await db.readiness.update(existing.id, { ...form, score, recommendation }); else await db.readiness.add({ ...form, score, recommendation }); onChanged(); setSaved(true); setTimeout(() => setSaved(false), 2400); };
  return <div className="readiness-layout">
    <Card className="assessment-card"><CardHeader title="今日状态检查" subtitle="约 30 秒完成，所有数据只保存在你的设备" />
      <div className="assessment-section"><h3>恢复基础</h3><div className="form-grid three"><label><span>睡眠时长</span><div className="input-unit"><input type="number" step="0.1" min="0" max="14" value={form.sleepHours} onChange={(e) => update("sleepHours", e.target.value)} /><em>小时</em></div></label><label><span>HRV</span><div className="input-unit"><input type="number" min="1" value={form.hrv} onChange={(e) => update("hrv", e.target.value)} /><em>ms</em></div></label><label><span>静息心率</span><div className="input-unit"><input type="number" min="30" value={form.restingHr} onChange={(e) => update("restingHr", e.target.value)} /><em>bpm</em></div></label></div></div>
      <div className="assessment-section"><h3>主观感受</h3>{([['sleepQuality','睡眠质量','差','很好'],['fatigue','整体疲劳','轻松','很疲劳'],['soreness','肌肉酸痛','无','严重'],['stress','心理压力','轻松','很高']] as const).map(([key,label,left,right]) => <div className="range-field" key={key}><div><span>{label}</span><strong>{form[key]} / 5</strong></div><input type="range" min="1" max="5" value={form[key]} onChange={(e) => update(key, e.target.value)} /><div className="range-labels"><span>{left}</span><span>{right}</span></div></div>)}</div>
      <button className="btn primary full" onClick={submit}><Save />{saved ? "已保存" : "保存今日状态"}</button>
    </Card>
    <div className="assessment-result"><Card className="result-card"><span className="result-kicker">实时结果</span><ScoreRing value={score} /><h2>{score >= 85 ? "状态很好" : score >= 70 ? "可以训练" : score >= 55 ? "适当减量" : "恢复优先"}</h2><p>{recommendation}</p><div className="decision-list"><div><Activity /><span>训练强度</span><strong>{score >= 85 ? "100%" : score >= 70 ? "90–100%" : score >= 55 ? "75–90%" : "≤70%"}</strong></div><div><Target /><span>冲重建议</span><strong>{score >= 85 ? "可选" : "不建议"}</strong></div><div><RefreshCw /><span>组间监控</span><strong>速度损失 ≤20%</strong></div></div></Card></div>
  </div>;
}

const blankSet = (): SetEntry => ({ id: uid(), weight: 100, reps: 3, velocity: 0.5, rpe: 7, completed: true });
const blankBlock = (): ExerciseBlock => ({ id: uid(), exercise: "深蹲", sets: [blankSet()] });

function SessionPage({ onSaved }: { onSaved: () => void }) {
  const [session, setSession] = useState<TrainingSession>({ date: today(), type: "下肢力量", duration: 60, notes: "", exercises: [blankBlock()], completed: false });
  const [message, setMessage] = useState("");
  const updateBlock = (blockId: string, fn: (block: ExerciseBlock) => ExerciseBlock) => setSession((s) => ({ ...s, exercises: s.exercises.map((b) => b.id === blockId ? fn(b) : b) }));
  const updateSet = (blockId: string, setId: string, key: keyof SetEntry, value: number | boolean) => updateBlock(blockId, (block) => ({ ...block, sets: block.sets.map((set) => set.id === setId ? { ...set, [key]: value } : set) }));
  const save = async () => { if (!session.exercises.some((b) => b.sets.some((s) => s.completed))) { setMessage("至少完成一组后才能保存训练。"); return; } await db.sessions.add({ ...session, completed: true }); setMessage("训练已保存到本机数据库。"); onSaved(); };
  return <div className="session-layout">
    <Card className="session-control"><CardHeader title="本次训练" subtitle="输入每组最快一次平均向心速度" />
      <div className="form-grid three"><label><span>日期</span><input type="date" value={session.date} onChange={(e) => setSession({ ...session, date: e.target.value })} /></label><label><span>训练类型</span><select value={session.type} onChange={(e) => setSession({ ...session, type: e.target.value as TrainingSession["type"] })}>{["下肢力量","上肢力量","举重技术","测试","恢复"].map((type) => <option key={type}>{type}</option>)}</select></label><label><span>时长</span><div className="input-unit"><input type="number" value={session.duration} onChange={(e) => setSession({ ...session, duration: Number(e.target.value) })} /><em>分钟</em></div></label></div>
    </Card>
    {session.exercises.map((block, blockIndex) => { const loss = velocityLoss(block.sets.filter((s) => s.completed)); return <Card className="exercise-card" key={block.id}>
      <div className="exercise-head"><div className="exercise-order">{String(blockIndex + 1).padStart(2,"0")}</div><div><label className="select-label">训练动作<select value={block.exercise} onChange={(e) => updateBlock(block.id, (b) => ({ ...b, exercise: e.target.value as ExerciseName }))}>{exercises.map((name) => <option key={name}>{name}</option>)}</select></label><span>{block.sets.length} 组 · 当前速度损失 {loss.toFixed(1)}%</span></div><div className={`loss-badge ${loss > 20 ? "danger" : loss > 10 ? "warn" : "good"}`}><Gauge /><strong>{loss.toFixed(0)}%</strong><span>速度损失</span></div></div>
      <div className="set-table"><div className="set-row set-header"><span>组</span><span>负重</span><span>次数</span><span>速度 m/s</span><span>RPE</span><span>状态</span><span /></div>{block.sets.map((set, index) => <div className="set-row" key={set.id}><strong>{index + 1}</strong><input aria-label={`第${index+1}组负重`} type="number" value={set.weight} onChange={(e) => updateSet(block.id, set.id, "weight", Number(e.target.value))} /><input aria-label={`第${index+1}组次数`} type="number" value={set.reps} onChange={(e) => updateSet(block.id, set.id, "reps", Number(e.target.value))} /><input aria-label={`第${index+1}组速度`} type="number" step="0.01" value={set.velocity} onChange={(e) => updateSet(block.id, set.id, "velocity", Number(e.target.value))} /><input aria-label={`第${index+1}组RPE`} type="number" step="0.5" min="1" max="10" value={set.rpe} onChange={(e) => updateSet(block.id, set.id, "rpe", Number(e.target.value))} /><label className="check"><input type="checkbox" checked={set.completed} onChange={(e) => updateSet(block.id, set.id, "completed", e.target.checked)} /><span>完成</span></label><button className="icon-button danger" onClick={() => updateBlock(block.id, (b) => ({ ...b, sets: b.sets.filter((s) => s.id !== set.id) }))} aria-label="删除组"><Trash2 /></button></div>)}</div>
      <button className="btn ghost add-set" onClick={() => updateBlock(block.id, (b) => ({ ...b, sets: [...b.sets, { ...blankSet(), weight: b.sets.at(-1)?.weight || 100 }] }))}><Plus />添加一组</button>
    </Card>})}
    <button className="add-exercise" onClick={() => setSession((s) => ({ ...s, exercises: [...s.exercises, blankBlock()] }))}><Plus /><span>添加训练动作</span></button>
    <Card className="session-finish"><label><span>训练备注</span><textarea placeholder="记录技术感受、疼痛或计划调整…" value={session.notes} onChange={(e) => setSession({ ...session, notes: e.target.value })} /></label><div><p className={message.includes("至少") ? "error" : "success"}>{message}</p><button className="btn primary" onClick={save}><Save />完成并保存训练</button></div></Card>
  </div>;
}

function VbtPage({ sessions, settings }: { sessions: TrainingSession[]; settings?: AthleteSettings }) {
  const [exercise, setExercise] = useState<ExerciseName>("深蹲");
  const points = useMemo(() => sessions.flatMap((session) => session.exercises.filter((b) => b.exercise === exercise).flatMap((b) => b.sets.filter((s) => s.completed && s.weight > 0 && s.velocity > 0).map((s) => ({ weight: s.weight, velocity: s.velocity, date: session.date })))).sort((a,b) => a.weight - b.weight), [sessions, exercise]);
  const regression = linearRegression(points, settings?.mvt[exercise] ?? 0.3);
  const lineData = regression && points.length ? [{ weight: Math.min(...points.map((p) => p.weight)) - 5, velocity: regression.slope * (Math.min(...points.map((p) => p.weight)) - 5) + regression.intercept }, { weight: regression.estimated1RM, velocity: settings?.mvt[exercise] ?? 0.3 }] : [];
  return <div className="vbt-layout">
    <Card className="profile-controls"><div><span>动作画像</span><select value={exercise} onChange={(e) => setExercise(e.target.value as ExerciseName)}>{exercises.map((name) => <option key={name}>{name}</option>)}</select></div><div className="profile-status"><span className="status-dot" />{points.length >= 4 ? "画像数据充足" : "需要更多数据"}</div></Card>
    <div className="metric-strip vbt-metrics"><Card><div className="metric-icon lime"><Trophy /></div><div><span>估算 1RM</span><strong>{regression ? regression.estimated1RM.toFixed(1) : "—"}<small> kg</small></strong><em>基于个人 LVP</em></div></Card><Card><div className="metric-icon blue"><Target /></div><div><span>最小速度阈值</span><strong>{settings?.mvt[exercise] ?? "—"}<small> m/s</small></strong><em>{exercise}专属</em></div></Card><Card><div className="metric-icon amber"><CircleGauge /></div><div><span>模型拟合度</span><strong>{regression ? (regression.r2 * 100).toFixed(0) : "—"}<small>%</small></strong><em>{points.length} 个有效观测</em></div></Card></div>
    <Card className="lvp-chart"><CardHeader title={`${exercise} 负荷–速度画像`} subtitle="每个点代表一组最快重复；虚线为个人回归趋势" />
      {points.length >= 2 ? <div className="chart-box tall"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis type="number" dataKey="weight" name="负重" unit="kg" domain={["dataMin - 10", "dataMax + 15"]} tickFormatter={(value) => Math.round(value).toString()} tick={{ fill: "var(--muted)", fontSize: 12 }} /><YAxis type="number" dataKey="velocity" name="速度" unit="m/s" domain={[0, "dataMax + 0.15"]} tickFormatter={(value) => Number(value).toFixed(2)} tick={{ fill: "var(--muted)", fontSize: 12 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value) => typeof value === "number" ? value.toFixed(2) : value} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)" }} /><Scatter name="训练组" data={points} fill="#173f31">{points.map((_, index) => <Cell key={index} fill={index === points.length - 1 ? "#98cf4f" : "#173f31"} />)}</Scatter><Line data={lineData} type="linear" dataKey="velocity" stroke="#e79545" strokeWidth={2} strokeDasharray="6 5" dot={false} activeDot={false} legendType="none" /></ScatterChart></ResponsiveContainer></div> : <EmptyState icon={TrendingUp} title="还无法建立画像" text="至少记录两组不同负重与速度数据。" />}
    </Card>
    <Card className="prediction-card"><CardHeader title="今日负重预测" subtitle="根据当前个人回归模型估算" />{regression ? <div className="prediction-list">{[0.6,0.5,0.4,0.3].map((velocity) => { const weight = (velocity-regression.intercept)/regression.slope; return <div key={velocity}><span>{velocity.toFixed(2)} m/s</span><div className="prediction-line"><i style={{ width: `${Math.max(20, Math.min(100, weight/regression.estimated1RM*100))}%` }} /></div><strong>{weight.toFixed(0)} kg</strong></div>})}</div> : <p className="muted-copy">记录更多训练数据后显示。</p>}</Card>
    <Card className="model-note"><Zap /><div><strong>模型解释</strong><p>e1RM 由个人负荷–速度直线与 MVT 的交点估算。这里只作为训练决策辅助，不替代实际测试；当 R² 低于 0.80 时建议补充不同负荷区间的数据。</p></div></Card>
  </div>;
}

function HistoryPage({ sessions, onChanged }: { sessions: TrainingSession[]; onChanged: () => void }) {
  const [filter, setFilter] = useState<"全部" | TrainingSession["type"]>("全部");
  const [expanded, setExpanded] = useState<number | null>(null);
  const visible = filter === "全部" ? sessions : sessions.filter((s) => s.type === filter);
  const remove = async (id?: number) => { if (!id || !window.confirm("确定删除这条训练记录吗？此操作不可撤销。")) return; await db.sessions.delete(id); onChanged(); };
  return <div className="history-layout"><Card><CardHeader title="训练记录" subtitle={`${sessions.length} 次训练已保存在本机`} action={<select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option>全部</option>{["下肢力量","上肢力量","举重技术","测试","恢复"].map((type) => <option key={type}>{type}</option>)}</select>} />
    <div className="history-list">{visible.map((session) => <article className={`history-item ${expanded === session.id ? "expanded" : ""}`} key={session.id}><button className="history-summary" onClick={() => setExpanded(expanded === session.id ? null : session.id || null)}><div className="history-date"><strong>{format(parseISO(session.date), "dd")}</strong><span>{format(parseISO(session.date), "MMM", { locale: zhCN })}</span></div><div><strong>{session.type}</strong><span>{session.exercises.map((b) => b.exercise).join(" · ")}</span></div><div className="history-stat"><span>训练量</span><strong>{Math.round(sessionVolume(session)/100)/10} t</strong></div><div className="history-stat"><span>时长</span><strong>{session.duration} min</strong></div><ChevronRight /></button>{expanded === session.id && <div className="history-detail">{session.exercises.map((block) => <div key={block.id}><h4>{block.exercise}</h4><div className="mini-sets">{block.sets.filter((s) => s.completed).map((set, i) => <span key={set.id}>{i+1}. {set.weight}kg × {set.reps} · {set.velocity.toFixed(2)}m/s</span>)}</div></div>)}{session.notes && <p>备注：{session.notes}</p>}<button className="btn danger-outline" onClick={() => remove(session.id)}><Trash2 />删除记录</button></div>}</article>)}{visible.length === 0 && <EmptyState icon={History} title="没有匹配记录" text="调整筛选条件或开始一节新训练。" />}</div>
  </Card></div>;
}

function DataPage({ settings, onChanged, cloudEnabled }: { settings?: AthleteSettings; onChanged: () => void; cloudEnabled: boolean }) {
  const [form, setForm] = useState<AthleteSettings | undefined>(settings);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setForm(settings), [settings]);
  if (!form) return null;
  const saveSettings = async () => { await db.settings.put(form); onChanged(); setStatus("设置已保存并等待同步"); };
  const exportJson = async () => { const payload = { version: 1, exportedAt: new Date().toISOString(), sessions: await db.sessions.toArray(), readiness: await db.readiness.toArray(), settings: await db.settings.toArray() }; download(`velocity-lab-${today()}.json`, JSON.stringify(payload, null, 2), "application/json"); };
  const exportCsv = async () => { const rows = [["date","session_type","exercise","set","weight","reps","velocity","rpe","volume"]]; (await db.sessions.toArray()).forEach((s) => s.exercises.forEach((b) => b.sets.forEach((set,i) => rows.push([s.date,s.type,b.exercise,String(i+1),String(set.weight),String(set.reps),String(set.velocity),String(set.rpe),String(set.weight*set.reps)])))); download(`velocity-lab-sets-${today()}.csv`, rows.map((r) => r.join(",")).join("\n"), "text/csv"); };
  const importJson = async (file?: File) => { if (!file) return; try { const payload = JSON.parse(await file.text()); if (!Array.isArray(payload.sessions) || !Array.isArray(payload.readiness)) throw new Error(); await db.transaction("rw", db.sessions, db.readiness, db.settings, async () => { await db.sessions.clear(); await db.readiness.clear(); if (payload.sessions.length) await db.sessions.bulkAdd(payload.sessions); if (payload.readiness.length) await db.readiness.bulkAdd(payload.readiness); if (payload.settings?.length) await db.settings.bulkPut(payload.settings); }); onChanged(); setStatus("数据导入完成并等待同步"); } catch { setStatus("导入失败：文件格式不正确"); } };
  const clearData = async () => { if (!window.confirm("这会删除所有训练与状态记录。请先导出备份，确定继续吗？")) return; await db.sessions.clear(); await db.readiness.clear(); onChanged(); setStatus("训练数据已清空并等待同步"); };
  return <div className="data-layout"><Card><CardHeader title="运动员档案" subtitle="用于个体化计算与界面显示" /><div className="form-grid three"><label><span>姓名</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label><span>体重</span><div className="input-unit"><input type="number" step="0.1" value={form.bodyWeight} onChange={(e) => setForm({ ...form, bodyWeight: Number(e.target.value) })} /><em>kg</em></div></label><label><span>单位</span><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as "kg" | "lb" })}><option value="kg">公斤 kg</option><option value="lb">磅 lb</option></select></label></div><button className="btn primary" onClick={saveSettings}><Save />保存档案</button></Card>
    <Card><CardHeader title="动作 MVT" subtitle="速度达到该阈值时视为接近最大负荷" /><div className="mvt-grid">{exercises.map((name) => <label key={name}><span>{name}</span><div className="input-unit"><input type="number" step="0.01" value={form.mvt[name]} onChange={(e) => setForm({ ...form, mvt: { ...form.mvt, [name]: Number(e.target.value) } })} /><em>m/s</em></div></label>)}</div><button className="btn primary" onClick={saveSettings}><Save />保存阈值</button></Card>
    <Card><CardHeader title="备份与迁移" subtitle="建议每周导出一次完整 JSON 备份" /><div className="data-actions"><button className="btn primary" onClick={exportJson}><Download />导出完整备份</button><button className="btn ghost" onClick={exportCsv}><Download />导出训练 CSV</button><button className="btn ghost" onClick={() => fileRef.current?.click()}><FileUp />导入 JSON</button><input ref={fileRef} hidden type="file" accept="application/json" onChange={(e) => importJson(e.target.files?.[0])} /></div><div className="local-note">{cloudEnabled ? <Cloud /> : <CloudOff />}<div><strong>{cloudEnabled ? "本地优先 + 云端同步" : "仅本地模式"}</strong><span>{cloudEnabled ? "修改会自动同步，离线时仍可继续记录。" : "配置 Supabase 后启用跨设备同步。"}</span></div></div></Card>
    <Card className="danger-zone"><CardHeader title="危险操作" subtitle="清空后只能通过此前导出的 JSON 恢复" /><button className="btn danger-outline" onClick={clearData}><Trash2 />清空训练与状态数据</button></Card>{status && <div className="toast" role="status">{status}</div>}</div>;
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

function defaultSettings(account: string): AthleteSettings {
  return {
    id: "athlete",
    name: account,
    bodyWeight: 75,
    unit: "kg",
    theme: "light",
    mvt: { 深蹲: 0.3, 卧推: 0.17, 硬拉: 0.15, 高抓: 1.7, 高翻: 1.3 }
  };
}

async function clearForNewAccount(account: string) {
  await db.transaction("rw", db.sessions, db.readiness, db.settings, async () => {
    await db.sessions.clear();
    await db.readiness.clear();
    await db.settings.clear();
    await db.settings.put(defaultSettings(account));
  });
}

export default function App() {
  const [page, setPage] = useState<Page>(() => (location.hash.slice(1) as Page) || "dashboard");
  const [account, setAccount] = useState<string | null>(() => localStorage.getItem("velocity-lab:account"));
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [syncState, setSyncState] = useState<SyncState>(() => cloudConfigured ? "idle" : "unconfigured");
  const syncTimer = useRef<number | undefined>(undefined);
  const sessions = useLiveQuery(() => db.sessions.orderBy("date").reverse().toArray(), []) || [];
  const readiness = useLiveQuery(() => db.readiness.orderBy("date").reverse().toArray(), []) || [];
  const settings = useLiveQuery(() => db.settings.get("athlete"), []);
  useEffect(() => { location.hash = page; window.scrollTo({ top: 0, behavior: "smooth" }); }, [page]);
  useEffect(() => { const onHash = () => { const next = location.hash.slice(1) as Page; if (pageMeta[next]) setPage(next); }; addEventListener("hashchange", onHash); return () => removeEventListener("hashchange", onHash); }, []);
  useEffect(() => { if (!settings) return; const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [settings]);

  const syncNow = async (targetAccount = account) => {
    if (!targetAccount) return;
    setSyncState("syncing");
    try {
      const snapshot = await snapshotLocal();
      const uploaded = await pushCloud(targetAccount, snapshot);
      setSyncState(uploaded ? "synced" : "unconfigured");
    } catch {
      setSyncState(navigator.onLine ? "error" : "offline");
    }
  };

  const queueSync = () => {
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => void syncNow(), 350);
  };

  const login = async (requestedAccount: string) => {
    const nextAccount = normalizeAccount(requestedAccount);
    if (!validAccount(nextAccount)) return;
    setLoginBusy(true);
    setLoginError("");
    setSyncState(cloudConfigured ? "syncing" : "unconfigured");
    try {
      const previousAccount = localStorage.getItem("velocity-lab:account");
      if (previousAccount && previousAccount !== nextAccount) {
        const previousSnapshot = await snapshotLocal();
        cacheSnapshot(previousAccount, previousSnapshot);
        try { await pushCloud(previousAccount, previousSnapshot); } catch { /* local cache remains available */ }
      }

      let remote = null;
      if (cloudConfigured) remote = await pullCloud(nextAccount);
      const cached = readCachedSnapshot(nextAccount);
      const initialClaimed = localStorage.getItem("velocity-lab:initial-claimed") === "true";

      if (remote) {
        await replaceLocal(remote);
        cacheSnapshot(nextAccount, remote);
      } else if (cached) {
        await replaceLocal(cached);
      } else if (!initialClaimed && !previousAccount) {
        localStorage.setItem("velocity-lab:initial-claimed", "true");
      } else {
        await clearForNewAccount(nextAccount);
      }

      localStorage.setItem("velocity-lab:account", nextAccount);
      setAccount(nextAccount);
      const snapshot = await snapshotLocal();
      const uploaded = await pushCloud(nextAccount, snapshot);
      setSyncState(uploaded ? "synced" : "unconfigured");
    } catch {
      setLoginError("暂时无法连接云端，请检查网络或稍后再试。");
      setSyncState("error");
    } finally {
      setLoginBusy(false);
    }
  };

  const logout = async () => {
    if (!account) return;
    const snapshot = await snapshotLocal();
    cacheSnapshot(account, snapshot);
    try { await pushCloud(account, snapshot); } catch { /* keep the local cache */ }
    localStorage.removeItem("velocity-lab:account");
    await db.transaction("rw", db.sessions, db.readiness, db.settings, async () => {
      await db.sessions.clear();
      await db.readiness.clear();
      await db.settings.clear();
    });
    setAccount(null);
    setPage("dashboard");
  };

  useEffect(() => {
    if (!account || !cloudConfigured) return;
    let cancelled = false;
    setSyncState("syncing");
    pullCloud(account).then(async (remote) => {
      if (cancelled) return;
      if (remote) { await replaceLocal(remote); cacheSnapshot(account, remote); }
      setSyncState("synced");
    }).catch(() => { if (!cancelled) setSyncState(navigator.onLine ? "error" : "offline"); });
    return () => { cancelled = true; };
  }, [account]);

  if (!account) return <LoginScreen onLogin={login} busy={loginBusy} error={loginError} />;

  return <AppShell page={page} setPage={setPage} settings={settings} account={account} syncState={syncState} onSync={() => void syncNow()} onLogout={() => void logout()}>
    {page === "dashboard" && <Dashboard sessions={sessions} readiness={readiness} settings={settings} go={setPage} />}
    {page === "readiness" && <ReadinessPage latest={readiness[0]} onChanged={queueSync} />}
    {page === "session" && <SessionPage onSaved={() => { queueSync(); setPage("history"); }} />}
    {page === "vbt" && <VbtPage sessions={sessions} settings={settings} />}
    {page === "history" && <HistoryPage sessions={sessions} onChanged={queueSync} />}
    {page === "data" && <DataPage settings={settings} onChanged={queueSync} cloudEnabled={cloudConfigured} />}
  </AppShell>;
}
