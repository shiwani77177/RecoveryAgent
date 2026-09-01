const styles = {
  RECOVERED: "bg-green-100 text-green-800",
  DETECTED: "bg-blue-100 text-blue-800",
  DIAGNOSING: "bg-blue-100 text-blue-800",
  EXECUTING: "bg-blue-100 text-blue-800",
  WAITING: "bg-amber-100 text-amber-800",
  ESCALATED: "bg-amber-100 text-amber-800",
  ABANDONED: "bg-red-100 text-red-800",
};

function StatusBadge({ status }) {
  const style = styles[status] || "bg-gray-100 text-gray-800";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}
    >
      {status}
    </span>
  );
}

export default StatusBadge;

