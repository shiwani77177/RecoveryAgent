import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAllAuditLogs } from "../api/client";
import axios from "axios";
import {
  Search,
  DollarSign,
  Bot,
  Monitor,
  User,
  Clock,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/*Actor badge styles*/
const actorConfig = {
  AGENT: {
    label: "Agent",
    icon: Bot,
    bg: "bg-violet-100",
    text: "text-violet-700",
  },
  SYSTEM: {
    label: "System",
    icon: Monitor,
    bg: "bg-blue-100",
    text: "text-blue-700",
  },
  HUMAN: {
    label: "Human",
    icon: User,
    bg: "bg-green-100",
    text: "text-green-700",
  },
};

/*Action badge colors*/
const actionColors = {
  CASE_DETECTED: "bg-gray-100 text-gray-700",
  DIAGNOSED: "bg-violet-100 text-violet-700",
  INTERVENTION_SUCCEEDED: "bg-green-100 text-green-700",
  INTERVENTION_FAILED: "bg-red-100 text-red-700",
  ESCALATED: "bg-amber-100 text-amber-700",
  ABANDONED: "bg-red-100 text-red-700",
  RETRY_SCHEDULED: "bg-blue-100 text-blue-700",
  GUARDRAIL_BLOCKED: "bg-orange-100 text-orange-700",
};

function AuditLog() {
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("ALL");
  const [moneyOnly, setMoneyOnly] = useState(false);
  const [actionFilter, setActionFilter] = useState("ALL");

  // Integrity verification state
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const {
    data: logs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: fetchAllAuditLogs,
    refetchInterval: 10000,
  });

  const actionTypes = useMemo(() => {
    const types = [...new Set(logs.map((l) => l.action).filter(Boolean))];
    return types.sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs
      .filter((log) => {
        if (search) {
          const q = search.toLowerCase();
          const caseId = (log.caseId || "").toLowerCase();
          const action = (log.action || "").toLowerCase();
          const reason = (log.reason || "").toLowerCase();
          if (!caseId.includes(q) && !action.includes(q) && !reason.includes(q))
            return false;
        }
        if (actorFilter !== "ALL" && log.actor !== actorFilter) return false;
        if (moneyOnly && !log.moneyAction) return false;
        if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [logs, search, actorFilter, moneyOnly, actionFilter]);

  const stats = useMemo(() => {
    const moneyRows = logs.filter((l) => l.moneyAction);
    const totalAmount = moneyRows.reduce((sum, l) => sum + (l.amount || 0), 0);
    return {
      total: logs.length,
      agentActions: logs.filter((l) => l.actor === "AGENT").length,
      systemActions: logs.filter((l) => l.actor === "SYSTEM").length,
      moneyActions: moneyRows.length,
      totalAmount,
    };
  }, [logs]);

  // Run SHA-256 integrity verification against all audit entries
  const runIntegrityCheck = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const token = localStorage.getItem("ra_token");
      const res = await axios.post(
        "/api/audit/verify",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setVerifyResult(res.data);
    } catch (e) {
      setVerifyResult({
        clean: false,
        message: "Verification request failed: " + e.message,
      });
    } finally {
      setVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">
          Failed to load audit logs. Check if the backend is running.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every decision, intervention, and guardrail check — append-only,
            tamper-proof.
          </p>
        </div>

        {/* SHA-256 VERIFY BUTTON */}
        <button
          onClick={runIntegrityCheck}
          disabled={verifying}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {verifying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" /> Verify SHA-256 Integrity
            </>
          )}
        </button>
      </div>

      {/* INTEGRITY RESULT BANNER */}
      {verifyResult && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${
            verifyResult.clean
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          {verifyResult.clean ? (
            <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p
              className={`text-sm font-semibold ${verifyResult.clean ? "text-green-800" : "text-red-800"}`}
            >
              {verifyResult.message}
            </p>
            {verifyResult.total && (
              <p className="text-xs text-gray-500 mt-1">
                {verifyResult.passed} passed · {verifyResult.failed} failed ·{" "}
                {verifyResult.missing} without hash · {verifyResult.total} total
              </p>
            )}
          </div>
          <button
            onClick={() => setVerifyResult(null)}
            className="ml-auto text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total entries</p>
        </div>
        <div className="bg-violet-50 rounded-lg border border-violet-200 p-3 text-center">
          <p className="text-xl font-bold text-violet-700">
            {stats.agentActions}
          </p>
          <p className="text-xs text-violet-600">Agent decisions</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center">
          <p className="text-xl font-bold text-blue-700">
            {stats.systemActions}
          </p>
          <p className="text-xs text-blue-600">System actions</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-3 text-center">
          <p className="text-xl font-bold text-green-700">
            {stats.moneyActions}
          </p>
          <p className="text-xs text-green-600">
            Money actions (₹{stats.totalAmount.toLocaleString("en-IN")})
          </p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search case ID, action, or reason..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {["ALL", "AGENT", "SYSTEM", "HUMAN"].map((actor) => (
              <button
                key={actor}
                onClick={() => setActorFilter(actor)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  actorFilter === actor
                    ? "bg-violet-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {actor === "ALL" ? "All Actors" : actor}
              </button>
            ))}
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            <option value="ALL">All Actions</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <button
            onClick={() => setMoneyOnly(!moneyOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
              moneyOnly
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            {moneyOnly ? "₹ Money Only" : "₹ Money Filter"}
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs text-gray-400">
            Showing {filtered.length} of {logs.length} entries
            {search && <span> · search: "{search}"</span>}
          </p>
          {(search ||
            actorFilter !== "ALL" ||
            moneyOnly ||
            actionFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setActorFilter("ALL");
                setMoneyOnly(false);
                setActionFilter("ALL");
              }}
              className="text-xs text-violet-600 hover:text-violet-800 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* AUDIT TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Case ID</th>
                <th className="px-5 py-3 min-w-[280px]">Reason</th>
                <th className="px-5 py-3 text-center">Integrity</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-gray-400"
                  >
                    No audit log entries match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((log, i) => {
                  const actor = actorConfig[log.actor] || actorConfig.SYSTEM;
                  const ActorIcon = actor.icon;
                  const actionColor =
                    actionColors[log.action] || "bg-gray-100 text-gray-600";

                  return (
                    <tr
                      key={log.id || i}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs">
                            {log.createdAt
                              ? formatDistanceToNow(new Date(log.createdAt), {
                                  addSuffix: true,
                                })
                              : "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${actor.bg} ${actor.text}`}
                        >
                          <ActorIcon className="w-3 h-3" />
                          {actor.label}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <span className="font-mono text-xs text-gray-500">
                          {log.caseId ? log.caseId.substring(0, 8) + "…" : "—"}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">
                          {log.reason || "—"}
                        </p>
                      </td>

                      {/* SHA-256 hash indicator */}
                      <td className="px-5 py-3 text-center">
                        {log.integrityHash ? (
                          <span
                            title={`SHA-256: ${log.integrityHash}`}
                            className="inline-flex items-center justify-center"
                          >
                            <ShieldCheck className="w-4 h-4 text-green-500" />
                          </span>
                        ) : (
                          <span title="No hash stored">
                            <ShieldOff className="w-4 h-4 text-gray-300" />
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-right">
                        {log.moneyAction && log.amount ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            💰 ₹{Number(log.amount).toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AuditLog;
