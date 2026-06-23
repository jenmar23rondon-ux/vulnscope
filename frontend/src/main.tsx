import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FileText,
  LogOut,
  Radar,
  Search,
  ShieldCheck
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { api, API_URL } from "./services/api";
import type { DashboardData, Scan } from "./types";
import "./styles.css";

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("admin@vulnscope.local");
  const [password, setPassword] = useState("Admin1234");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await api.post("/auth/login", { email, password });
      localStorage.setItem("vulnscope_token", response.data.token);
      localStorage.setItem("vulnscope_user", JSON.stringify(response.data.user));
      onLogin();
    } catch {
      setError("Could not sign in");
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <ShieldCheck size={42} />
        <h1>VulnScope</h1>
        <p>Professional vulnerability analysis dashboard</p>
        {error && <div className="error">{error}</div>}
        <label>Email</label>
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button>Sign in</button>
      </form>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <section className="stat-card">
      <div className="icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </section>
  );
}

function ScanForm({ onScan }: { onScan: (scan: Scan) => void }) {
  const [target, setTarget] = useState("127.0.0.1");
  const [ports, setPorts] = useState("22,80,443,5432,8000,8080");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const parsedPorts = ports
        .split(",")
        .map((port) => Number(port.trim()))
        .filter(Boolean);
      const response = await api.post("/scans", { target, ports: parsedPorts });
      onScan(response.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel scan-form" onSubmit={submit}>
      <div>
        <h2>New Scan</h2>
        <p>Use only systems you own or have permission to test.</p>
      </div>
      <label>Target</label>
      <input value={target} onChange={(event) => setTarget(event.target.value)} />
      <label>Ports</label>
      <input value={ports} onChange={(event) => setPorts(event.target.value)} />
      <button disabled={loading}>{loading ? "Scanning..." : "Run scan"}</button>
    </form>
  );
}

function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  async function loadData() {
    const [dashboardResponse, scansResponse] = await Promise.all([
      api.get("/dashboard"),
      api.get("/scans")
    ]);
    setDashboard(dashboardResponse.data);
    setScans(scansResponse.data);
    setSelectedScan(scansResponse.data[0] || null);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!scans.some((scan) => ["queued", "running"].includes(scan.status))) {
      return;
    }
    const timer = window.setInterval(loadData, 3000);
    return () => window.clearInterval(timer);
  }, [scans]);

  function handleScan(scan: Scan) {
    setSelectedScan(scan);
    loadData();
  }

  return (
    <main className="content">
      <div className="hero">
        <div>
          <p className="eyebrow">Security Project 5</p>
          <h1>Vulnerability Analysis Platform</h1>
          <p>Scan assets, detect exposed services, map CVE-style risks and export reports.</p>
        </div>
        <div className="risk-badge">
          <span>Avg Risk</span>
          <strong>{dashboard?.average_risk ?? 0}</strong>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={<Search />} label="Scans" value={dashboard?.total_scans ?? 0} />
        <StatCard icon={<Radar />} label="Open ports" value={dashboard?.open_ports ?? 0} />
        <StatCard icon={<AlertTriangle />} label="Vulnerabilities" value={dashboard?.vulnerabilities ?? 0} />
        <StatCard icon={<Activity />} label="High/Critical" value={dashboard?.high_or_critical ?? 0} />
      </div>

      <div className="grid-two">
        <ScanForm onScan={handleScan} />
        <section className="panel">
          <h2>Severity Overview</h2>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={dashboard?.severity_counts ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26364f" />
                <XAxis dataKey="severity" stroke="#9fb3d1" />
                <YAxis allowDecimals={false} stroke="#9fb3d1" />
                <Tooltip />
                <Bar dataKey="count" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid-two">
        <section className="panel">
          <h2>Risk Trend</h2>
          <div className="chart small-chart">
            <ResponsiveContainer>
              <LineChart data={dashboard?.risk_trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26364f" />
                <XAxis dataKey="scan" stroke="#9fb3d1" />
                <YAxis domain={[0, 100]} stroke="#9fb3d1" />
                <Tooltip />
                <Line type="monotone" dataKey="risk_score" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <h2>Top Risk Targets</h2>
          <div className="table">
            <div className="table-head target-row">
              <span>Target</span><span>Scans</span><span>Max risk</span><span>High/Critical</span>
            </div>
            {(dashboard?.top_targets ?? []).map((target) => (
              <div className="target-row" key={target.target}>
                <span>{target.target}</span>
                <span>{target.scans}</span>
                <span className={target.max_risk >= 60 ? "risk high" : "risk"}>{target.max_risk}</span>
                <span>{target.critical_or_high}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <h2>Scan History</h2>
        <div className="table">
          <div className="table-head scan-row">
            <span>Target</span><span>Status</span><span>Risk</span><span>Started</span>
          </div>
          {scans.map((scan) => (
            <button className="scan-row row-button" key={scan.id} onClick={() => setSelectedScan(scan)}>
              <span>{scan.target}</span>
              <span>{scan.status}</span>
              <span className={scan.risk_score >= 60 ? "risk high" : "risk"}>{scan.risk_score}</span>
              <span>{new Date(scan.started_at).toLocaleString()}</span>
            </button>
          ))}
        </div>
      </section>

      {selectedScan && (
        <div className="grid-two">
          <section className="panel">
            <div className="panel-title">
              <h2>Ports</h2>
              <div className="actions">
                <a href={`${API_URL}/reports/${selectedScan.id}.csv`} target="_blank">CSV</a>
                <a href={`${API_URL}/reports/${selectedScan.id}.pdf`} target="_blank">PDF</a>
              </div>
            </div>
            {selectedScan.ports.map((port) => (
              <div className="port-row" key={port.id}>
                <span>{port.port}/{port.protocol}</span>
                <span>{port.service}</span>
                <strong className={port.state === "open" ? "open" : ""}>{port.state}</strong>
              </div>
            ))}
          </section>

          <section className="panel">
            <h2>Vulnerabilities</h2>
            {selectedScan.vulnerabilities.length === 0 && <p className="muted">No CVE-style findings for this scan.</p>}
            {selectedScan.vulnerabilities.map((vulnerability) => (
              <article className="vuln-card" key={vulnerability.id}>
                <div>
                  <strong>{vulnerability.cve}</strong>
                  <span>{vulnerability.description}</span>
                </div>
                <b>{vulnerability.severity} / {vulnerability.cvss_score}</b>
              </article>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}

function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("vulnscope_token")));

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <>
      <nav className="navbar">
        <div className="brand"><ShieldCheck size={22} /> VulnScope</div>
        <a>Dashboard</a>
        <a>Scans</a>
        <a>Vulnerabilities</a>
        <a>Reports</a>
        <button
          className="logout"
          onClick={() => {
            localStorage.removeItem("vulnscope_token");
            localStorage.removeItem("vulnscope_user");
            setLoggedIn(false);
          }}
        >
          <LogOut size={18} />
        </button>
      </nav>
      <Dashboard />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
