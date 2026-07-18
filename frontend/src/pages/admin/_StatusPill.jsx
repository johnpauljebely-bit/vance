// Semantic status pills used across admin surfaces — each stage gets its
// own distinct color so the pipeline is scannable at a glance, not just
// reused green/red/blue semantics.
export const STATUS_COLOR_MAP = {
  New: { bg: "#3B82F6", label: "New" },
  "Accepted – Awaiting Deposit": { bg: "#F97316", label: "Awaiting Deposit" },
  "In Queue": { bg: "#A855F7", label: "In Queue" },
  Sketching: { bg: "#6366F1", label: "Sketching" },
  "Final Review": { bg: "#14B8A6", label: "Final Review" },
  "Delivered – Awaiting Final Payment": {
    bg: "#EA580C",
    label: "Awaiting Final $",
  },
  "Delivered – Awaiting Review": {
    bg: "#CA8A04",
    label: "Awaiting Review",
  },
  Closed: { bg: "#22C55E", label: "Closed" },
  Declined: { bg: "#EF4444", label: "Declined" },
  "Awaiting Manual Payment Confirmation": {
    bg: "#6B7280",
    label: "Awaiting Payment",
  },
  "Awaiting Response": { bg: "#F59E0B", label: "Awaiting" },
};

export default function StatusPill({ status, className = "" }) {
  const meta = STATUS_COLOR_MAP[status] || { bg: "#8A8588", label: status || "—" };
  return (
    <span
      data-testid={`status-pill-${(status || "unknown").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${className}`}
      style={{ backgroundColor: meta.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
      {meta.label}
    </span>
  );
}
