// Semantic status pills used across admin surfaces
const MAP = {
  New: { bg: "#3B82F6", label: "New" },
  Declined: { bg: "#EF4444", label: "Declined" },
  "Accepted – Awaiting Deposit": { bg: "#F59E0B", label: "Awaiting Deposit" },
  "Awaiting Manual Payment Confirmation": {
    bg: "#F59E0B",
    label: "Awaiting Payment",
  },
  "In Queue": { bg: "#8A8588", label: "In Queue" },
  Sketching: { bg: "#3B82F6", label: "Sketching" },
  "Final Review": { bg: "#8B5CF6", label: "Final Review" },
  "Delivered – Awaiting Final Payment": {
    bg: "#F59E0B",
    label: "Awaiting Final $",
  },
  "Delivered – Awaiting Review": {
    bg: "#22C55E",
    label: "Awaiting Review",
  },
  Closed: { bg: "#1A1A1A", label: "Closed" },
  "Awaiting Response": { bg: "#F59E0B", label: "Awaiting" },
};

export default function StatusPill({ status, className = "" }) {
  const meta = MAP[status] || { bg: "#8A8588", label: status || "—" };
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
