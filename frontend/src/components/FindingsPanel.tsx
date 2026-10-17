import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { api } from "../services/api";
import type { FindingsPage } from "../types";

export function FindingsPanel({ initialSeverity, refreshKey, onOpenScan }: { initialSeverity: string; refreshKey: number; onOpenScan: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [severity, setSeverity] = useState(initialSeverity);
  const [sort, setSort] = useState("risk");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FindingsPage>({ items: [], total: 0, page: 1, page_size: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    api.get<FindingsPage>("/vulnerabilities/search", { params: { search: term, severity, sort, page }, signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setData(response.data); })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load findings."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [term, severity, sort, page, refreshKey, retry]);
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  return <section className="panel explorer-panel"><div className="section-heading"><div><p className="eyebrow">INVESTIGATION</p><h2>Finding explorer</h2><p className="muted">Search across all recorded targets and scan results.</p></div><span className="count-badge">{data.total} findings</span></div>
    <div className="history-toolbar"><div className="history-search"><Search size={17} /><input aria-label="Search CVE, target or description" placeholder="Search CVE, target or description…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Finding severity" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }}><option value="all">All severities</option><option value="HIGH_CRITICAL">High + Critical</option>{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Sort findings" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="risk">Highest CVSS</option><option value="newest">Newest first</option></select></div>
    {loading && <div className="history-loading" role="status"><LoaderCircle size={16} className="spin" /> Loading findings…</div>}
    {error ? <div className="error" role="alert">{error}<button className="button-secondary" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : data.items.length ? <div className="findings-list" aria-busy={loading}>{data.items.map((finding) => <article className="finding-result" key={finding.id}><div className="finding-top"><span className={`severity severity-${finding.severity.toLowerCase()}`}>{finding.severity}</span><strong>{finding.cve}</strong><b>CVSS {finding.cvss_score}</b></div><p>{finding.description}</p><button type="button" className="text-button" onClick={() => onOpenScan(finding.scan_id)}>{finding.target} <span>· Scan #{finding.scan_id}</span><ArrowUpRight size={16} /></button></article>)}</div> : !loading && <div className="history-empty"><ShieldCheck size={32} /><h3>No findings match this view</h3><p>Change your filters or explore the results of a completed scan.</p><button type="button" className="button-secondary" onClick={() => { setSearch(""); setTerm(""); setSeverity("all"); setPage(1); }}>Clear filters</button></div>}
    <div className="history-footer"><span>{data.total} matching findings</span><div className="history-pagination"><button type="button" className="button-secondary" aria-label="Previous findings page" disabled={loading || data.page <= 1} onClick={() => setPage(data.page - 1)}><ChevronLeft size={17} /></button><span>Page {data.page} of {pages}</span><button type="button" className="button-secondary" aria-label="Next findings page" disabled={loading || data.page >= pages} onClick={() => setPage(data.page + 1)}><ChevronRight size={17} /></button></div></div>
  </section>;
}
