import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { api } from "../services/api";

export function ReportDownloads({ scanId, disabled = false }: { scanId: number; disabled?: boolean }) {
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function download(format: "csv" | "pdf") {
    setPending(format);
    setError("");
    try {
      const response = await api.get<Blob>(`/reports/${scanId}.${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vulnscope-scan-${scanId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Download failed. Please try again.");
    } finally { setPending(""); }
  }

  return <div className="report-downloads">
    <div className="inline-actions">{(["csv", "pdf"] as const).map((format) => <button key={format} type="button" className="button-secondary" disabled={disabled || Boolean(pending)} onClick={() => void download(format)} aria-label={`Download ${format.toUpperCase()} for scan ${scanId}`}>
      {pending === format ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />} {format.toUpperCase()}
    </button>)}</div>
    {error && <p className="inline-error" role="alert">{error}</p>}
  </div>;
}
