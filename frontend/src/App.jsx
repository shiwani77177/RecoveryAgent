import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import CasesList from "./pages/CasesList";
import CaseDetail from "./pages/CaseDetail";
import Metrics from "./pages/Metrics";
import AuditLog from "./pages/AuditLog";
import Profile from "./pages/Profile";
import Penny from "./components/Penny";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Setup from "./pages/Setup";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { ThemeProvider } from "./components/ThemeContext";
import { EvalProvider } from "./components/EvalContext";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function SetupGuard({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.setupDone) return <Navigate to="/setup" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={user.setupDone ? "/" : "/setup"} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/register"
        element={
          user ? (
            <Navigate to={user.setupDone ? "/" : "/setup"} replace />
          ) : (
            <Register />
          )
        }
      />

      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <Setup />
          </ProtectedRoute>
        }
      />

      <Route
        path="/*"
        element={
          <SetupGuard>
            {/* EvalProvider must be inside SetupGuard so it's mounted
                once for the whole authenticated app. This is what
                keeps eval state alive across page navigation. */}
            <EvalProvider>
              <div className="flex h-screen bg-[var(--bg-primary)] transition-colors duration-300">
                <Sidebar />
                <main className="flex-1 overflow-auto p-6">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/cases" element={<CasesList />} />
                    <Route path="/cases/:id" element={<CaseDetail />} />
                    <Route path="/metrics" element={<Metrics />} />
                    <Route path="/audit" element={<AuditLog />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
                <Penny />
              </div>
            </EvalProvider>
          </SetupGuard>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
