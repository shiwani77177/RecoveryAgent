const statusStyles = {
  DETECTED: "bg-violet-500/15 text-violet-400 ring-violet-500/30",
  DIAGNOSING: "bg-blue-500/15 text-blue-400 ring-blue-500/30 animate-pulse",
  EXECUTING: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/30 animate-pulse",
  WAITING: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  RECOVERED: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  ESCALATED: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  ABANDONED: "bg-red-500/15 text-red-400 ring-red-500/30",
};

const statusDot = {
  DETECTED: "bg-violet-400",
  DIAGNOSING: "bg-blue-400",
  EXECUTING: "bg-cyan-400",
  WAITING: "bg-blue-400",
  RECOVERED: "bg-emerald-400",
  ESCALATED: "bg-amber-400",
  ABANDONED: "bg-red-400",
};

function StatusBadge({ status }) {
  const style =
    statusStyles[status] || "bg-gray-500/15 text-gray-400 ring-gray-500/30";
  const dot = statusDot[status] || "bg-gray-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        text-[11px] font-semibold uppercase tracking-wide ring-1 ${style}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

export default StatusBadge;
