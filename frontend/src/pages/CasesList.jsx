import { useQuery } from "@tanstack/react-query";
import { fetchCases } from "../api/client";
import { useNavigate } from "react-router-dom";
import { Loader2, FileText } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { formatDistanceToNow } from "date-fns";

function CasesList() {
  const navigate = useNavigate();
  const {
    data: cases,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cases"],
    queryFn: fetchCases,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading cases...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        Failed to load: {error.message}
      </div>
    );
  }

  const sorted = cases
    ? [...cases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">All Cases</h1>
        <p className="text-sm text-gray-500 mt-1">
          {sorted.length} recovery case{sorted.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <FileText className="w-10 h-10 mb-3" />
            <p className="text-sm">No cases yet</p>
            <p className="text-xs mt-1">Send a test webhook to create one</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Risk Reason
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Attempts
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-400">
                    {c.id?.substring(0, 8)}…
                  </td>
                  <td className="px-5 py-3.5 text-gray-900">{fmt(c.type)}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                    {c.riskReason}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-gray-900">
                    ₹{Number(c.amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {c.attemptCount} / 4
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">
                    {c.createdAt
                      ? formatDistanceToNow(new Date(c.createdAt), {
                          addSuffix: true,
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmt(type) {
  if (!type) return "—";
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default CasesList;

