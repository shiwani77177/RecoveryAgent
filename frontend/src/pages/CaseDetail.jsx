import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCaseById,
  fetchCaseAttempts,
  fetchCaseAudit,
  processCase,
} from "../api/client";
import {
  ArrowLeft,
  Loader2,
  Play,
  User,
  Bot,
  Monitor,
  Zap,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useState } from "react";

function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: () => fetchCaseById(id),
  });

  const { data: attempts } = useQuery({
    queryKey: ["caseAttempts", id],
    queryFn: () => fetchCaseAttempts(id),
  });

  const { data: auditTrail, isLoading: auditLoading } = useQuery({
    queryKey: ["caseAudit", id],
    queryFn: () => fetchCaseAudit(id),
  });

  const handleProcess = async () => {
    setProcessing(true);
    try {
      await processCase(id);
      toast.success("Case processed!");
      queryClient.invalidateQueries(["case", id]);
      queryClient.invalidateQueries(["caseAttempts", id]);
      queryClient.invalidateQueries(["caseAudit", id]);
    } catch (e) {
      toast.error("Processing failed");
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!c) return <div className="text-red-600">Case not found</div>;

  const lastAttempt =
    attempts?.length > 0 ? attempts[attempts.length - 1] : null;

  return (
    <div>
      {/*Header*/}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/cases")}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Case {c.id?.substring(0, 8)}…
            </h1>
            <p className="text-sm text-gray-500">{fmt(c.type)}</p>
          </div>
        </div>
        {(c.status === "DETECTED" || c.status === "WAITING") && (
          <button
            onClick={handleProcess}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Process this case
          </button>
        )}
      </div>

      {/*Info Cards*/}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <InfoCard title="Case Info">
          <Row label="Type" value={fmt(c.type)} />
          <Row
            label="Amount"
            value={`₹${Number(c.amount).toLocaleString("en-IN")}`}
            mono
          />
          <Row label="Risk Reason" value={c.riskReason} mono />
          <Row label="Customer" value={c.customerId} mono />
          <Row label="Attempts" value={`${c.attemptCount} of 4`} />
          <Row label="Status" value={<StatusBadge status={c.status} />} />
        </InfoCard>

        <InfoCard title="Recovery">
          <Row
            label="Recovered"
            value={
              c.recoveredAmount > 0
                ? `₹${Number(c.recoveredAmount).toLocaleString("en-IN")}`
                : "—"
            }
            mono
            green={c.recoveredAmount > 0}
          />
          <Row
            label="Last Intervention"
            value={lastAttempt ? fmt(lastAttempt.interventionType) : "—"}
          />
          <Row label="Channel" value={lastAttempt?.channel || "—"} />
          <Row label="Decided By" value={lastAttempt?.decidedBy || "—"} />
          <Row
            label="Resolved At"
            value={
              c.resolvedAt
                ? format(new Date(c.resolvedAt), "dd MMM yyyy, HH:mm")
                : "—"
            }
          />
        </InfoCard>
      </div>

      {/*Audit Trail*/}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
          Audit Trail
        </h3>
        {auditLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : !auditTrail?.length ? (
          <div className="text-center py-8 text-gray-400">
            No audit entries yet
          </div>
        ) : (
          <div className="space-y-0">
            {auditTrail.map((entry, i) => (
              <AuditEntry
                key={entry.id}
                entry={entry}
                isLast={i === auditTrail.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

{
  /*Helper components*/
}
function InfoCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value, mono, green }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span
        className={`text-sm font-medium ${green ? "text-green-600" : "text-gray-900"} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function AuditEntry({ entry, isLast }) {
  const dotColor = getDotColor(entry.action);

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`}
        />
        {!isLast && <div className="w-0.5 bg-gray-200 flex-1 mt-1" />}
      </div>
      <div className="pb-6 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {fmt(entry.action)}
          </span>
          {entry.moneyAction && (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
              💰 Money Action
            </span>
          )}
        </div>
        {entry.reason && (
          <p className="text-sm text-gray-600 leading-relaxed mt-1">
            {entry.reason}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <ActorIcon actor={entry.actor} />
            {entry.actor}
          </span>
          {entry.createdAt && (
            <span>
              {format(new Date(entry.createdAt), "dd MMM · HH:mm:ss")}
            </span>
          )}
          {entry.amount && (
            <span className="font-mono">
              ₹{Number(entry.amount).toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActorIcon({ actor }) {
  if (actor === "AGENT") return <Bot className="w-3 h-3" />;
  if (actor === "HUMAN") return <User className="w-3 h-3" />;
  if (actor === "SYSTEM") return <Monitor className="w-3 h-3" />;
  return <Zap className="w-3 h-3" />;
}

function getDotColor(action) {
  if (!action) return "bg-gray-300";
  if (action.includes("DETECTED")) return "bg-gray-400";
  if (action.includes("DIAGNOSED")) return "bg-blue-400";
  if (action.includes("SUCCEEDED") || action.includes("RECOVERED"))
    return "bg-green-500";
  if (action.includes("FAILED")) return "bg-red-400";
  if (action.includes("ESCALATED")) return "bg-amber-400";
  if (action.includes("ABANDONED")) return "bg-red-500";
  if (action.includes("RETRY")) return "bg-amber-400";
  return "bg-gray-400";
}

function fmt(s) {
  if (!s) return "—";
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default CaseDetail;
