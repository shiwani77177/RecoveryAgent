import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Wallet,
  Building2,
  Hash,
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../components/AuthContext";

function Orb({ size, color, x, y, delay }) {
  return (
    <motion.div
      className="absolute rounded-full blur-[80px] opacity-25"
      style={{ width: size, height: size, background: color }}
      animate={{ x: [x, x + 30, x - 20, x], y: [y, y - 20, y + 25, y] }}
      transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

export default function Setup() {
  const [upiId, setUpiId] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!upiId && !bankAccount) {
      setError("Provide either a UPI ID or bank account.");
      return;
    }
    if (bankAccount && !ifscCode) {
      setError("IFSC code is required with bank account.");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("ra_token");
      await axios.post(
        "/api/auth/setup",
        { upiId, bankAccount, ifscCode },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      login({ ...user, setupDone: true });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Setup failed.");
    } finally {
      setLoading(false);
    }
  };

  const skipSetup = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("ra_token");
      await axios.post(
        "/api/auth/setup",
        { upiId: "", bankAccount: "", ifscCode: "" },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      login({ ...user, setupDone: true });
      navigate("/");
    } catch {
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const inputWrap = (f) =>
    `relative rounded-xl transition-all duration-300 ${focused === f ? "ring-2 ring-violet-500/40" : ""}`;
  const iconCls = (f) =>
    `absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] transition-colors ${focused === f ? "text-violet-400" : "text-slate-600"}`;
  const inputCls =
    "w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none transition-all";

  return (
    <div className="h-dvh flex bg-[#05030a] overflow-hidden">
      {/* Left hero */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden">
        <Orb size={260} color="#7c3aed" x={-20} y={100} delay={0} />
        <Orb size={200} color="#d946ef" x={200} y={350} delay={2} />
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
          className="relative z-10"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">RecoveryAgent</span>
          </div>
        </motion.div>

        <div className="relative z-10 space-y-5">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl font-extrabold text-white leading-[1.1]"
          >
            Almost there,
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              {user?.fullName || "friend"}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-slate-400 max-w-md"
          >
            Tell us where to deposit recovered funds. You can update this
            anytime from your profile.
          </motion.p>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative z-10 text-slate-600 text-xs"
        >
          Your payment details are stored securely and never shared.
        </motion.p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0818] to-[#05030a]" />
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm relative z-10"
        >
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-xl">
                RecoveryAgent
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-violet-500/15 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Payment details</h1>
              <p className="text-slate-500 text-xs">
                Where should recovered funds go?
              </p>
            </div>
          </div>

          {user?.fullName && (
            <div className="bg-violet-500/8 border border-violet-500/15 rounded-xl px-4 py-3 mb-6">
              <p className="text-violet-300 text-sm">
                Welcome, <span className="font-semibold">{user.fullName}</span>
              </p>
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 bg-red-500/8 border border-red-500/15 text-red-400 text-sm rounded-xl px-4 py-3 mb-5"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                UPI ID
              </label>
              <div className={inputWrap("upi")}>
                <Wallet className={iconCls("upi")} />
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  onFocus={() => setFocused("upi")}
                  onBlur={() => setFocused(null)}
                  placeholder="yourname@upi"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[10px] text-slate-600 uppercase tracking-wider">
                or bank
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Account number
              </label>
              <div className={inputWrap("bank")}>
                <Building2 className={iconCls("bank")} />
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  onFocus={() => setFocused("bank")}
                  onBlur={() => setFocused(null)}
                  placeholder="1234567890"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                IFSC code
              </label>
              <div className={inputWrap("ifsc")}>
                <Hash className={iconCls("ifsc")} />
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  onFocus={() => setFocused("ifsc")}
                  onBlur={() => setFocused(null)}
                  placeholder="SBIN0001234"
                  maxLength={11}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={skipSetup}
                disabled={loading}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] text-slate-400 font-medium rounded-xl py-3.5 text-sm hover:bg-white/[0.06] transition-all disabled:opacity-50"
              >
                Skip for now
              </button>
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="flex-1 bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Save
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
