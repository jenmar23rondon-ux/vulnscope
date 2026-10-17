import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, History, LoaderCircle, RotateCcw, Search, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { api } from "../services/api";
import type { Scan, ScanHistoryPage } from "../types";
import { scanDate } from "../utils/format";

type Props = {
  totalScans: number;
  initialSearch?: string;
  selectedId?: number;
  refreshKey: number;
  canReset: boolean;
  onSelect: (scan: Scan) => void;
  onReset: () => void;
};

const statusLabels: Record<string, string> = {
  completed: "Completed", running: "Running", queued: "Queued", failed: "Failed"
};

export function ScanHistory({ totalScans, initialSearch = "", selectedId, refreshKey, canReset, onSelect, onReset }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [term, setTerm] = useState(initialSearch);
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<ScanHistoryPage>({ items: [], total: 0, page: 1, page_size: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setTerm(search.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api.get<ScanHistoryPage>("/scans/history", {
      params: { search: term, status, sort, page, page_size: 10 }, signal: controller.signal
    }).then((response) => {
      if (!controller.signal.aborted) setData(response.data);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Could not load scan history. Please try again.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [term, status, sort, page, refreshKey, reload]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (showReset && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [showReset]);

  function clearFilters() {
    setSearch(""); setTerm(""); setStatus("all"); setSort("newest"); setPage(1);
  }

  function closeReset() {
    if (!resetting) setShowReset(false);
  }

  async function resetHistory(event: React.FormEvent) {
    event.preventDefault();
    if (confirmation !== "RESET" || resetting) return;
    setResetting(true);
    setResetError("");
    try {
      const response = await api.delete<{ deleted: { scans: number } }>("/scans/history", { data: { confirmation } });
      setData({ items: [], total: 0, page: 1, page_size: 10 });
      clearFilters();
      setShowReset(false);
      setNotice(`History reset. Deleted ${response.data.deleted.scans} scans and their results.`);
      onReset();
      setReload((value) => value + 1);
    } catch (cause) {
      const detail = isAxiosError(cause) ? cause.response?.data?.detail : null;
      setResetError(typeof detail === "string" ? detail : "Could not confirm the reset. Refresh the history to check its status before trying again.");
    } finally {
      setResetting(false);
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  const filtered = Boolean(term || status !== "all");

  return (
    <section className="panel history-panel" id="scan-history" aria-labelledby="history-heading">
      <div className="history-header">
        <div>
          <p className="history-eyebrow"><History size={14} aria-hidden="true" /> ACTIVITY</p>
          <h2 id="history-heading">Scan history</h2>
          <p className="muted history-description">{totalScans} saved scans. Select one to view its results.</p>
        </div>
        <div className="history-actions">
          <button type="button" className="button-secondary" disabled={loading} onClick={() => setReload((value) => value + 1)}>
            <RotateCcw size={16} className={loading ? "spin" : ""} aria-hidden="true" /> Refresh
          </button>
          {canReset && <button type="button" className="button-danger-outline" disabled={totalScans === 0 || resetting} onClick={() => { setConfirmation(""); setResetError(""); setShowReset(true); }}>
            <Trash2 size={16} aria-hidden="true" /> Reset history
          </button>}
        </div>
      </div>

      {notice && <div className="history-notice" role="status">{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button></div>}

      <div className="history-toolbar">
        <div className="history-search">
          <Search size={17} aria-hidden="true" />
          <label className="sr-only" htmlFor="history-search">Search by domain or IP</label>
          <input id="history-search" type="search" placeholder="Search by domain or IP…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div>
          <label className="sr-only" htmlFor="history-status">Filter by status</label>
          <select id="history-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="all">All statuses</option>
            <option value="completed">Completed</option><option value="running">Running</option>
            <option value="queued">Queued</option><option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="sr-only" htmlFor="history-sort">Sort history</label>
          <select id="history-sort" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="risk">Highest risk</option>
          </select>
        </div>
      </div>

      {error ? <div className="history-empty" role="alert"><p>{error}</p><button className="button-secondary" onClick={() => setReload((value) => value + 1)}>Try again</button></div> : (
        <div className="history-results" aria-busy={loading}>
          {loading && <div className="history-loading" role="status"><LoaderCircle className="spin" size={16} /> Loading history…</div>}
          {data.items.length > 0 ? <div className="history-table-scroll" tabIndex={0} role="region" aria-label="Scan history table">
            <table className="history-table">
              <thead><tr><th scope="col">Target</th><th scope="col">Status</th><th scope="col">Risk</th><th scope="col">Started</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
              <tbody>{data.items.map((scan) => <tr key={scan.id} className={selectedId === scan.id ? "is-selected" : ""}>
                <td><button type="button" className="history-target" onClick={() => onSelect(scan)} aria-label={`View results for ${scan.target}, scan ${scan.id}`} aria-pressed={selectedId === scan.id}>
                  <strong>{scan.target}</strong><span>#{scan.id} · {scan.vulnerabilities.length} findings {selectedId === scan.id && "· Selected"}</span>
                </button></td>
                <td><span className={`scan-status status-${scan.status}`}><i aria-hidden="true" />{statusLabels[scan.status] ?? scan.status}</span></td>
                <td>{scan.status === "completed" ? <span className={`history-risk ${scan.risk_score >= 60 ? "risk-high" : scan.risk_score >= 30 ? "risk-medium" : "risk-low"}`}>{scan.risk_score}<small>/100</small></span> : <span className="muted" title="No final result">—</span>}</td>
                <td><time dateTime={scan.started_at}>{scanDate(scan.started_at)}</time></td>
                <td><button type="button" className="history-detail" aria-label={`Open details for scan ${scan.id}`} onClick={() => onSelect(scan)}><ArrowUpRight size={18} /></button></td>
              </tr>)}</tbody>
            </table>
          </div> : !loading && <div className="history-empty">
            <History size={32} aria-hidden="true" /><h3>{filtered ? "No matching scans" : "Ready for a fresh start"}</h3>
            <p>{filtered ? "Try another target or change the status filter." : "Your history is empty. New scans will appear here."}</p>
            {filtered && <button type="button" className="button-secondary" onClick={clearFilters}>Clear filters</button>}
          </div>}
        </div>
      )}

      <div className="history-footer">
        <span aria-live="polite">{data.total > 0 ? `${(data.page - 1) * data.page_size + 1}–${Math.min(data.page * data.page_size, data.total)} of ${data.total} results` : "0 results"}</span>
        <div className="history-pagination">
          <button type="button" className="button-secondary" aria-label="Previous page" disabled={data.page <= 1 || loading} onClick={() => setPage(data.page - 1)}><ChevronLeft size={17} /></button>
          <span>Page {data.page} of {pages}</span>
          <button type="button" className="button-secondary" aria-label="Next page" disabled={data.page >= pages || loading} onClick={() => setPage(data.page + 1)}><ChevronRight size={17} /></button>
        </div>
      </div>

      {showReset && <dialog ref={dialogRef} className="reset-dialog" aria-labelledby="reset-title" aria-describedby="reset-description" onCancel={(event) => { event.preventDefault(); closeReset(); }} onClick={(event) => { if (event.target === event.currentTarget) closeReset(); }}>
        <form onSubmit={resetHistory}>
          <div className="reset-icon"><Trash2 size={24} aria-hidden="true" /></div>
          <h2 id="reset-title">Start over?</h2>
          <p id="reset-description">This will delete all scan history: scans, detected ports, findings and associated reports. Metrics and charts will return to zero.</p>
          <p className="reset-preserved">Your accounts, credentials, settings and scheduled scans will be kept.</p>
          <div className="reset-warning">This action cannot be undone. Resetting affects the shared history for all users.</div>
          <label htmlFor="reset-confirmation">Type <strong>RESET</strong> to confirm</label>
          <input id="reset-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} disabled={resetting} />
          {resetError && <div className="error" role="alert">{resetError}</div>}
          <div className="reset-actions">
            <button type="button" className="button-secondary" autoFocus onClick={closeReset} disabled={resetting}>Cancel</button>
            <button type="submit" className="button-danger" disabled={confirmation !== "RESET" || resetting}>{resetting ? <><LoaderCircle size={16} className="spin" /> Resetting…</> : "Yes, reset history"}</button>
          </div>
        </form>
      </dialog>}
    </section>
  );
}
