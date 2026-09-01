import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, ScrollText, Zap } from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/cases", icon: FileText, label: "Cases" },
  { to: "/audit", icon: ScrollText, label: "Audit Log" },
];

function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-gray-300 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-400" />
          <span className="text-white font-semibold text-lg tracking-tight">
            Recovery<span className="text-blue-400">Agent</span>
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">AI Revenue Recovery</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-600">Razorpay Buildathon 2026</p>
        <p className="text-xs text-gray-600">Track 3 — Revenue Recovery</p>
      </div>
    </aside>
  );
}

export default Sidebar;

