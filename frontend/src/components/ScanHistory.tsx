import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, History, LoaderCircle, RotateCcw, Search, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { api } from "../services/api";
import type { Scan, ScanHistoryPage } from "../types";

type Props = {
  totalScans: number;
  selectedId?: number;
  refreshKey: number;
  canReset: boolean;
  onSelect: (scan: Scan) => void;
  onReset: () => void;
};

const statusLabels: Record<string, string> = {
  completed: "Completado", running: "En curso", queued: "En cola", failed: "Fallido"
};

function scanDate(value: string) {
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function ScanHistory({ totalScans, selectedId, refreshKey, canReset, onSelect, onReset }: Props) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
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
      if (!controller.signal.aborted) setError("No se pudo cargar el historial. Inténtalo de nuevo.");
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
    if (confirmation !== "REINICIAR" || resetting) return;
    setResetting(true);
    setResetError("");
    try {
      const response = await api.delete<{ deleted: { scans: number } }>("/scans/history", { data: { confirmation } });
      setData({ items: [], total: 0, page: 1, page_size: 10 });
      clearFilters();
      setShowReset(false);
      setNotice(`Historial reiniciado. Se eliminaron ${response.data.deleted.scans} escaneos y sus resultados.`);
      onReset();
      setReload((value) => value + 1);
    } catch (cause) {
      const detail = isAxiosError(cause) ? cause.response?.data?.detail : null;
      setResetError(typeof detail === "string" ? detail : "No se pudo confirmar el reinicio. Actualiza el historial para comprobar su estado antes de reintentar.");
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
          <p className="history-eyebrow"><History size={14} aria-hidden="true" /> ACTIVIDAD</p>
          <h2 id="history-heading">Historial de escaneos</h2>
          <p className="muted history-description">{totalScans} escaneos guardados. Selecciona uno para ver sus resultados.</p>
        </div>
        <div className="history-actions">
          <button type="button" className="button-secondary" disabled={loading} onClick={() => setReload((value) => value + 1)}>
            <RotateCcw size={16} className={loading ? "spin" : ""} aria-hidden="true" /> Actualizar
          </button>
          {canReset && <button type="button" className="button-danger-outline" disabled={totalScans === 0 || resetting} onClick={() => { setConfirmation(""); setResetError(""); setShowReset(true); }}>
            <Trash2 size={16} aria-hidden="true" /> Reiniciar historial
          </button>}
        </div>
      </div>

      {notice && <div className="history-notice" role="status">{notice}<button type="button" aria-label="Cerrar aviso" onClick={() => setNotice("")}><X size={16} /></button></div>}

      <div className="history-toolbar">
        <div className="history-search">
          <Search size={17} aria-hidden="true" />
          <label className="sr-only" htmlFor="history-search">Buscar por dominio o IP</label>
          <input id="history-search" type="search" placeholder="Buscar por dominio o IP…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div>
          <label className="sr-only" htmlFor="history-status">Filtrar por estado</label>
          <select id="history-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="all">Todos los estados</option>
            <option value="completed">Completados</option><option value="running">En curso</option>
            <option value="queued">En cola</option><option value="failed">Fallidos</option>
          </select>
        </div>
        <div>
          <label className="sr-only" htmlFor="history-sort">Ordenar historial</label>
          <select id="history-sort" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
            <option value="newest">Más recientes</option><option value="oldest">Más antiguos</option><option value="risk">Mayor riesgo</option>
          </select>
        </div>
      </div>

      {error ? <div className="history-empty" role="alert"><p>{error}</p><button className="button-secondary" onClick={() => setReload((value) => value + 1)}>Reintentar</button></div> : (
        <div className="history-results" aria-busy={loading}>
          {loading && <div className="history-loading" role="status"><LoaderCircle className="spin" size={16} /> Cargando historial…</div>}
          {data.items.length > 0 ? <div className="history-table-scroll" tabIndex={0} role="region" aria-label="Tabla del historial de escaneos">
            <table className="history-table">
              <thead><tr><th scope="col">Objetivo</th><th scope="col">Estado</th><th scope="col">Riesgo</th><th scope="col">Fecha de inicio</th><th scope="col"><span className="sr-only">Detalle</span></th></tr></thead>
              <tbody>{data.items.map((scan) => <tr key={scan.id} className={selectedId === scan.id ? "is-selected" : ""}>
                <td><button type="button" className="history-target" onClick={() => onSelect(scan)} aria-label={`Ver resultados de ${scan.target}, escaneo ${scan.id}`} aria-pressed={selectedId === scan.id}>
                  <strong>{scan.target}</strong><span>#{scan.id} · {scan.vulnerabilities.length} hallazgos {selectedId === scan.id && "· Seleccionado"}</span>
                </button></td>
                <td><span className={`scan-status status-${scan.status}`}><i aria-hidden="true" />{statusLabels[scan.status] ?? scan.status}</span></td>
                <td>{scan.status === "completed" ? <span className={`history-risk ${scan.risk_score >= 60 ? "risk-high" : scan.risk_score >= 30 ? "risk-medium" : "risk-low"}`}>{scan.risk_score}<small>/100</small></span> : <span className="muted" title="Sin resultado final">—</span>}</td>
                <td><time dateTime={scan.started_at}>{scanDate(scan.started_at)}</time></td>
                <td><button type="button" className="history-detail" aria-label={`Abrir detalle del escaneo ${scan.id}`} onClick={() => onSelect(scan)}><ArrowUpRight size={18} /></button></td>
              </tr>)}</tbody>
            </table>
          </div> : !loading && <div className="history-empty">
            <History size={32} aria-hidden="true" /><h3>{filtered ? "No hay coincidencias" : "Todo listo para comenzar"}</h3>
            <p>{filtered ? "Prueba con otro objetivo o cambia el filtro de estado." : "Tu historial está vacío. Los próximos escaneos aparecerán aquí."}</p>
            {filtered && <button type="button" className="button-secondary" onClick={clearFilters}>Limpiar filtros</button>}
          </div>}
        </div>
      )}

      <div className="history-footer">
        <span aria-live="polite">{data.total > 0 ? `${(data.page - 1) * data.page_size + 1}–${Math.min(data.page * data.page_size, data.total)} de ${data.total} resultados` : "0 resultados"}</span>
        <div className="history-pagination">
          <button type="button" className="button-secondary" aria-label="Página anterior" disabled={data.page <= 1 || loading} onClick={() => setPage(data.page - 1)}><ChevronLeft size={17} /></button>
          <span>Página {data.page} de {pages}</span>
          <button type="button" className="button-secondary" aria-label="Página siguiente" disabled={data.page >= pages || loading} onClick={() => setPage(data.page + 1)}><ChevronRight size={17} /></button>
        </div>
      </div>

      {showReset && <dialog ref={dialogRef} className="reset-dialog" aria-labelledby="reset-title" aria-describedby="reset-description" onCancel={(event) => { event.preventDefault(); closeReset(); }} onClick={(event) => { if (event.target === event.currentTarget) closeReset(); }}>
        <form onSubmit={resetHistory}>
          <div className="reset-icon"><Trash2 size={24} aria-hidden="true" /></div>
          <h2 id="reset-title">¿Comenzar de nuevo?</h2>
          <p id="reset-description">Se eliminará todo el historial: escaneos, puertos detectados, hallazgos e informes asociados. Las métricas y gráficas volverán a cero.</p>
          <p className="reset-preserved">Tus usuarios, credenciales, configuración y escaneos programados se conservan.</p>
          <div className="reset-warning">Esta acción no se puede deshacer. El reinicio afecta al historial compartido de todos los usuarios.</div>
          <label htmlFor="reset-confirmation">Escribe <strong>REINICIAR</strong> para confirmar</label>
          <input id="reset-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} disabled={resetting} />
          {resetError && <div className="error" role="alert">{resetError}</div>}
          <div className="reset-actions">
            <button type="button" className="button-secondary" autoFocus onClick={closeReset} disabled={resetting}>Cancelar</button>
            <button type="submit" className="button-danger" disabled={confirmation !== "REINICIAR" || resetting}>{resetting ? <><LoaderCircle size={16} className="spin" /> Reiniciando…</> : "Sí, reiniciar historial"}</button>
          </div>
        </form>
      </dialog>}
    </section>
  );
}
