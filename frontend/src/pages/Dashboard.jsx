import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDashboardSummary,
  fetchCases,
  triggerOrchestrator,
} from "../api/client";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  AlertTriangle,
  IndianRupee,
  Activity,
  Play,
  Loader2,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import toast from "react-hot-toast";
import { useState } from "react";

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboardSummary"],
    queryFn: fetchDashboardSummary,
  });

  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: fetchCases,
  });

  const handleRunOrchestrator = async () => {
    setIsRunning(true);
    try {
      const result = await triggerOrchestrator();
      toast.success(`Done! ${result.casesRecoveredThisRun} cases recovered.`);
      queryClient.invalidateQueries(["dashboardSummary"]);
      queryClient.invalidateQueries(["cases"]);
    } catch (error) {
      toast.error("Orchestrator failed — check server logs");
    } finally {
      setIsRunning(false);
    }
  };

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  const recentCases = cases
    ? [...cases]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
    : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI Revenue Recovery overview
          </p>
        </div>
        <button
          onClick={handleRunOrchestrator}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {isRunning ? "Running..." : "Run Orchestrator"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card
          label="Total at Risk"
          value={`₹${Number(summary?.totalAtRisk || 0).toLocaleString("en-IN")}`}
          sub={`${summary?.totalCases || 0} cases detected`}
          icon={IndianRupee}
          color="text-gray-700"
        />
        <Card
          label="Recovered"
          value={`₹${Number(summary?.totalRecovered || 0).toLocaleString("en-IN")}`}
          sub={`${summary?.recovered || 0} of ${summary?.totalCases || 0} cases`}
          icon={TrendingUp}
          color="text-green-600"
        />
        <Card
          label="Recovery Rate"
          value={`${summary?.recoveryRate || 0}%`}
          sub="agent performance"
          icon={Activity}
          color="text-blue-600"
        />
        <Card
          label="Escalated"
          value={summary?.escalated || 0}
          sub="needs human review"
          icon={AlertTriangle}
          color="text-amber-600"
        />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {["detected", "waiting", "recovered", "escalated", "abandoned"].map(
          (s) => (
            <div
              key={s}
              className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center"
            >
              <p className="text-xl font-semibold text-gray-900">
                {summary?.[s] || 0}
              </p>
              <p className="text-xs text-gray-500 capitalize">{s}</p>
            </div>
          ),
        )}
      </div>

      {/* Recent cases */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Recent cases</h2>
        </div>
        {casesLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : recentCases.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No cases yet. Send a test webhook to create one!
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Risk Reason
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {recentCases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">
                    {c.customerId?.substring(0, 12)}
                  </td>
                  <td className="px-5 py-3 text-gray-900">{fmt(c.type)}</td>
                  <td className="px-5 py-3 font-mono text-gray-900">
                    ₹{Number(c.amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                    {c.riskReason}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={c.status} />
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

function Card({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
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

export default Dashboard;


