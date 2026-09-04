import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ScrollText,
  BarChart3,
  Zap,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { useEval } from "./EvalContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/cases", icon: FileText, label: "Cases" },
  { to: "/metrics", icon: BarChart3, label: "Metrics" },
  { to: "/audit", icon: ScrollText, label: "Audit Log" },
];

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { running, progress } = useEval(); // ← subscribe to eval state
  const navigate = useNavigate();

  const initials = (user?.fullName || user?.email || "U")
    .charAt(0)
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Compute eval progress percentage for badge
  const evalPct =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <aside
      className={`
        ${collapsed ? "w-[72px]" : "w-60"}
        sidebar-transition flex flex-col flex-shrink-0 relative
        bg-[var(--bg-sidebar)] border-r border-[var(--border)]
      `}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-7 z-10 w-6 h-6 rounded-full
          bg-[var(--accent)] text-white flex items-center justify-center
          shadow-lg hover:scale-110 transition-transform"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <span className="text-white font-bold text-base tracking-tight">
                Recovery<span className="text-violet-400">Agent</span>
              </span>
              <p className="text-[10px] text-gray-500 leading-none mt-0.5">
                AI Revenue Recovery
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isMetrics = to === "/metrics";
          const showEvalBadge = isMetrics && running;

          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200 group relative
                ${collapsed ? "justify-center" : ""}
                ${
                  isActive
                    ? "bg-violet-500/15 text-violet-400 shadow-sm shadow-violet-500/10"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`
              }
            >
              <div className="relative">
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                {/* Pulsing dot when eval is running (visible even when collapsed) */}
                {showEvalBadge && (
                  <motion.span
                    className="absolute -top-1 -right-1 w-2 h-2 bg-violet-400 rounded-full"
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </div>

              {!collapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="nav-label">{label}</span>
                  {/* Progress percentage badge (only when expanded) */}
                  {showEvalBadge && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-[10px] font-bold text-violet-300 bg-violet-500/15 px-1.5 py-0.5 rounded-md"
                    >
                      {evalPct}%
                    </motion.span>
                  )}
                </div>
              )}

              {/* Tooltip on collapsed hover */}
              {collapsed && (
                <span
                  className="absolute left-full ml-3 px-2.5 py-1 rounded-md text-xs
                  font-medium bg-gray-800 text-white opacity-0 group-hover:opacity-100
                  transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg"
                >
                  {label}
                  {showEvalBadge ? ` · ${evalPct}%` : ""}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-2.5 pb-2">
        <button
          onClick={toggle}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm
            font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200
            transition-all duration-200 ${collapsed ? "justify-center" : ""}`}
        >
          {dark ? (
            <Sun className="w-[18px] h-[18px] flex-shrink-0 text-amber-400" />
          ) : (
            <Moon className="w-[18px] h-[18px] flex-shrink-0 text-blue-400" />
          )}
          {!collapsed && (
            <span className="nav-label">
              {dark ? "Light mode" : "Dark mode"}
            </span>
          )}
        </button>
      </div>

      {/* User section */}
      <div className="px-2.5 py-3 border-t border-white/5">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
            transition-all duration-200
            ${collapsed ? "justify-center" : ""}
            ${
              isActive
                ? "bg-violet-500/15 text-violet-400"
                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
            }`
          }
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-200">
                {user?.fullName || "Profile"}
              </p>
              <p className="text-[10px] text-gray-500 truncate">
                {user?.email || ""}
              </p>
            </div>
          )}
        </NavLink>

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 mt-1 w-full px-3 py-2 rounded-xl text-sm
            text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200
            ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="nav-label">Sign out</span>}
        </button>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/5 animate-fade-in">
          <p className="text-[10px] text-gray-600">Razorpay Buildathon 2026</p>
          <p className="text-[10px] text-gray-600">
            Track 3 — Revenue Recovery
          </p>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
