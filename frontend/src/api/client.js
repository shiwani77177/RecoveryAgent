import axios from "axios";

// ═══════════════════════════════════════════════════════════════
// AXIOS INSTANCES
// ═══════════════════════════════════════════════════════════════

// Standard API — 30s timeout for regular queries
const api = axios.create({
  timeout: 30000,
});

// Long-running instance — 5 min timeout for orchestrator/eval
// These endpoints process many cases via Gemini AI and can take a while
const longRunning = axios.create({
  timeout: 300000,
});

// ═══════════════════════════════════════════════════════════════
// REQUEST INTERCEPTOR — attach JWT to every request
// ═══════════════════════════════════════════════════════════════
const attachToken = (config) => {
  const token = localStorage.getItem("ra_token");
  if (token && token !== "undefined" && token !== "null") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};
api.interceptors.request.use(attachToken);
longRunning.interceptors.request.use(attachToken);

// ═══════════════════════════════════════════════════════════════
// RESPONSE INTERCEPTOR — smart auth handling
// ═══════════════════════════════════════════════════════════════
/**
 * Only redirect to login on GENUINE auth failures:
 *   - 401 anywhere (real invalid/expired token)
 *   - 403 ONLY on /api/auth/* endpoints (real auth check failure)
 *
 * Never redirect on:
 *   - 500 (backend crashed — not the user's fault)
 *   - 403 on business endpoints (guardrails/policy blocks)
 *   - Network errors (offline, CORS)
 */
const handleAuthError = (err) => {
  const status = err.response?.status;
  const url = err.config?.url || "";

  const isRealAuthFailure =
    status === 401 || (status === 403 && url.includes("/api/auth/"));

  if (isRealAuthFailure) {
    localStorage.removeItem("ra_user");
    localStorage.removeItem("ra_token");
    // Only redirect if not already on a public page
    if (!window.location.pathname.match(/^\/(login|register)$/)) {
      window.location.href = "/login";
    }
  }
  return Promise.reject(err);
};
api.interceptors.response.use((res) => res, handleAuthError);
longRunning.interceptors.response.use((res) => res, handleAuthError);

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
export const fetchDashboardSummary = async () => {
  const { data } = await api.get("/api/dashboard/summary");
  return data;
};

// ═══════════════════════════════════════════════════════════════
// CASES
// ═══════════════════════════════════════════════════════════════
export const fetchCases = async () => {
  const { data } = await api.get("/api/cases");
  return data;
};

export const fetchCaseById = async (id) => {
  const { data } = await api.get(`/api/cases/${id}`);
  return data;
};

export const fetchCaseAttempts = async (id) => {
  const { data } = await api.get(`/api/cases/${id}/attempts`);
  return data;
};

export const fetchCaseAudit = async (id) => {
  const { data } = await api.get(`/api/cases/${id}/audit`);
  return data;
};

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════
export const fetchAllAuditLogs = async () => {
  const { data } = await api.get("/api/audit");
  return data;
};

export const verifyAuditIntegrity = async () => {
  const { data } = await api.post("/api/audit/verify");
  return data;
};

// ═══════════════════════════════════════════════════════════════
// EVAL (test data + evaluation)
// ═══════════════════════════════════════════════════════════════
export const generateTestData = async () => {
  const { data } = await longRunning.post("/api/eval/generate");
  return data;
};

// ═══════════════════════════════════════════════════════════════
// ACTIONS — use long-running (60+ seconds possible)
// ═══════════════════════════════════════════════════════════════
export const triggerOrchestrator = async () => {
  const { data } = await longRunning.post("/api/orchestrator/run");
  return data;
};

export const processCase = async (id) => {
  const { data } = await longRunning.post(`/api/cases/${id}/process`);
  return data;
};

export default api;
