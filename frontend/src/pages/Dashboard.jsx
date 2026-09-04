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
  ArrowUpRight,
  Zap,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import toast from "react-hot-toast";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ═══ Animated counter hook ═══ */
function useAnimatedValue(target, duration = 1200) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (target == null) return;
    const num =
      typeof target === "string"
        ? parseFloat(target.replace(/[^0-9.]/g, "")) || 0
        : target;
    const start = performance.now();
    const from = 0;

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 4); // easeOutQuart
      setVal(from + (num - from) * ease);
      if (t < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);

  return val;
}

/* ═══ Card variants ═══ */
const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
  hover: {
    y: -4,
    scale: 1.02,
    transition: { duration: 0.25 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.4 + i * 0.06,
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

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
    } catch {
      toast.error("Orchestrator failed — check server logs");
    } finally {
      setIsRunning(false);
    }
  };

  const animatedRisk = useAnimatedValue(summary?.totalAtRisk || 0);
  const animatedRecovered = useAnimatedValue(summary?.totalRecovered || 0);
  const animatedRate = useAnimatedValue(summary?.recoveryRate || 0);
  const animatedEscalated = useAnimatedValue(summary?.escalated || 0, 800);

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center animate-pulse">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm text-[var(--text-muted)]">
            Loading dashboard...
          </span>
        </motion.div>
      </div>
    );
  }

  const recentCases = cases
    ? [...cases]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6)
    : [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            AI-powered revenue recovery overview
          </p>
        </div>
        <motion.button
          onClick={handleRunOrchestrator}
          disabled={isRunning}
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
            bg-gradient-to-r from-violet-600 to-cyan-500 text-white
            disabled:opacity-50 transition-all duration-300
            shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {isRunning ? "Running..." : "Run Orchestrator"}
        </motion.button>
      </motion.div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total at Risk",
            icon: IndianRupee,
            value: `₹${Math.round(animatedRisk).toLocaleString("en-IN")}`,
            sub: `${summary?.totalCases || 0} cases detected`,
            gradient: "from-red-500 to-orange-500",
            bg: "bg-red-500/[0.06]",
            ring: "ring-red-500/20",
          },
          {
            label: "Recovered",
            icon: TrendingUp,
            value: `₹${Math.round(animatedRecovered).toLocaleString("en-IN")}`,
            sub: `${summary?.recovered || 0} of ${summary?.totalCases || 0} cases`,
            gradient: "from-emerald-500 to-green-400",
            bg: "bg-emerald-500/[0.06]",
            ring: "ring-emerald-500/20",
          },
          {
            label: "Recovery Rate",
            icon: Activity,
            value: `${animatedRate.toFixed(1)}%`,
            sub: "agent performance",
            gradient: "from-violet-500 to-fuchsia-500",
            bg: "bg-violet-500/[0.06]",
            ring: "ring-violet-500/20",
            showBar: true,
            barPct: summary?.recoveryRate || 0,
          },
          {
            label: "Escalated",
            icon: AlertTriangle,
            value: Math.round(animatedEscalated),
            sub: "needs human review",
            gradient: "from-amber-500 to-yellow-500",
            bg: "bg-amber-500/[0.06]",
            ring: "ring-amber-500/20",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
            className={`relative overflow-hidden rounded-2xl border border-[var(--border)]
              p-5 ${card.bg} ring-1 ${card.ring} cursor-default
              bg-[var(--bg-secondary)] transition-shadow duration-300`}
          >
            {/* Gradient accent line */}
            <div
              className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${card.gradient}`}
            />

            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {card.label}
              </span>
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-sm`}
              >
                <card.icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {card.value}
            </p>
            {card.showBar && (
              <div className="w-full h-1.5 bg-white/5 dark:bg-white/5 rounded-full mt-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(card.barPct, 100)}%` }}
                  transition={{
                    duration: 1.2,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.5,
                  }}
                  className={`h-full bg-gradient-to-r ${card.gradient} rounded-full`}
                />
              </div>
            )}
            <p className="text-xs text-[var(--text-muted)] mt-2">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {[
          { key: "detected", gradient: "from-violet-500 to-violet-600" },
          { key: "waiting", gradient: "from-blue-500 to-blue-600" },
          { key: "recovered", gradient: "from-emerald-500 to-green-500" },
          { key: "escalated", gradient: "from-amber-500 to-yellow-500" },
          { key: "abandoned", gradient: "from-red-500 to-rose-600" },
        ].map(({ key, gradient }, i) => (
          <motion.div
            key={key}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3.5 text-center"
          >
            <p
              className={`text-2xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
            >
              {summary?.[key] || 0}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] capitalize mt-0.5 font-medium">
              {key}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Recent cases */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Recent Cases
          </h2>
          <button
            onClick={() => navigate("/cases")}
            className="text-xs text-violet-500 hover:text-violet-400 font-semibold
              flex items-center gap-1 transition-colors"
          >
            View all <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        {casesLoading ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            Loading...
          </div>
        ) : recentCases.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-8 h-8 text-violet-500/30 mx-auto mb-3" />
            <p className="text-[var(--text-muted)]">
              No cases yet. Send a test webhook to create one!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["Customer", "Type", "Amount", "Risk Reason", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {recentCases.map((c, i) => (
                    <motion.tr
                      key={c.id}
                      custom={i}
                      variants={rowVariants}
                      initial="hidden"
                      animate="visible"
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]
                        cursor-pointer transition-colors duration-150"
                    >
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] font-mono text-xs">
                        {c.customerId?.substring(0, 14)}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-primary)] font-medium">
                        {fmt(c.type)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[var(--text-primary)] font-semibold">
                        ₹{Number(c.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-muted)] font-mono text-xs">
                        {c.riskReason}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={c.status} />
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
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
