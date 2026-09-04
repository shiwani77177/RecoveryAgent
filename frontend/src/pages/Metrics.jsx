import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Play,
  Database,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useEval } from "../components/EvalContext";
import { generateTestData } from "../api/client";

function Metrics() {
  // Everything eval-related now comes from the shared context
  const { running, progress, logs, report, startEval } = useEval();

  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateTestData();
      toast.success(`Generated ${data.totalCases} test cases`);
    } catch (err) {
      toast.error(
        "Failed to generate: " + (err.response?.data?.message || err.message),
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleRun = () => {
    startEval(); // triggers the shared context stream
  };

  const chartData = report
    ? [
        { name: "AI Agent", rate: report.agentRecoveryRate, fill: "#7c3aed" },
        {
          name: "Baseline",
          rate: report.baselineRecoveryRate,
          fill: "#334155",
        },
      ]
    : [];

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Evaluation Metrics
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Agent performance vs naive baseline across synthetic test cases
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating || running}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--bg-hover)] disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            {generating ? "Generating..." : "Generate Test Data"}
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-violet-500 text-white rounded-xl disabled:opacity-50 text-sm font-semibold transition-all shadow-lg shadow-violet-600/20"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {running ? "Running..." : "Run Evaluation"}
          </button>
        </div>
      </div>

      {/* Progress Panel */}
      <AnimatePresence>
        {running && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-violet-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Processing cases through AI agent
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {progress
                      ? `${progress.processed} of ${progress.total} cases · Pass ${progress.pass}`
                      : "Initializing..."}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold text-violet-400">{pct}%</span>
            </div>

            <div className="w-full h-2.5 bg-[var(--border)] rounded-full overflow-hidden mb-4">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>

            <div className="space-y-1 max-h-32 overflow-hidden">
              <AnimatePresence mode="popLayout">
                {logs.map((log, i) => (
                  <motion.div
                    key={`${i}-${log}`}
                    initial={{ opacity: 0, x: -10, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    {log}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {report && !running && (
        <>
          {/* AI quota exhausted warning */}
          {report.aiQuotaExhausted && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  AI quota exhausted — results reflect rule-based fallback
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                  The free Gemini tier (20 requests/day) was used up during this
                  run, so cases were diagnosed using the rule-based fallback
                  engine instead of live AI. Recovery numbers may differ from a
                  full AI run. The quota resets at midnight Pacific Time —
                  re-run the evaluation then to see the agent's full AI-driven
                  performance.
                </p>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: "Agent Recovery",
                value: report.agentRecoveryRate + "%",
                sub: `${report.agentRecovered} of ${report.totalRecoverable} recoverable`,
                color: "violet",
                icon: TrendingUp,
              },
              {
                label: "Baseline",
                value: report.baselineRecoveryRate + "%",
                sub: `${report.baselineRecovered} of ${report.totalRecoverable} recoverable`,
                color: "slate",
                icon: TrendingUp,
              },
              {
                label: "Improvement",
                value:
                  (report.improvementPercent > 0 ? "+" : "") +
                  report.improvementPercent +
                  "%",
                sub: "vs naive retry-all baseline",
                color: "emerald",
                icon: CheckCircle,
              },
              {
                label: "False Escalations",
                value: report.agentFalseEscalate,
                sub: "recoverable cases missed",
                color: "red",
                icon: AlertTriangle,
              },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5"
              >
                <div
                  className={`flex items-center gap-2 text-${card.color}-500 mb-1`}
                >
                  <card.icon className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {card.label}
                  </span>
                </div>
                <p
                  className={`text-3xl font-bold text-${card.color === "slate" ? "[var(--text-muted)]" : card.color + "-500"}`}
                >
                  {card.value}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {card.sub}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              Recovery Rate Comparison
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Baseline retries everything once blindly (
              {report.baselineRecoveryRate}%). Agent uses AI diagnosis +
              multi-rail interventions.
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} barSize={100}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 14, fill: "var(--text-secondary)" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                  unit="%"
                />
                <Tooltip
                  formatter={(val) => [`${val}%`, "Recovery Rate"]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                  }}
                />
                <Bar dataKey="rate" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {[
              {
                label: "Recovered ✅",
                value: report.agentRecovered,
                color: "emerald",
              },
              {
                label: "Correct Escalations",
                value: report.agentCorrectEscalate,
                color: "blue",
              },
              {
                label: "Missed Revenue ❌",
                value: report.agentFalseEscalate,
                color: "red",
              },
              {
                label: "Wasted Effort ⚠️",
                value: report.agentFalseRecover,
                color: "amber",
              },
              {
                label: "Still Waiting ⏳",
                value: report.agentWaiting,
                color: "slate",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className={`rounded-xl p-3 text-center border border-${color}-500/20 bg-${color}-500/[0.06]`}
              >
                <p className={`text-xl font-bold text-${color}-500`}>{value}</p>
                <p className={`text-xs text-${color}-500/70`}>{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex justify-around">
            {[
              {
                label: "Total at Risk",
                value: `₹${Number(report.totalAtRisk).toLocaleString("en-IN")}`,
                color: "text-[var(--text-primary)]",
              },
              {
                label: "Agent Recovered",
                value: `₹${Number(report.agentRecoveredAmount).toLocaleString("en-IN")}`,
                color: "text-emerald-500",
              },
              {
                label: "Baseline Would Recover",
                value: `₹${Number(report.baselineRecoveredAmount).toLocaleString("en-IN")}`,
                color: "text-[var(--text-muted)]",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  {label}
                </p>
                <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Per-Case Breakdown
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {report.totalCases} cases · {report.totalRecoverable}{" "}
                recoverable · {report.totalUnrecoverable} unrecoverable
              </p>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-primary)]">
                  <tr className="text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    <th className="px-6 py-3">Case</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Error Code</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Recoverable?</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Grade</th>
                    <th className="px-6 py-3">Attempts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {report.caseDetails?.map((c, i) => (
                    <tr
                      key={i}
                      className="hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <td className="px-6 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {c.caseId}
                      </td>
                      <td className="px-6 py-3 text-[var(--text-primary)]">
                        {c.type}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {c.errorCode}
                      </td>
                      <td className="px-6 py-3 text-[var(--text-primary)] font-medium">
                        ₹{Number(c.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-3">
                        {c.trulyRecoverable ? (
                          <span className="text-emerald-500 text-xs font-medium">
                            Yes
                          </span>
                        ) : (
                          <span className="text-red-400 text-xs font-medium">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <StatusPill status={c.finalStatus} />
                      </td>
                      <td className="px-6 py-3">
                        <GradePill grade={c.grade} />
                      </td>
                      <td className="px-6 py-3 text-center text-[var(--text-muted)]">
                        {c.attempts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!report && !running && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-16 text-center">
          <TrendingUp className="w-14 h-14 text-[var(--text-muted)] opacity-30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[var(--text-primary)]">
            No evaluation data yet
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2 max-w-md mx-auto">
            Click <strong>Generate Test Data</strong> to create 100 synthetic
            cases, then <strong>Run Evaluation</strong> to process them through
            the AI agent.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const colors = {
    RECOVERED: "bg-emerald-500/15 text-emerald-400",
    ESCALATED: "bg-amber-500/15 text-amber-400",
    WAITING: "bg-blue-500/15 text-blue-400",
    ABANDONED: "bg-red-500/15 text-red-400",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-slate-500/15 text-slate-400"}`}
    >
      {status}
    </span>
  );
}

function GradePill({ grade }) {
  const map = {
    TRUE_POSITIVE: {
      style: "bg-emerald-500/15 text-emerald-400",
      label: "✅ Correct",
    },
    TRUE_NEGATIVE: {
      style: "bg-blue-500/15 text-blue-400",
      label: "✅ Correct Esc",
    },
    FALSE_NEGATIVE: { style: "bg-red-500/15 text-red-400", label: "❌ Missed" },
    FALSE_POSITIVE: {
      style: "bg-amber-500/15 text-amber-400",
      label: "⚠️ Wasted",
    },
    WAITING: { style: "bg-slate-500/15 text-slate-400", label: "⏳ Waiting" },
  };
  const m = map[grade] || {
    style: "bg-slate-500/15 text-slate-400",
    label: grade,
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${m.style}`}
    >
      {m.label}
    </span>
  );
}

export default Metrics;
