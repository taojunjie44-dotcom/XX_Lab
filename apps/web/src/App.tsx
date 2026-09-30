import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Activity, BatteryCharging, CalendarDays, ChevronRight, CircleGauge, Cloud,
  ClipboardCheck, CloudOff, Database, Download, Dumbbell, FileUp, Flame, Gauge,
  HeartPulse, History, Home, Info, Menu, Moon, MoreHorizontal, Plus, RefreshCw,
  Save, Smartphone, Sparkles, Target, Trash2, TrendingUp, Trophy, User, X, Zap, LogOut
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis
} from "recharts";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { db } from "./db";
import { linearRegression, performanceReadiness, readinessRecommendation, readinessScore, sessionVolume } from "./lib/metrics";
import { defaultMvtFor, exerciseGroups, vbtExercises } from "./exerciseCatalog";
import { type AthleteSettings, type ExerciseBlock, type ExerciseName, type PersonalRecord, type ReadinessEntry, type SetEntry, type TrainingSession, type TrainingType } from "./types";
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
const trainingTypes: TrainingType[] = ["下肢力量", "上肢力量", "全身力量", "举重技术", "速度力量", "增强式", "体能", "测试", "恢复", "其他"];

function ExerciseSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const groupForValue = exerciseGroups.find((group) => group.exercises.some((exercise) => exercise.name === value)) ?? exerciseGroups[0];
  const [category, setCategory] = useState(groupForValue.category);
  useEffect(() => setCategory(groupForValue.category), [groupForValue.category]);
  const group = exerciseGroups.find((item) => item.category === category) ?? exerciseGroups[0];
  return <div className="exercise-picker">
    <select aria-label="动作类别" value={group.category} onChange={(event) => { const next = exerciseGroups.find((item) => item.category === event.target.value) ?? exerciseGroups[0]; setCategory(next.category); onChange(next.exercises[0].name); }}>
      {exerciseGroups.map((item) => <option key={item.category} value={item.category}>{item.category}</option>)}
    </select>
    <select aria-label="训练动作" value={group.exercises.some((exercise) => exercise.name === value) ? value : group.exercises[0].name} onChange={(event) => onChange(event.target.value)}>
      {group.exercises.map((exercise) => <option key={exercise.name} value={exercise.name}>{exercise.name}</option>)}
    </select>
  </div>;
}

function DecimalInput({ value, onValue, ariaLabel, placeholder = "0.00", min = 0, max }: { value: number; onValue: (value: number) => void; ariaLabel: string; placeholder?: string; min?: number; max?: number }) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : "");
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value > 0 ? String(value) : ""); }, [value]);
  return <input
    aria-label={ariaLabel}
    type="text"
    inputMode="decimal"
    placeholder={placeholder}
    value={draft}
    onFocus={() => { focused.current = true; }}
    onChange={(event) => {
      const next = event.target.value.replace(",", ".");
      if (!/^\d*(\.\d*)?$/.test(next)) return;
      setDraft(next);
      if (next === "" || next === ".") onValue(0);
      else {
        const parsed = Number(next);
        if (Number.isFinite(parsed)) onValue(Math.min(max ?? parsed, Math.max(min, parsed)));
      }
    }}
    onBlur={() => {
      focused.current = false;
      const parsed = Number(draft);
      const normalized = Number.isFinite(parsed) ? Math.min(max ?? parsed, Math.max(min, parsed)) : 0;
      onValue(normalized);
      setDraft(normalized > 0 ? String(normalized) : "");
    }}
  />;
}

function exerciseMvt(settings: AthleteSettings | undefined, exercise: string) {
  return settings?.mvt?.[exercise] ?? defaultMvtFor(exercise);
}

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
  const lastSession = sessions.find((session) => session.completed);
  const nextPlan = [...sessions].filter((session) => !session.completed && session.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const trend = [...readiness].reverse().slice(-7).map((r) => ({ date: format(parseISO(r.date), "M/d"), score: r.score, hrv: r.hrv }));
  const weeklySessions = sessions.filter((s) => s.completed && (Date.now() - parseISO(s.date).getTime()) / 86400000 >= 0 && (Date.now() - parseISO(s.date).getTime()) / 86400000 < 7);
  const weeklyVolume = weeklySessions.reduce((sum, s) => sum + sessionVolume(s), 0);
  const performanceByExercise = useMemo(() => {
    const best: Record<string, { weight: number; velocity?: number; date: string; source: "训练记录" | "手动 PR" }> = {};
    sessions.filter((session) => session.completed).forEach((session) => session.exercises.forEach((block) => block.sets.forEach((set) => {
      if (!set.completed || set.weight <= 0) return;
      const current = best[block.exercise];
      if (!current || set.weight > current.weight || (set.weight === current.weight && session.date > current.date)) best[block.exercise] = { weight: set.weight, velocity: set.velocity > 0 ? set.velocity : undefined, date: session.date, source: "训练记录" };
    })));
    (settings?.personalRecords ?? []).forEach((record) => {
      if (record.weight <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return;
      const current = best[record.exercise];
      if (!current || record.weight > current.weight || (record.weight === current.weight && record.date > current.date)) best[record.exercise] = { weight: record.weight, date: record.date, source: "手动 PR" };
    });
    return best;
  }, [sessions, settings?.personalRecords]);
  const performanceRows = Object.entries(performanceByExercise).sort((a, b) => b[1].date.localeCompare(a[1].date)).slice(0, 3);
  return <div className="page-grid dashboard-grid">
    <Card className="readiness-hero">
      <div className="hero-copy"><div className="kicker"><Sparkles /> GOOD MORNING, {settings?.name?.toUpperCase() || "ATHLETE"}</div><h2>今天的身体已经准备好训练。</h2><p>{latest?.recommendation || "完成今日状态评估后获得建议。"}</p><div className="hero-actions"><button className="btn primary" onClick={() => go("session")}><Dumbbell />开始训练</button><button className="btn ghost" onClick={() => go("readiness")}><ClipboardCheck />更新状态</button></div></div>
      <div className="ring-wrap"><ScoreRing value={latest?.score || 0} /><span>训练准备度</span></div>
    </Card>

    <div className="metric-strip">
      <Card><div className="metric-icon lime"><HeartPulse /></div><div><span>HRV</span><strong>{latest?.hrv || "—"}<small> ms</small></strong><em>接近个人基线</em></div></Card>
      <Card><div className="metric-icon blue"><Moon /></div><div><span>睡眠</span><strong>{latest?.sleepHours || "—"}<small> h</small></strong><em>质量 {latest?.sleepQuality || "—"}/5</em></div></Card>
      <Card><div className="metric-icon amber"><Flame /></div><div><span>7日训练量</span><strong>{Math.round(weeklyVolume / 100) / 10}<small> t</small></strong><em>{weeklySessions.length} 次训练</em></div></Card>
      <Card><div className="metric-icon violet"><Trophy /></div><div><span>深蹲最佳</span><strong>{performanceByExercise.深蹲?.weight || "—"}<small> kg</small></strong><em>{performanceByExercise.深蹲 ? fmtDate(performanceByExercise.深蹲.date) : "尚无记录"}</em></div></Card>
    </div>

    <Card className="trend-card">
      <CardHeader title="准备度趋势" subtitle="最近 7 次状态评估" action={<span className="legend-dot"><i />准备度</span>} />
      <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 12, right: 8, left: -26, bottom: 0 }}><defs><linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8bc34a" stopOpacity={0.32} /><stop offset="100%" stopColor="#8bc34a" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} /><YAxis domain={[50, 100]} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--line)" }} /><ReferenceLine y={70} stroke="var(--amber)" strokeDasharray="4 4" /><Area type="monotone" dataKey="score" stroke="#6e9f2b" strokeWidth={3} fill="url(#readinessFill)" activeDot={{ r: 5 }} /></AreaChart></ResponsiveContainer></div>
    </Card>

    <Card className="today-card">
      <CardHeader title={nextPlan?.date === today() ? "今日计划" : "下次计划"} subtitle={nextPlan ? `${fmtDate(nextPlan.date)} · ${nextPlan.type}` : "尚未安排训练"} action={<button className="icon-button" onClick={() => go("session")}><MoreHorizontal /></button>} />
      {nextPlan ? <>
        {nextPlan.exercises.slice(0, 1).map((block) => <div className="plan-feature" key={block.id}><div className="plan-number">01</div><div><span>主项</span><h3>{block.exercise}</h3><p>{block.sets.length} 组 · {block.sets[0]?.reps || "—"} 次</p></div><div className="target-load"><span>计划负荷</span><strong>{block.sets[0]?.weight || "—"}<small> kg</small></strong></div></div>)}
        {nextPlan.exercises.slice(1, 3).map((block, index) => <div className="plan-row" key={block.id}><span>{String(index + 2).padStart(2, "0")}</span><div><strong>{block.exercise}</strong><small>{block.sets.length} 组 · {block.sets[0]?.reps || "—"} 次</small></div><ChevronRight /></div>)}
      </> : <EmptyState icon={CalendarDays} title="还没有训练计划" text="在训练记录中选择未来日期即可创建计划。" />}
      <button className="btn primary full" onClick={() => go("session")}><Zap />{nextPlan ? "查看训练计划" : "制定训练计划"}</button>
    </Card>

    <Card className="performance-card">
      <CardHeader title="能力快照" subtitle="近期最佳表现" action={<button className="text-button" onClick={() => go("vbt")}>查看画像 <ChevronRight /></button>} />
      {performanceRows.length ? <div className="performance-list">
        {performanceRows.map(([name, item], i) => <div className="performance-row" key={name}><div className={`rank ${["lime", "blue", "amber"][i]}`}>{i + 1}</div><div><strong>{name}</strong><span>{item.source} · {fmtDate(item.date)}</span></div><div className="perf-value"><strong>{item.weight}<small> kg</small></strong><span>{item.velocity ? `${item.velocity.toFixed(2)} m/s` : "PR 记录"}</span></div></div>)}
      </div> : <EmptyState icon={Trophy} title="暂无能力记录" text="保存训练或在运动员档案中添加 PR 后显示。" />}
    </Card>

    <Card className="recent-card">
      <CardHeader title="最近训练" subtitle="自动保存在本机" action={<button className="text-button" onClick={() => go("history")}>全部记录 <ChevronRight /></button>} />
      {lastSession ? <div className="recent-session"><div className="session-date"><strong>{format(parseISO(lastSession.date), "dd")}</strong><span>{format(parseISO(lastSession.date), "MMM", { locale: zhCN })}</span></div><div className="session-main"><strong>{lastSession.type}</strong><span>{lastSession.exercises.map((e) => e.exercise).join(" · ")}</span></div><div className="session-meta"><span>{lastSession.duration} 分钟</span><strong>{Math.round(sessionVolume(lastSession) / 100) / 10} t</strong></div></div> : <EmptyState icon={History} title="暂无训练记录" text="完成第一节训练后会显示在这里。" />}
    </Card>
  </div>;
}

function ReadinessPage({ latest, history, onChanged }: { latest?: ReadinessEntry; history: ReadinessEntry[]; onChanged: () => void }) {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    date: today(), sleepHours: latest?.sleepHours ?? 7.5, sleepQuality: latest?.sleepQuality ?? 4,
    fatigue: 2, soreness: 2, stress: 2, hrv: latest?.hrv ?? 62, restingHr: latest?.restingHr ?? 58,
    armSwingCmj: latest?.armSwingCmj ?? 0, noArmCmj: latest?.noArmCmj ?? 0,
    gripLeft: latest?.gripLeft ?? 0, gripRight: latest?.gripRight ?? 0, healthSource: "manual" as const
  });
  const performance = performanceReadiness(form, history.filter((entry) => entry.date < form.date));
  const wellnessScore = readinessScore(form);
  const score = performance === null ? wellnessScore : Math.round(wellnessScore * .8 + performance * .2);
  const recommendation = readinessRecommendation(score);
  const update = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: key === "date" ? value : Number(value) }));
  const submit = async () => {
    const existing = await db.readiness.where("date").equals(form.date).first();
    const payload = { ...form, score, recommendation };
    if (existing?.id) await db.readiness.update(existing.id, payload); else await db.readiness.add(payload);
    onChanged(); setSaved(true); setTimeout(() => setSaved(false), 2400);
  };
  return <div className="readiness-layout">
    <Card className="assessment-card"><CardHeader title="每日状态检查" subtitle="恢复、主观感受与运动表现三部分综合评估" action={<label className="compact-date"><span>评估日期</span><input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} /></label>} />
      <div className="health-connect-note"><Smartphone /><div><strong>Apple 健康数据连接</strong><p>普通网页无法直接申请 HealthKit 权限。当前支持手动录入；后续可通过 iOS 快捷指令或原生 App 桥接自动同步睡眠、HRV 与静息心率。</p></div><span>网页限制</span></div>
      <div className="assessment-section"><div className="section-title"><div><span>01</span><h3>客观恢复指标</h3></div><em>健康与恢复</em></div><div className="form-grid three"><label><span>睡眠时长</span><div className="input-unit"><input type="number" step="0.1" min="0" max="14" value={form.sleepHours} onChange={(e) => update("sleepHours", e.target.value)} /><em>小时</em></div></label><label><span>HRV</span><div className="input-unit"><input type="number" min="1" value={form.hrv} onChange={(e) => update("hrv", e.target.value)} /><em>ms</em></div></label><label><span>静息心率</span><div className="input-unit"><input type="number" min="30" value={form.restingHr} onChange={(e) => update("restingHr", e.target.value)} /><em>bpm</em></div></label></div></div>
      <div className="assessment-section"><div className="section-title"><div><span>02</span><h3>主观感受</h3></div><em>1–5 分</em></div>{([['sleepQuality','睡眠质量','差','很好'],['fatigue','整体疲劳','轻松','很疲劳'],['soreness','肌肉酸痛','无','严重'],['stress','心理压力','轻松','很高']] as const).map(([key,label,left,right]) => <div className="range-field" key={key}><div><span>{label}</span><strong>{form[key]} / 5</strong></div><input type="range" min="1" max="5" value={form[key]} onChange={(e) => update(key, e.target.value)} /><div className="range-labels"><span>{left}</span><span>{right}</span></div></div>)}</div>
      <div className="assessment-section"><div className="section-title"><div><span>03</span><h3>运动表现指标</h3></div><em>{performance === null ? "建立个人基线中" : `今日指数 ${performance}%`}</em></div><div className="form-grid performance-grid"><label><span>摆臂 CMJ</span><div className="input-unit"><input type="number" step="0.1" min="0" placeholder="未测试" value={form.armSwingCmj || ""} onChange={(e) => update("armSwingCmj", e.target.value)} /><em>cm</em></div></label><label><span>不摆臂 CMJ</span><div className="input-unit"><input type="number" step="0.1" min="0" placeholder="未测试" value={form.noArmCmj || ""} onChange={(e) => update("noArmCmj", e.target.value)} /><em>cm</em></div></label><label><span>左手握力</span><div className="input-unit"><input type="number" step="0.1" min="0" placeholder="未测试" value={form.gripLeft || ""} onChange={(e) => update("gripLeft", e.target.value)} /><em>kg</em></div></label><label><span>右手握力</span><div className="input-unit"><input type="number" step="0.1" min="0" placeholder="未测试" value={form.gripRight || ""} onChange={(e) => update("gripRight", e.target.value)} /><em>kg</em></div></label></div><p className="baseline-note"><Info />至少两次有效记录后，运动表现会按个人近期基线占准备度的 20%。未测试时不会降低分数。</p></div>
      <button className="btn primary full" onClick={submit}><Save />{saved ? "已保存" : `保存 ${fmtDate(form.date)} 状态`}</button>
    </Card>
    <div className="assessment-result"><Card className="result-card"><span className="result-kicker">实时结果</span><ScoreRing value={score} /><h2>{score >= 85 ? "状态很好" : score >= 70 ? "可以训练" : score >= 55 ? "适当减量" : "恢复优先"}</h2><p>{recommendation}</p><div className="decision-list"><div><Activity /><span>综合准备度</span><strong>{score}%</strong></div><div><TrendingUp /><span>运动表现</span><strong>{performance === null ? "待建立基线" : `${performance}%`}</strong></div><div><Target /><span>冲重建议</span><strong>{score >= 85 ? "可选" : "不建议"}</strong></div><div><RefreshCw /><span>训练强度</span><strong>{score >= 85 ? "100%" : score >= 70 ? "90–100%" : score >= 55 ? "75–90%" : "≤70%"}</strong></div></div></Card></div>
  </div>;
}

const blankSet = (): SetEntry => ({ id: uid(), weight: 100, reps: 3, velocity: 0.5, rpe: 7, completed: true });
const blankBlock = (): ExerciseBlock => ({ id: uid(), exercise: "深蹲", sets: [blankSet()] });

function SessionPage({ sessions, settings, onSaved }: { sessions: TrainingSession[]; settings?: AthleteSettings; onSaved: () => void }) {
  const [session, setSession] = useState<TrainingSession>({ date: today(), type: "下肢力量", duration: 60, notes: "", exercises: [blankBlock()], completed: false });
  const [message, setMessage] = useState("");
  const isFuture = session.date > today();
  const updateBlock = (blockId: string, fn: (block: ExerciseBlock) => ExerciseBlock) => setSession((s) => ({ ...s, exercises: s.exercises.map((b) => b.id === blockId ? fn(b) : b) }));
  const updateSet = (blockId: string, setId: string, key: keyof SetEntry, value: number | boolean) => updateBlock(blockId, (block) => ({ ...block, sets: block.sets.map((set) => set.id === setId ? { ...set, [key]: value } : set) }));
  const changeDate = (date: string) => {
    const existing = sessions.find((item) => item.date === date && (!item.completed || date > today()));
    setSession(existing ? structuredClone(existing) : { date, type: "下肢力量", duration: 60, notes: "", exercises: [blankBlock()], completed: false });
    setMessage(existing ? "已载入该日期的训练计划。" : "");
  };
  const save = async () => {
    if (!session.exercises.length || !session.exercises.some((block) => block.sets.length)) { setMessage("请至少添加一个动作和一组计划。"); return; }
    if (!isFuture && !session.exercises.some((block) => block.sets.some((set) => set.completed))) { setMessage("至少完成一组后才能保存训练。"); return; }
    const payload: TrainingSession = {
      ...session,
      duration: isFuture ? 0 : session.duration,
      completed: !isFuture,
      exercises: isFuture ? session.exercises.map((block) => ({ ...block, sets: block.sets.map((set) => ({ ...set, completed: false })) })) : session.exercises
    };
    if (payload.id) await db.sessions.put(payload); else payload.id = await db.sessions.add(payload);
    setSession(payload);
    setMessage(isFuture ? "训练计划已保存并同步。" : "训练记录已保存并同步。");
    onSaved();
  };
  return <div className="session-layout">
    <Card className="session-control"><CardHeader title={isFuture ? "制定训练计划" : "记录本次训练"} subtitle={isFuture ? "未来日期自动保存为计划，到训练日再填写完成状态、速度与时长" : "输入每组最快一次平均向心速度"} action={<span className={`session-mode ${isFuture ? "planned" : "live"}`}>{isFuture ? "未来计划" : "训练记录"}</span>} />
      <div className="form-grid three"><label><span>日期</span><input type="date" value={session.date} onChange={(e) => changeDate(e.target.value)} /></label><label><span>训练类型</span><select value={session.type} onChange={(e) => setSession({ ...session, type: e.target.value as TrainingSession["type"] })}>{trainingTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><span>训练时长</span>{isFuture ? <div className="deferred-field">训练结束后填写</div> : <div className="input-unit"><input type="number" min="0" value={session.duration} onChange={(e) => setSession({ ...session, duration: Number(e.target.value) })} /><em>分钟</em></div>}</label></div>
    </Card>
    {session.exercises.map((block, blockIndex) => {
      const historicalPoints = sessions.filter((item) => item.completed).flatMap((item) => item.exercises.filter((candidate) => candidate.exercise === block.exercise).flatMap((candidate) => candidate.sets.filter((set) => set.completed && set.weight > 0 && set.velocity > 0).map((set) => ({ weight: set.weight, velocity: set.velocity }))));
      const currentPoints = block.sets.filter((set) => set.weight > 0 && set.velocity > 0).map((set) => ({ weight: set.weight, velocity: set.velocity }));
      const modelPoints = [...historicalPoints, ...currentPoints];
      const mvt = exerciseMvt(settings, block.exercise);
      const regression = mvt && new Set(modelPoints.map((point) => point.weight)).size >= 2 ? linearRegression(modelPoints, mvt) : null;
      const e1rm = regression && regression.estimated1RM > 0 && regression.r2 >= .5 ? regression.estimated1RM : null;
      return <Card className="exercise-card" key={block.id}>
      <div className="exercise-head"><div className="exercise-order">{String(blockIndex + 1).padStart(2,"0")}</div><div><label className="select-label">训练动作<ExerciseSelect value={block.exercise} onChange={(value) => updateBlock(block.id, (candidate) => ({ ...candidate, exercise: value }))} /></label><span>{block.sets.length} 组 · {e1rm ? `历史 ${historicalPoints.length} 点 + 本次 ${currentPoints.length} 点，输入时实时更新` : "至少需要两个不同负荷的有效速度点"}</span></div><div className="exercise-head-actions"><div className={`e1rm-badge ${e1rm ? "ready" : "empty"}`}><Trophy /><strong>{e1rm ? e1rm.toFixed(1) : "—"}</strong><span>今日预计 1RM · kg</span></div><button className="remove-exercise" onClick={() => setSession((current) => ({ ...current, exercises: current.exercises.filter((candidate) => candidate.id !== block.id) }))} aria-label={`删除${block.exercise}`}><Trash2 /></button></div></div>
      <div className="set-table"><div className="set-row set-header"><span>组</span><span>负重</span><span>次数</span><span>速度 m/s</span><span>RPE</span><span>{isFuture ? "计划" : "状态"}</span><span /></div>{block.sets.map((set, index) => <div className="set-row" key={set.id}><strong>{index + 1}</strong><input aria-label={`第${index+1}组负重`} type="number" min="0" value={set.weight || ""} onChange={(e) => updateSet(block.id, set.id, "weight", Number(e.target.value))} /><input aria-label={`第${index+1}组次数`} type="number" min="0" value={set.reps || ""} onChange={(e) => updateSet(block.id, set.id, "reps", Number(e.target.value))} /><DecimalInput ariaLabel={`第${index+1}组速度`} value={set.velocity} placeholder={isFuture ? "可留空" : "0.00"} onValue={(value) => updateSet(block.id, set.id, "velocity", value)} /><DecimalInput ariaLabel={`第${index+1}组RPE`} value={set.rpe} placeholder={isFuture ? "可留空" : "1–10"} max={10} onValue={(value) => updateSet(block.id, set.id, "rpe", value)} />{isFuture ? <span className="planned-set">待训练</span> : <label className="check"><input type="checkbox" checked={set.completed} onChange={(e) => updateSet(block.id, set.id, "completed", e.target.checked)} /><span>完成</span></label>}<button className="icon-button danger" onClick={() => updateBlock(block.id, (candidate) => ({ ...candidate, sets: candidate.sets.filter((item) => item.id !== set.id) }))} aria-label="删除组"><Trash2 /></button></div>)}</div>
      <button className="btn ghost add-set" onClick={() => updateBlock(block.id, (b) => ({ ...b, sets: [...b.sets, { ...blankSet(), weight: b.sets.at(-1)?.weight || 100 }] }))}><Plus />添加一组</button>
    </Card>})}
    <button className="add-exercise" onClick={() => setSession((s) => ({ ...s, exercises: [...s.exercises, blankBlock()] }))}><Plus /><span>添加训练动作</span></button>
    <Card className="session-finish"><label><span>{isFuture ? "计划备注" : "训练备注"}</span><textarea placeholder={isFuture ? "记录训练目标、重点技术或负荷安排…" : "记录技术感受、疼痛或计划调整…"} value={session.notes} onChange={(e) => setSession({ ...session, notes: e.target.value })} /></label><div><p className={message.includes("至少") || message.includes("请") ? "error" : "success"}>{message}</p><button className="btn primary" onClick={save}><Save />{isFuture ? "保存训练计划" : "完成并保存训练"}</button></div></Card>
  </div>;
}

function VbtPage({ sessions, settings }: { sessions: TrainingSession[]; settings?: AthleteSettings }) {
  const [exercise, setExercise] = useState<ExerciseName>("深蹲");
  const points = useMemo(() => sessions.filter((session) => session.completed).flatMap((session) => session.exercises.filter((b) => b.exercise === exercise).flatMap((b) => b.sets.filter((s) => s.completed && s.weight > 0 && s.velocity > 0).map((s) => ({ weight: s.weight, velocity: s.velocity, date: session.date })))).sort((a,b) => a.weight - b.weight), [sessions, exercise]);
  const mvt = exerciseMvt(settings, exercise);
  const regression = mvt ? linearRegression(points, mvt) : null;
  const lineData = regression && points.length ? [{ weight: Math.min(...points.map((p) => p.weight)) - 5, velocity: regression.slope * (Math.min(...points.map((p) => p.weight)) - 5) + regression.intercept }, { weight: regression.estimated1RM, velocity: mvt }] : [];
  return <div className="vbt-layout">
    <Card className="profile-controls"><div><span>动作画像</span><ExerciseSelect value={exercise} onChange={setExercise} /></div><div className="profile-status"><span className="status-dot" />{!mvt ? "该动作尚未设置 MVT" : points.length >= 4 ? "画像数据充足" : "需要更多数据"}</div></Card>
    <div className="metric-strip vbt-metrics"><Card><div className="metric-icon lime"><Trophy /></div><div><span>估算 1RM</span><strong>{regression ? regression.estimated1RM.toFixed(1) : "—"}<small> kg</small></strong><em>基于个人 LVP</em></div></Card><Card><div className="metric-icon blue"><Target /></div><div><span>最小速度阈值</span><strong>{mvt ?? "—"}<small> m/s</small></strong><em>{exercise}专属</em></div></Card><Card><div className="metric-icon amber"><CircleGauge /></div><div><span>模型拟合度</span><strong>{regression ? (regression.r2 * 100).toFixed(0) : "—"}<small>%</small></strong><em>{points.length} 个有效观测</em></div></Card></div>
    <Card className="lvp-chart"><CardHeader title={`${exercise} 负荷–速度画像`} subtitle="每个点代表一组最快重复；虚线为个人回归趋势" />
      {points.length >= 2 ? <div className="chart-box tall"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis type="number" dataKey="weight" name="负重" unit="kg" domain={["dataMin - 10", "dataMax + 15"]} tickFormatter={(value) => Math.round(value).toString()} tick={{ fill: "var(--muted)", fontSize: 12 }} /><YAxis type="number" dataKey="velocity" name="速度" unit="m/s" domain={[0, "dataMax + 0.15"]} tickFormatter={(value) => Number(value).toFixed(2)} tick={{ fill: "var(--muted)", fontSize: 12 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value) => typeof value === "number" ? value.toFixed(2) : value} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)" }} /><Scatter name="训练组" data={points} fill="#173f31">{points.map((_, index) => <Cell key={index} fill={index === points.length - 1 ? "#98cf4f" : "#173f31"} />)}</Scatter><Line data={lineData} type="linear" dataKey="velocity" stroke="#e79545" strokeWidth={2} strokeDasharray="6 5" dot={false} activeDot={false} legendType="none" /></ScatterChart></ResponsiveContainer></div> : <EmptyState icon={TrendingUp} title="还无法建立画像" text="至少记录两组不同负重与速度数据。" />}
    </Card>
    <Card className="prediction-card"><CardHeader title="今日负重预测" subtitle="根据当前个人回归模型估算" />{regression ? <div className="prediction-list">{[0.6,0.5,0.4,0.3].map((velocity) => { const weight = (velocity-regression.intercept)/regression.slope; return <div key={velocity}><span>{velocity.toFixed(2)} m/s</span><div className="prediction-line"><i style={{ width: `${Math.max(20, Math.min(100, weight/regression.estimated1RM*100))}%` }} /></div><strong>{weight.toFixed(0)} kg</strong></div>})}</div> : <p className="muted-copy">记录更多训练数据后显示。</p>}</Card>
    <Card className="model-note"><Zap /><div><strong>模型解释</strong><p>e1RM 由个人负荷–速度直线与 MVT 的交点估算。这里只作为训练决策辅助，不替代实际测试；当 R² 低于 0.80 时建议补充不同负荷区间的数据。</p></div></Card>
  </div>;
}

function HistoryPage({ sessions, readiness, onChanged }: { sessions: TrainingSession[]; readiness: ReadinessEntry[]; onChanged: () => void }) {
  const [filter, setFilter] = useState<"全部" | TrainingSession["type"]>("全部");
  const [expanded, setExpanded] = useState<number | null>(null);
  const visible = filter === "全部" ? sessions : sessions.filter((s) => s.type === filter);
  const remove = async (id?: number) => { if (!id || !window.confirm("确定删除这条训练记录吗？此操作不可撤销。")) return; await db.sessions.delete(id); onChanged(); };
  return <div className="history-layout"><Card><CardHeader title="训练与计划" subtitle={`${sessions.filter((item) => item.completed).length} 次已完成 · ${sessions.filter((item) => !item.completed).length} 个计划`} action={<select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option>全部</option>{trainingTypes.map((type) => <option key={type}>{type}</option>)}</select>} />
    <div className="history-list">{visible.map((session) => { const dayReadiness = readiness.find((entry) => entry.date === session.date); return <article className={`history-item ${expanded === session.id ? "expanded" : ""}`} key={session.id}><button className="history-summary" onClick={() => setExpanded(expanded === session.id ? null : session.id || null)}><div className="history-date"><strong>{format(parseISO(session.date), "dd")}</strong><span>{format(parseISO(session.date), "MMM", { locale: zhCN })}</span></div><div><strong>{session.type}<em className={`history-status ${session.completed ? "done" : "plan"}`}>{session.completed ? "已完成" : "计划"}</em></strong><span>{session.exercises.map((b) => b.exercise).join(" · ")}</span></div><div className="history-stat"><span>{session.completed ? "训练量" : "动作数"}</span><strong>{session.completed ? `${Math.round(sessionVolume(session)/100)/10} t` : `${session.exercises.length} 个`}</strong></div><div className="history-stat"><span>{dayReadiness ? "准备度" : "时长"}</span><strong>{dayReadiness ? `${dayReadiness.score}%` : session.completed ? `${session.duration} min` : "—"}</strong></div><ChevronRight /></button>{expanded === session.id && <div className="history-detail">
      {dayReadiness && <div className="history-readiness"><div><span>当日准备度</span><strong>{dayReadiness.score}</strong></div><span>睡眠 {dayReadiness.sleepHours}h</span><span>HRV {dayReadiness.hrv}ms</span><span>静息心率 {dayReadiness.restingHr}bpm</span>{dayReadiness.noArmCmj ? <span>CMJ {dayReadiness.noArmCmj}cm</span> : null}{dayReadiness.gripLeft || dayReadiness.gripRight ? <span>握力 {dayReadiness.gripLeft || "—"}/{dayReadiness.gripRight || "—"}kg</span> : null}</div>}
      {session.exercises.map((block) => <div key={block.id}><h4>{block.exercise}</h4><div className="mini-sets">{block.sets.filter((set) => !session.completed || set.completed).map((set, i) => <span key={set.id}>{i+1}. {set.weight}kg × {set.reps}{set.velocity > 0 ? ` · ${set.velocity.toFixed(2)}m/s` : ""}</span>)}</div></div>)}{session.notes && <p>{session.completed ? "训练备注" : "计划备注"}：{session.notes}</p>}<button className="btn danger-outline" onClick={() => remove(session.id)}><Trash2 />删除{session.completed ? "记录" : "计划"}</button></div>}</article>})}{visible.length === 0 && <EmptyState icon={History} title="没有匹配记录" text="调整筛选条件或开始一节新训练。" />}</div>
  </Card></div>;
}

function DataPage({ settings, onChanged, cloudEnabled }: { settings?: AthleteSettings; onChanged: () => void; cloudEnabled: boolean }) {
  const [form, setForm] = useState<AthleteSettings | undefined>(settings);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setForm(settings), [settings]);
  if (!form) return null;
  const personalRecords = form.personalRecords ?? [];
  const addPersonalRecord = () => setForm({
    ...form,
    personalRecords: [...personalRecords, { id: uid(), exercise: "深蹲", weight: 0, date: today(), notes: "" }]
  });
  const updatePersonalRecord = (id: string, patch: Partial<PersonalRecord>) => setForm({
    ...form,
    personalRecords: personalRecords.map((record) => record.id === id ? { ...record, ...patch } : record)
  });
  const removePersonalRecord = (id: string) => setForm({ ...form, personalRecords: personalRecords.filter((record) => record.id !== id) });
  const saveSettings = async () => { await db.settings.put(form); onChanged(); setStatus("设置已保存并等待同步"); };
  const exportJson = async () => { const payload = { version: 1, exportedAt: new Date().toISOString(), sessions: await db.sessions.toArray(), readiness: await db.readiness.toArray(), settings: await db.settings.toArray() }; download(`velocity-lab-${today()}.json`, JSON.stringify(payload, null, 2), "application/json"); };
  const exportCsv = async () => { const rows = [["date","session_type","exercise","set","weight","reps","velocity","rpe","volume"]]; (await db.sessions.toArray()).forEach((s) => s.exercises.forEach((b) => b.sets.forEach((set,i) => rows.push([s.date,s.type,b.exercise,String(i+1),String(set.weight),String(set.reps),String(set.velocity),String(set.rpe),String(set.weight*set.reps)])))); download(`velocity-lab-sets-${today()}.csv`, rows.map((r) => r.join(",")).join("\n"), "text/csv"); };
  const importJson = async (file?: File) => { if (!file) return; try { const payload = JSON.parse(await file.text()); if (!Array.isArray(payload.sessions) || !Array.isArray(payload.readiness)) throw new Error(); await db.transaction("rw", db.sessions, db.readiness, db.settings, async () => { await db.sessions.clear(); await db.readiness.clear(); if (payload.sessions.length) await db.sessions.bulkAdd(payload.sessions); if (payload.readiness.length) await db.readiness.bulkAdd(payload.readiness); if (payload.settings?.length) await db.settings.bulkPut(payload.settings); }); onChanged(); setStatus("数据导入完成并等待同步"); } catch { setStatus("导入失败：文件格式不正确"); } };
  const clearData = async () => { if (!window.confirm("这会删除所有训练与状态记录。请先导出备份，确定继续吗？")) return; await db.sessions.clear(); await db.readiness.clear(); onChanged(); setStatus("训练数据已清空并等待同步"); };
  return <div className="data-layout"><Card><CardHeader title="运动员档案" subtitle="用于个体化计算与界面显示" /><div className="form-grid three"><label><span>姓名</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label><span>体重</span><div className="input-unit"><input type="number" step="0.1" value={form.bodyWeight} onChange={(e) => setForm({ ...form, bodyWeight: Number(e.target.value) })} /><em>kg</em></div></label><label><span>单位</span><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as "kg" | "lb" })}><option value="kg">公斤 kg</option><option value="lb">磅 lb</option></select></label></div><button className="btn primary" onClick={saveSettings}><Save />保存档案</button></Card>
    <Card><CardHeader title="动作 MVT" subtitle="用于个人负荷–速度曲线与 e1RM；仅显示适合 VBT 建模的动作" /><div className="mvt-grid">{vbtExercises.map((item) => <label key={item.name}><span>{item.name}</span><div className="input-unit"><input type="number" step="0.01" value={form.mvt[item.name] ?? item.defaultMvt ?? ""} onChange={(e) => setForm({ ...form, mvt: { ...form.mvt, [item.name]: Number(e.target.value) } })} /><em>m/s</em></div></label>)}</div><button className="btn primary" onClick={saveSettings}><Save />保存阈值</button></Card>
    <Card className="pr-card"><CardHeader title="个人 PR 时间线" subtitle="可为同一个动作记录多次突破与对应日期" action={<button className="btn ghost compact" onClick={addPersonalRecord}><Plus />添加 PR</button>} />
      <div className="pr-list">{personalRecords.length ? personalRecords.map((record, index) => <div className="pr-row" key={record.id}>
        <div className="pr-index"><Trophy /><span>PR {index + 1}</span></div>
        <label><span>动作</span><ExerciseSelect value={record.exercise} onChange={(exercise) => updatePersonalRecord(record.id, { exercise: exercise as ExerciseName })} /></label>
        <label><span>成绩</span><div className="input-unit"><DecimalInput value={record.weight} onValue={(weight) => updatePersonalRecord(record.id, { weight })} ariaLabel={`${record.exercise} PR 重量`} placeholder="0" /><em>{form.unit}</em></div></label>
        <label><span>日期</span><input type="date" value={record.date} onChange={(event) => updatePersonalRecord(record.id, { date: event.target.value })} /></label>
        <label><span>备注（可选）</span><input value={record.notes ?? ""} placeholder="例如：比赛 / 训练" onChange={(event) => updatePersonalRecord(record.id, { notes: event.target.value })} /></label>
        <button className="remove-pr" onClick={() => removePersonalRecord(record.id)} aria-label={`删除 ${record.exercise} PR`}><Trash2 /></button>
      </div>) : <EmptyState icon={Trophy} title="还没有 PR 记录" text="点击“添加 PR”，建立属于你的个人最好成绩时间线。" />}</div>
      {personalRecords.length > 0 && <button className="btn primary" onClick={saveSettings}><Save />保存 PR 记录</button>}
    </Card>
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
    mvt: { 深蹲: 0.3, 卧推: 0.17, 硬拉: 0.15, 高抓: 1.7, 高翻: 1.3 },
    personalRecords: []
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
    {page === "readiness" && <ReadinessPage latest={readiness[0]} history={readiness} onChanged={queueSync} />}
    {page === "session" && <SessionPage sessions={sessions} settings={settings} onSaved={() => { queueSync(); setPage("history"); }} />}
    {page === "vbt" && <VbtPage sessions={sessions} settings={settings} />}
    {page === "history" && <HistoryPage sessions={sessions} readiness={readiness} onChanged={queueSync} />}
    {page === "data" && <DataPage settings={settings} onChanged={queueSync} cloudEnabled={cloudConfigured} />}
  </AppShell>;
}

