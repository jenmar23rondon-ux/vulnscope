import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, GitCompareArrows, LoaderCircle, Radar, Search, X } from "lucide-react";
import { api } from "../services/api";
import type { Scan, ScanComparison } from "../types";
import { scanDate } from "../utils/format";
import { ReportDownloads } from "./ReportDownloads";

type DetailTab = "overview" | "ports" | "findings" | "compare";

export function ScanDetails({ scan, open, onClose }: { scan: Scan | null; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [openOnly, setOpenOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [comparison, setComparison] = useState<ScanComparison | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [compareRetry, setCompareRetry] = useState(0);

  useEffect(() => { setTab("overview"); setSearch(""); setOpenOnly(false); }, [scan?.id]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && scan && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
    return () => { if (dialog?.open) dialog.close(); };
  }, [open, scan?.id]);

  useEffect(() => {
    if (!open || tab !== "compare" || !scan) return;
    const controller = new AbortController();
    setComparing(true); setComparison(null); setCompareError("");
    api.get<ScanComparison>(`/scans/${scan.id}/compare-previous`, { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setComparison(response.data); })
      .catch(() => { if (!controller.signal.aborted) setCompareError("Could not load the comparison."); })
      .finally(() => { if (!controller.signal.aborted) setComparing(false); });
    return () => controller.abort();
  }, [open, tab, scan?.id, scan?.status, compareRetry]);

  if (!scan) return null;
  const completed = scan.status === "completed";
  const active = scan.status === "queued" || scan.status === "running";
  const openPorts = scan.ports.filter((port) => port.state === "open");
  const visiblePorts = scan.ports.filter((port) => (!openOnly || port.state === "open") && `${port.port} ${port.service} ${port.protocol}`.toLowerCase().includes(search.toLowerCase()));
  function navigateTabs(event: React.KeyboardEvent, current: DetailTab) {
    const tabs: DetailTab[] = completed ? ["overview", "ports", "findings", "compare"] : ["overview", "ports", "findings"];
    const index = tabs.indexOf(current);
    const next = event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length] : event.key === "ArrowLeft" ? tabs[(index - 1 + tabs.length) % tabs.length] : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : null;
    if (next) { event.preventDefault(); setTab(next); document.getElementById(`detail-tab-${next}`)?.focus(); }
  }

  return <dialog ref={dialogRef} className="scan-drawer" aria-labelledby="scan-detail-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="drawer-content">
      <header className="drawer-header"><div><p className="eyebrow">SCAN #{scan.id}</p><h2 id="scan-detail-title">{scan.target}</h2><span className={`scan-status status-${scan.status}`}><i />{scan.status}</span></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close scan details" autoFocus><X size={22} /></button></header>
      {active && <div className="activity-banner" role="status"><LoaderCircle size={17} className="spin" /><div><strong>{scan.status === "queued" ? "Waiting to start" : "Scan in progress"}</strong><span>Results appear as soon as the scan finishes.</span></div></div>}
      {scan.status === "failed" && <div className="error">This scan did not finish. No final risk score is available.</div>}
      <div className="detail-tabs" role="tablist" aria-label="Scan detail sections">{(["overview", "ports", "findings", "compare"] as const).map((item) => <button key={item} role="tab" type="button" id={`detail-tab-${item}`} aria-selected={tab === item} aria-controls="scan-tab-panel" tabIndex={tab === item ? 0 : -1} disabled={item === "compare" && !completed} onKeyDown={(event) => navigateTabs(event, item)} onClick={() => setTab(item)} className={tab === item ? "active" : ""}>{item === "ports" ? `Ports (${scan.ports.length})` : item === "findings" ? `Findings (${scan.vulnerabilities.length})` : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      <div id="scan-tab-panel" role="tabpanel" aria-labelledby={`detail-tab-${tab}`}>
        {tab === "overview" && <>
          <div className="detail-metrics"><div><span>Risk score</span><strong>{completed ? scan.risk_score : "—"}<small>{completed ? "/100" : ""}</small></strong>{completed && <div className="risk-meter"><i style={{ width: `${Math.max(0, Math.min(100, scan.risk_score))}%` }} /></div>}</div><div><span>Open ports</span><strong>{openPorts.length}<small>/{scan.ports.length}</small></strong></div><div><span>Findings</span><strong>{scan.vulnerabilities.length}</strong></div></div>
          <dl className="detail-facts"><div><dt>Started</dt><dd>{scanDate(scan.started_at)}</dd></div><div><dt>Finished</dt><dd>{scanDate(scan.finished_at)}</dd></div></dl>
          <div className="detail-shortcuts"><button type="button" className="button-secondary" onClick={() => setTab("ports")}><Radar size={17} /> Explore ports <ArrowUpRight size={16} /></button><button type="button" className="button-secondary" disabled={!completed} onClick={() => setTab("compare")}><GitCompareArrows size={17} /> Compare with previous</button></div>
          <section className="export-box"><div><h3>Export this scan</h3><p className="muted">Download the results as CSV or PDF.</p></div><ReportDownloads scanId={scan.id} disabled={!completed} /></section>
        </>}
        {tab === "ports" && <>
          <div className="port-tools"><div className="history-search"><Search size={16} /><input aria-label="Search ports or services" placeholder="Search ports or services…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><label className="switch-label"><input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} /> Open only</label></div>
          {visiblePorts.length ? <table className="detail-table"><thead><tr><th>Port</th><th>Service</th><th>State</th></tr></thead><tbody>{visiblePorts.map((port) => <tr key={port.id}><td>{port.port}/{port.protocol}</td><td>{port.service}</td><td><span className={`port-state ${port.state === "open" ? "is-open" : ""}`}>{port.state}</span></td></tr>)}</tbody></table> : <div className="subtle-empty"><Radar /><p>{active ? "Waiting for port results…" : "No ports match these filters."}</p></div>}
        </>}
        {tab === "findings" && <>{scan.vulnerabilities.length ? scan.vulnerabilities.map((finding) => <details className="finding-accordion" key={finding.id}><summary><span><strong>{finding.cve}</strong><span className={`severity severity-${finding.severity.toLowerCase()}`}>{finding.severity}</span></span><b>CVSS {finding.cvss_score}</b></summary><p>{finding.description}</p></details>) : <div className="subtle-empty"><CheckCircle2 /><h3>{completed ? "No CVE-style findings" : "No findings available"}</h3><p>{completed ? "No findings were recorded for this scan." : "Findings are available after a successful scan."}</p></div>}</>}
        {tab === "compare" && <>
          {comparing && <div className="subtle-empty" role="status"><LoaderCircle className="spin" /><p>Comparing scan results…</p></div>}
          {compareError && <div className="error" role="alert">{compareError}<button type="button" className="button-secondary" onClick={() => setCompareRetry((value) => value + 1)}>Try again</button></div>}
          {comparison && (comparison.previous_scan_id === null ? <div className="subtle-empty"><GitCompareArrows /><h3>First scan for this target</h3><p>A comparison will be available after another scan of the same target.</p></div> : <>
            <p className="muted">Comparing scan #{scan.id} with #{comparison.previous_scan_id} for the same target.</p>
            <div className="comparison-delta">{(comparison.risk_delta ?? 0) > 0 ? <ArrowUpRight /> : <ArrowDownRight />}<strong>{(comparison.risk_delta ?? 0) > 0 ? "+" : ""}{comparison.risk_delta ?? 0}</strong><span>risk score change</span></div>
            <div className="comparison-grid">{(["new", "fixed", "persisting"] as const).map((kind) => <section key={kind}><span>{kind === "new" ? "New findings" : kind === "fixed" ? "No longer detected" : "Still present"}</span><strong>{comparison[kind].length}</strong>{comparison[kind].length ? <ul>{comparison[kind].map((cve) => <li key={cve}>{cve}</li>)}</ul> : <p className="muted">None</p>}</section>)}</div>
          </>)}
        </>}
      </div>
    </div>
  </dialog>;
}
