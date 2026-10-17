export function scanDate(value?: string) {
  if (!value) return "Not finished";
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export const severityColors: Record<string, string> = {
  LOW: "#38bdf8", MEDIUM: "#fbbf24", HIGH: "#fb923c", CRITICAL: "#fb7185"
};
