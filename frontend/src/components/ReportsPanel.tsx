import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, LoaderCircle, Search } from "lucide-react";
import { api } from "../services/api";
import type { ScanHistoryPage } from "../types";
import { scanDate } from "../utils/format";
import { ReportDownloads } from "./ReportDownloads";

export function ReportsPanel({ refreshKey, onOpenScan }: { refreshKey: number; onOpenScan: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ScanHistoryPage>({ items: [], total: 0, page: 1, page_size: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    api.get<ScanHistoryPage>("/scans/history", { params: { search: term, page, status: "completed" }, signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setData(response.data); })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load reports."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [term, page, refreshKey, retry]);
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  return <section className="panel explorer-panel"><div className="section-heading"><div><p className="eyebrow">DELIVERABLES</p><h2>Report library</h2><p className="muted">Export a completed scan without leaving your workspace.</p></div><FileText className="accent-icon" /></div>
    <div className="history-search standalone-search"><Search size={17} /><input aria-label="Search reports by target" placeholder="Search reports by target…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    {loading && <div className="history-loading" role="status"><LoaderCircle size={16} className="spin" /> Loading reports…</div>}
    {error ? <div className="error" role="alert">{error}<button className="button-secondary" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : data.items.length ? <div className="report-library" aria-busy={loading}>{data.items.map((scan) => <article className="report-card" key={scan.id}><div className="report-card-icon"><FileText size={22} /></div><div><button type="button" className="text-button" onClick={() => onOpenScan(scan.id)}>{scan.target}</button><p>Scan #{scan.id} · {scanDate(scan.started_at)}</p><span>{scan.vulnerabilities.length} findings · Risk {scan.risk_score}/100</span></div><ReportDownloads scanId={scan.id} /></article>)}</div> : !loading && <div className="history-empty"><FileText size={32} /><h3>No reports available</h3><p>{term ? "Try another target." : "Complete a scan to generate CSV and PDF reports."}</p></div>}
    <div className="history-footer"><span>{data.total} completed scans</span><div className="history-pagination"><button className="button-secondary" type="button" aria-label="Previous reports page" disabled={loading || data.page <= 1} onClick={() => setPage(data.page - 1)}><ChevronLeft size={17} /></button><span>Page {data.page} of {pages}</span><button className="button-secondary" type="button" aria-label="Next reports page" disabled={loading || data.page >= pages} onClick={() => setPage(data.page + 1)}><ChevronRight size={17} /></button></div></div>
  </section>;
}
