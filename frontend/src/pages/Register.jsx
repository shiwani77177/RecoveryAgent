import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  Loader2,
  AlertCircle,
  ArrowRight,
  Zap,
  Activity,
  CheckCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../components/AuthContext";

function Orb({ size, color, x, y, delay }) {
  return (
    <motion.div
      className="absolute rounded-full blur-[80px] opacity-30"
      style={{ width: size, height: size, background: color }}
      animate={{ x: [x, x + 30, x - 25, x], y: [y, y - 25, y + 30, y] }}
      transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

export default function Register() {
  const [fullName, setFullName] = useState("");
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
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/register", {
        email,
        password,
        fullName,
      });
      login(res.data);
      navigate("/setup");
    } catch (err) {
      setError(
        err.response?.data?.error || "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const inputWrap = (field) =>
    `relative rounded-xl transition-all duration-300 ${focused === field ? "ring-2 ring-cyan-500/40" : ""}`;
  const iconCls = (field) =>
    `absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] transition-colors ${focused === field ? "text-cyan-400" : "text-slate-600"}`;
  const inputCls =
    "w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none transition-all";

  return (
    <div className="h-dvh flex bg-[#05030a] overflow-hidden">
      {/* ═══ LEFT HERO ═══ */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden">
        <Orb size={280} color="#06b6d4" x={-30} y={80} delay={0} />
        <Orb size={220} color="#7c3aed" x={280} y={280} delay={2} />
        <Orb size={160} color="#d946ef" x={50} y={450} delay={3.5} />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
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
            Start recovering
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              in minutes
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-slate-400 text-base leading-relaxed max-w-md"
          >
            Set up once, recover continuously. Our AI agent detects failures,
            picks the right intervention, and executes across 4 payment rails.
          </motion.p>

          <div className="space-y-3">
            {[
              {
                icon: CheckCircle,
                text: "4-rail retry: card → email → UPI → WhatsApp",
              },
              {
                icon: Activity,
                text: "Gemini AI diagnoses each failure automatically",
              },
            ].map(({ icon: I, text }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                className="flex items-center gap-3 text-slate-300 text-sm"
              >
                <I className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                {text}
              </motion.div>
            ))}
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="relative z-10 text-slate-600 text-xs"
        >
          Tamper-proof audit trail · SHA-256 integrity · Bounded retries
        </motion.p>
      </div>

      {/* ═══ RIGHT FORM ═══ */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#080614] to-[#05030a]" />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm relative z-10"
        >
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-xl">
                RecoveryAgent
              </span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1.5">
            Create account
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            Start recovering lost revenue today
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Full name
              </label>
              <div className={inputWrap("name")}>
                <User className={iconCls("name")} />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onFocus={() => setFocused("name")}
                  onBlur={() => setFocused(null)}
                  placeholder="Rahul Sharma"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <div className={inputWrap("email")}>
                <Mail className={iconCls("email")} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className={inputWrap("pass")}>
                <Lock className={iconCls("pass")} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("pass")}
                  onBlur={() => setFocused(null)}
                  placeholder="Min. 8 characters"
                  className={inputCls}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="w-full bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold rounded-xl py-3.5 text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 hover:shadow-cyan-500/30 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  Create account <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-8">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
