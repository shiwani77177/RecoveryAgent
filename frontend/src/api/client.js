import axios from "axios";

const api = axios.create({
  timeout: 10000,
});

//Dashboard 
export const fetchDashboardSummary = async () => {
  const { data } = await api.get("/api/dashboard/summary");
  return data;
};

//Cases
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

//Audit Log
export const fetchAllAuditLogs = async () => {
  const { data } = await api.get("/api/audit");
  return data;
};

//Actions
export const triggerOrchestrator = async () => {
  const { data } = await api.post("/api/orchestrator/run");
  return data;
};

export const processCase = async (id) => {
  const { data } = await api.post(`/api/cases/${id}/process`);
  return data;
};

export default api;

