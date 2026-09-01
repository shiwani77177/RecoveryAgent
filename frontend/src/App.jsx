import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import CasesList from "./pages/CasesList";
import CaseDetail from "./pages/CaseDetail";
import Penny from "./components/Penny";

function App() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cases" element={<CasesList />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Penny />
    </div>
  );
}

export default App;
