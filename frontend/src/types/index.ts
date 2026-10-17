export type PortResult = {
  id: number;
  port: number;
  protocol: string;
  service: string;
  state: string;
};

export type Vulnerability = {
  id: number;
  cve: string;
  severity: string;
  description: string;
  cvss_score: number;
};

export type Scan = {
  id: number;
  target: string;
  status: string;
  risk_score: number;
  started_at: string;
  finished_at?: string;
  ports: PortResult[];
  vulnerabilities: Vulnerability[];
};

export type DashboardData = {
  total_scans: number;
  open_ports: number;
  vulnerabilities: number;
  high_or_critical: number;
  average_risk: number;
  severity_counts: { severity: string; count: number }[];
  risk_trend: { scan: number; target: string; risk_score: number; started_at: string }[];
  top_targets: { target: string; scans: number; max_risk: number; critical_or_high: number }[];
  recent_scans: Scan[];
};

export type ScanHistoryPage = {
  items: Scan[];
  total: number;
  page: number;
  page_size: number;
};

export type Finding = Vulnerability & { scan_id: number; target: string };
export type FindingsPage = { items: Finding[]; total: number; page: number; page_size: number };
export type ScanComparison = {
  scan_id: number;
  previous_scan_id: number | null;
  risk_delta?: number;
  new: string[];
  fixed: string[];
  persisting: string[];
};
export type WorkspaceView = "overview" | "scans" | "findings" | "reports";
