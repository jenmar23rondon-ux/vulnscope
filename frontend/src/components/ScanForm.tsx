import { useState } from "react";
import { isAxiosError } from "axios";
import { ArrowRight, LoaderCircle, Radar } from "lucide-react";
import { api } from "../services/api";
import type { Scan } from "../types";

const presets = [
  { label: "Web", ports: "80,443,8080,8443" },
  { label: "Common", ports: "22,80,443,5432,8000,8080" },
  { label: "Database", ports: "3306,5432,6379,27017" },
];

export function ScanForm({ onScan }: { onScan: (scan: Scan) => void }) {
  const [target, setTarget] = useState("");
  const [ports, setPorts] = useState(presets[1].ports);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = ports.split(",").map((value) => Number(value.trim()));
    if (!target.trim() || /\s|:\/\/|\//.test(target.trim())) {
      setError("Enter a hostname or IP address, without a URL path or protocol."); return;
    }
    if (!ports.trim() || parsed.some((value) => !Number.isInteger(value) || value < 1 || value > 65535)) {
      setError("Enter comma-separated port numbers between 1 and 65535."); return;
    }
    setLoading(true); setError("");
    try {
      const response = await api.post<Scan>("/scans", { target: target.trim(), ports: [...new Set(parsed)] });
      onScan(response.data);
    } catch (cause) {
      const detail = isAxiosError(cause) ? cause.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Could not start this scan. Please try again.");
    } finally { setLoading(false); }
  }

  return <form className="panel scan-launcher" onSubmit={submit} id="new-scan">
    <div className="section-heading"><div><p className="eyebrow">DISCOVERY</p><h2>Launch a scan</h2></div><div className="section-icon"><Radar size={22} /></div></div>
    <p className="muted">Analyze a system you own or have permission to test.</p>
    <label htmlFor="scan-target">Target hostname or IP</label>
    <input id="scan-target" placeholder="e.g. server.example.com" value={target} onChange={(event) => setTarget(event.target.value)} disabled={loading} autoComplete="off" required />
    <div className="preset-heading"><label htmlFor="scan-ports">TCP ports</label><span className="muted">Choose a preset</span></div>
    <div className="preset-options">{presets.map((preset) => <button key={preset.label} type="button" className={ports === preset.ports ? "preset active" : "preset"} aria-pressed={ports === preset.ports} onClick={() => setPorts(preset.ports)} disabled={loading}>{preset.label}</button>)}</div>
    <input id="scan-ports" value={ports} onChange={(event) => setPorts(event.target.value)} disabled={loading} required />
    {error && <div className="error" role="alert">{error}</div>}
    <button className="launch-button" disabled={loading}>{loading ? <><LoaderCircle size={17} className="spin" /> Queueing scan…</> : <>Run scan <ArrowRight size={17} /></>}</button>
    <p className="field-hint">Scans run in the background. Open a scan to follow its status.</p>
  </form>;
}
