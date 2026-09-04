import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  ArrowRight,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../components/AuthContext";

/* ═══ Floating orb component ═══ */
function Orb({ size, color, x, y, delay }) {
  return (
    <motion.div
      className="absolute rounded-full blur-[80px] opacity-30"
      style={{ width: size, height: size, background: color }}
      animate={{
        x: [x, x + 40, x - 20, x],
        y: [y, y - 30, y + 20, y],
      }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

/* ═══ Stat chip ═══ */
function StatChip({ icon: Icon, label, value, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3 bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] rounded-2xl px-5 py-3.5"
    >
      <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center">
        <Icon className="w-5 h-5 text-violet-300" />
      </div>
      <div>
        <p className="text-white font-bold text-lg leading-tight">{value}</p>
        <p className="text-slate-400 text-xs">{label}</p>
      </div>
    </motion.div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      login(res.data);
      navigate(res.data.setupDone ? "/" : "/setup");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-dvh flex bg-[#05030a] overflow-hidden">
      {/* ═══ LEFT HERO PANEL ═══ */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Orbs */}
        <Orb size={300} color="#7c3aed" x={-40} y={60} delay={0} />
        <Orb size={200} color="#06b6d4" x={250} y={300} delay={2} />
        <Orb size={180} color="#d946ef" x={100} y={500} delay={4} />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              RecoveryAgent
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            Razorpay Buildathon 2026 · Track 3
          </p>
        </motion.div>

        <div className="relative z-10 space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight"
          >
            Recover revenue
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              your business lost
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-slate-400 text-base leading-relaxed max-w-md"
          >
            AI-powered detection, diagnosis, and multi-rail intervention for
            failed payments, abandoned checkouts, and overdue invoices.
          </motion.p>

          <div className="flex gap-3">
            <StatChip
              icon={TrendingUp}
              label="Recovery improvement"
              value="+98.3%"
              delay={0.5}
            />
            <StatChip
              icon={Shield}
              label="Audit entries verified"
              value="SHA-256"
              delay={0.6}
            />
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="relative z-10 text-slate-600 text-xs"
        >
          Multi-rail retry · HMAC webhooks · Gemini AI diagnosis
        </motion.p>
      </div>

      {/* ═══ RIGHT FORM PANEL ═══ */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0818] to-[#05030a]" />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm relative z-10"
        >
          {/* Mobile-only logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-xl">
                RecoveryAgent
              </span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1.5">Sign in</h1>
          <p className="text-slate-500 text-sm mb-8">
            Access your recovery dashboard
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 bg-red-500/8 border border-red-500/15 text-red-400 text-sm rounded-xl px-4 py-3 mb-6"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <div
                className={`relative rounded-xl transition-all duration-300 ${
                  focused === "email" ? "ring-2 ring-violet-500/40" : ""
                }`}
              >
                <Mail
                  className={`absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] transition-colors ${
                    focused === "email" ? "text-violet-400" : "text-slate-600"
                  }`}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  placeholder="you@example.com"
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div
                className={`relative rounded-xl transition-all duration-300 ${
                  focused === "pass" ? "ring-2 ring-violet-500/40" : ""
                }`}
              >
                <Lock
                  className={`absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] transition-colors ${
                    focused === "pass" ? "text-violet-400" : "text-slate-600"
                  }`}
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("pass")}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none transition-all"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="w-full bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold rounded-xl py-3.5 text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-8">
            No account?{" "}
            <Link
              to="/register"
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Create one
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
