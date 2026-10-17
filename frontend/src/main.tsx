import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, FileText, LayoutDashboard, LoaderCircle, LogOut, Plus, Radar, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./services/api";
import type { DashboardData, Scan, WorkspaceView } from "./types";
import { FindingsPanel } from "./components/FindingsPanel";
import { ReportsPanel } from "./components/ReportsPanel";
import { ScanDetails } from "./components/ScanDetails";
import { ScanForm } from "./components/ScanForm";
import { ScanHistory } from "./components/ScanHistory";
import { scanDate, severityColors } from "./utils/format";
import "./styles.css";

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("admin@vulnscope.local");
  const [password, setPassword] = useState("Admin1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await api.post("/auth/login", { email, password });
      localStorage.setItem("vulnscope_token", response.data.token);
      localStorage.setItem("vulnscope_user", JSON.stringify(response.data.user));
      onLogin();
    } catch { setError("Could not sign in. Check your credentials and try again."); }
    finally { setLoading(false); }
  }
  return <main className="login-shell"><form className="login-card" onSubmit={submit}>
    <ShieldCheck size={42} /><h1>VulnScope</h1><p>Your security analysis workspace.</p>
    {error && <div className="error" role="alert">{error}</div>}
    <label htmlFor="login-email">Email</label><input id="login-email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
    <label htmlFor="login-password">Password</label><input id="login-password" autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} />
    <button className="launch-button" disabled={loading}>{loading ? "Signing in…" : "Sign in"}<ArrowRight size={17} /></button>
  </form></main>;
}

function StatCard({ icon, label, value, hint, onClick }: { icon: React.ReactNode; label: string; value: string | number; hint: string; onClick: () => void }) {
  return <button type="button" className="stat-card metric-button" onClick={onClick}><div className="icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div><ArrowUpRight className="metric-arrow" size={17} /></button>;
}

function Dashboard({ view, onNavigate }: { view: WorkspaceView; onNavigate: (view: WorkspaceView) => void }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [openingScan, setOpeningScan] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [historyTarget, setHistoryTarget] = useState("");
  const [historyKey, setHistoryKey] = useState(0);
  const [findingSeverity, setFindingSeverity] = useState("all");
  const [findingKey, setFindingKey] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const loadSequence = useRef(0);
  const detailSequence = useRef(0);
  const [canReset] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vulnscope_user") || "null")?.role === "admin"; }
    catch { return false; }
  });

  const loadData = useCallback(async (quiet = false) => {
    const sequence = ++loadSequence.current;
    if (!quiet) setRefreshing(true);
    try {
      const [dashboardResponse, scansResponse] = await Promise.all([api.get<DashboardData>("/dashboard"), api.get<Scan[]>("/scans")]);
      if (sequence !== loadSequence.current) return;
      setDashboard(dashboardResponse.data); setScans(scansResponse.data);
      setSelectedScan((current) => scansResponse.data.find((scan) => scan.id === current?.id) ?? current);
      setHistoryVersion((value) => value + 1); setLoadError(""); setLastUpdated(new Date());
    } catch { if (sequence === loadSequence.current) setLoadError("Could not update workspace data. Check your connection and try again."); }
    finally { if (sequence === loadSequence.current) setRefreshing(false); }
  }, []);

  useEffect(() => { void loadData(); return () => { loadSequence.current += 1; detailSequence.current += 1; }; }, [loadData]);
  const hasActiveScans = scans.some((scan) => scan.status === "queued" || scan.status === "running");
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void loadData(true), hasActiveScans ? 3000 : 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, hasActiveScans, loadData]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [view]);

  function selectScan(scan: Scan) { detailSequence.current += 1; setOpeningScan(false); setSelectedScan(scan); setDetailsOpen(true); }
  async function openScan(id: number) {
    const sequence = ++detailSequence.current; setOpeningScan(true);
    try {
      const response = await api.get<Scan>(`/scans/${id}`);
      if (sequence === detailSequence.current) { setSelectedScan(response.data); setDetailsOpen(true); }
    } catch { if (sequence === detailSequence.current) setLoadError("Could not open this scan. Refresh the workspace and try again."); }
    finally { if (sequence === detailSequence.current) setOpeningScan(false); }
  }
  function exploreTarget(target: string) { setHistoryTarget(target); setHistoryKey((value) => value + 1); onNavigate("scans"); }
  function exploreSeverity(severity: string) { setFindingSeverity(severity); setFindingKey((value) => value + 1); onNavigate("findings"); }
  function newScan() { onNavigate("scans"); window.setTimeout(() => document.getElementById("scan-target")?.focus(), 0); }
  function handleHistoryReset() {
    loadSequence.current += 1; detailSequence.current += 1;
    setScans([]); setSelectedScan(null); setDetailsOpen(false); setOpeningScan(false);
    setDashboard((current) => current ? { ...current, total_scans: 0, open_ports: 0, vulnerabilities: 0, high_or_critical: 0, average_risk: 0, severity_counts: [], risk_trend: [], top_targets: [], recent_scans: [] } : null);
    void loadData();
  }
  const titles: Record<WorkspaceView, string> = { overview: "Security at a glance", scans: "Scan workspace", findings: "Explore your findings", reports: "Reports, ready to share" };
  const descriptions: Record<WorkspaceView, string> = { overview: "Discover patterns, inspect exposed services and move from insight to action.", scans: "Launch an authorized scan and inspect every result in one place.", findings: "Filter vulnerabilities by target, severity or CVE and open the source scan.", reports: "Find completed scans and export their results with your current session." };

  return <main className="content workspace-content" id="main-content" tabIndex={-1}>
    <div className="workspace-toolbar"><span className="workspace-path"><ShieldCheck size={14} /> Workspace <span>/</span> {view[0].toUpperCase() + view.slice(1)}</span><div className="workspace-controls"><span className="last-sync">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Connecting…"}</span><label className="switch-label"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /> Live updates</label><button type="button" className="icon-button" aria-label="Refresh workspace" disabled={refreshing} onClick={() => void loadData()}><RefreshCw size={17} className={refreshing ? "spin" : ""} /></button></div></div>
    {loadError && <div className="error" role="alert">{loadError}<button type="button" className="button-secondary" onClick={() => void loadData()}>Try again</button></div>}
    <header className="hero workspace-hero"><div><p className="eyebrow">VULNSCOPE / SECURITY OPERATIONS</p><h1>{titles[view]}</h1><p>{descriptions[view]}</p></div>{view !== "scans" && <button type="button" className="primary-action" onClick={newScan}><Plus size={18} /> New scan</button>}</header>
    <div className="stats-grid">
      <StatCard icon={<Search />} label="Total scans" value={dashboard?.total_scans ?? "—"} hint="Browse scan history" onClick={() => exploreTarget("")} />
      <StatCard icon={<Radar />} label="Open ports" value={dashboard?.open_ports ?? "—"} hint="Inspect exposed services" onClick={() => exploreTarget("")} />
      <StatCard icon={<ShieldCheck />} label="Findings" value={dashboard?.vulnerabilities ?? "—"} hint="Explore all severities" onClick={() => exploreSeverity("all")} />
      <StatCard icon={<AlertTriangle />} label="High + Critical" value={dashboard?.high_or_critical ?? "—"} hint="Focus on priority findings" onClick={() => exploreSeverity("HIGH_CRITICAL")} />
    </div>
    {openingScan && <div className="history-loading" role="status"><LoaderCircle className="spin" size={17} /> Opening scan details…</div>}

    {view === "overview" && <>
      <div className="grid-two overview-charts">
        <section className="panel"><div className="section-heading"><div><p className="eyebrow">PRIORITIZE</p><h2>Severity breakdown</h2></div><span className="muted small-copy">Click a severity to investigate</span></div>
          {dashboard && dashboard.vulnerabilities > 0 ? <div className="chart"><ResponsiveContainer><BarChart data={dashboard.severity_counts} margin={{ left: -20, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#26364f" vertical={false} /><XAxis dataKey="severity" stroke="#9fb3d1" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke="#9fb3d1" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#101c30", border: "1px solid #31415f", borderRadius: 8 }} cursor={{ fill: "#ffffff08" }} /><Bar dataKey="count" name="Findings" radius={[7, 7, 0, 0]} cursor="pointer" onClick={(data) => { if (typeof data?.severity === "string") exploreSeverity(data.severity); }}>{dashboard.severity_counts.map((item) => <Cell key={item.severity} fill={severityColors[item.severity]} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="chart-empty"><ShieldCheck size={32} /><strong>{dashboard ? "No findings recorded" : "Loading overview…"}</strong><p>Completed scans populate this breakdown.</p></div>}
          <div className="severity-shortcuts">{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((severity) => <button type="button" key={severity} onClick={() => exploreSeverity(severity)}><i style={{ background: severityColors[severity] }} />{severity}<b>{dashboard?.severity_counts.find((item) => item.severity === severity)?.count ?? 0}</b></button>)}</div>
        </section>
        <section className="panel"><div className="section-heading"><div><p className="eyebrow">FOLLOW THE SIGNAL</p><h2>Recent risk trend</h2></div><span className="average-risk"><strong>{dashboard?.average_risk ?? "—"}</strong> /100 avg.</span></div>
          {dashboard && dashboard.risk_trend.length > 0 ? <><div className="chart"><ResponsiveContainer><LineChart data={dashboard.risk_trend} margin={{ left: -20, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#26364f" vertical={false} /><XAxis dataKey="scan" stroke="#9fb3d1" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} stroke="#9fb3d1" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#101c30", border: "1px solid #31415f", borderRadius: 8 }} labelFormatter={(label) => `Scan #${label}`} /><Line type="linear" dataKey="risk_score" name="Risk score" stroke="#38bdf8" strokeWidth={3} activeDot={false} dot={(props: { cx?: number; cy?: number; payload?: DashboardData["risk_trend"][number] }) => <circle cx={props.cx} cy={props.cy} r={5} fill="#101c30" stroke="#38bdf8" strokeWidth={2} role="button" tabIndex={0} aria-label={`Open scan ${props.payload?.scan}`} onClick={() => { if (props.payload) void openScan(props.payload.scan); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (props.payload) void openScan(props.payload.scan); } }} style={{ cursor: "pointer" }} />} /></LineChart></ResponsiveContainer></div><p className="field-hint">Select a point to inspect a scan. Based on the latest 10 scans.</p></> : <div className="chart-empty"><Activity size={32} /><strong>No trend yet</strong><p>Run a scan to start building your risk history.</p><button type="button" className="text-button" onClick={newScan}>Launch your first scan <ArrowRight size={16} /></button></div>}
        </section>
      </div>
      <div className="grid-two">
        <section className="panel"><div className="section-heading"><div><p className="eyebrow">ASSET FOCUS</p><h2>Top risk targets</h2></div><button type="button" className="text-button" onClick={() => exploreTarget("")}>View all <ArrowUpRight size={16} /></button></div>
          {dashboard?.top_targets.length ? <div className="target-list">{dashboard.top_targets.map((target) => <button type="button" key={target.target} className="target-item" onClick={() => exploreTarget(target.target)}><span className="target-icon"><Radar size={18} /></span><span><strong>{target.target}</strong><small>{target.scans} scans · {target.critical_or_high} priority findings</small></span><b className={target.max_risk >= 60 ? "risk-high" : "risk-low"}>{target.max_risk}<small>/100</small></b><ArrowUpRight size={16} /></button>)}</div> : <div className="subtle-empty"><Radar /><p>Your scanned targets will appear here.</p></div>}
        </section>
        <section className="panel"><div className="section-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent scans</h2></div><button type="button" className="text-button" onClick={() => exploreTarget("")}>History <ArrowUpRight size={16} /></button></div>
          {scans.length ? <div className="recent-list">{scans.slice(0, 5).map((scan) => <button type="button" className="recent-item" key={scan.id} onClick={() => selectScan(scan)}><span className={`status-dot status-${scan.status}`} /><span><strong>{scan.target}</strong><small>{scanDate(scan.started_at)}</small></span><span className={`scan-status status-${scan.status}`}>{scan.status}</span><ArrowUpRight size={16} /></button>)}</div> : <div className="subtle-empty"><Search /><p>No scans yet. Your workspace is ready.</p></div>}
        </section>
      </div>
    </>}
    {view === "scans" && <>
      <div className="grid-two scan-workspace"><ScanForm onScan={(scan) => { selectScan(scan); void loadData(); }} /><section className="panel activity-panel"><div className="section-heading"><div><p className="eyebrow">BACKGROUND JOBS</p><h2>Live activity</h2></div><Activity className="accent-icon" /></div>
        {hasActiveScans ? <div className="recent-list">{scans.filter((scan) => ["queued", "running"].includes(scan.status)).map((scan) => <button type="button" className="recent-item" key={scan.id} onClick={() => selectScan(scan)}><LoaderCircle size={18} className="spin" /><span><strong>{scan.target}</strong><small>Scan #{scan.id}</small></span><span className={`scan-status status-${scan.status}`}>{scan.status}</span></button>)}</div> : <div className="subtle-empty"><ShieldCheck size={30} /><h3>No scans running</h3><p>New scans run in the background, so you can keep exploring.</p></div>}
        <div className="activity-note"><strong>{autoRefresh ? "Live updates are on" : "Live updates are paused"}</strong><p>{autoRefresh ? "Active scans update every 3 seconds. Other data refreshes every 15 seconds." : "Use Refresh workspace to load the latest status, or enable Live updates."}</p></div>
      </section></div>
      <ScanHistory key={historyKey} initialSearch={historyTarget} totalScans={dashboard?.total_scans ?? 0} selectedId={selectedScan?.id} refreshKey={historyVersion} canReset={canReset} onSelect={selectScan} onReset={handleHistoryReset} />
    </>}
    {view === "findings" && <FindingsPanel key={findingKey} initialSeverity={findingSeverity} refreshKey={historyVersion} onOpenScan={(id) => void openScan(id)} />}
    {view === "reports" && <ReportsPanel refreshKey={historyVersion} onOpenScan={(id) => void openScan(id)} />}
    <ScanDetails scan={selectedScan} open={detailsOpen} onClose={() => { detailSequence.current += 1; setDetailsOpen(false); setOpeningScan(false); }} />
    <footer className="workspace-footer"><span><ShieldCheck size={14} /> VulnScope</span><span>Authorized analysis · Clear, actionable results</span></footer>
  </main>;
}

function readView(): WorkspaceView {
  const hash = window.location.hash.slice(1);
  if (hash === "scan-history") return "scans";
  return ["overview", "scans", "findings", "reports"].includes(hash) ? hash as WorkspaceView : "overview";
}

function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("vulnscope_token")));
  const [view, setView] = useState<WorkspaceView>(readView);
  useEffect(() => { const sync = () => setView(readView()); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync); }, []);
  function navigate(next: WorkspaceView) { setView(next); window.location.hash = next; }
  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  const navigation = [{ key: "overview", label: "Overview", icon: LayoutDashboard }, { key: "scans", label: "Scans", icon: Radar }, { key: "findings", label: "Findings", icon: ShieldCheck }, { key: "reports", label: "Reports", icon: FileText }] as const;
  return <><a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to content</a><nav className="navbar workspace-nav" aria-label="Main navigation"><a className="brand" href="#overview" onClick={() => setView("overview")}><ShieldCheck size={23} /> VulnScope<span className="brand-tag">WORKSPACE</span></a><div className="nav-links">{navigation.map((item) => <a key={item.key} href={`#${item.key}`} aria-current={view === item.key ? "page" : undefined} onClick={() => setView(item.key)}><item.icon size={16} /> {item.label}</a>)}</div><button className="logout" aria-label="Sign out" onClick={() => { localStorage.removeItem("vulnscope_token"); localStorage.removeItem("vulnscope_user"); setLoggedIn(false); }}><LogOut size={18} /></button></nav><Dashboard view={view} onNavigate={navigate} /></>;
}

createRoot(document.getElementById("root")!).render(<App />);
