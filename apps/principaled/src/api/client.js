import axios from "axios";

const client = axios.create({
  baseURL: "/",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const get = (url) => client.get(url);
export const listStudents = (params = {}) =>
  client.get("/students", { params });
export const createStudent = (data) => client.post("/students", data);
export const updateStudent = (id, data) => client.put(`/students/${id}`, data);
export const withdrawStudent = (id, data) =>
  client.put(`/students/${id}/withdraw`, data);
export const reinstateStudent = (id, data = {}) =>
  client.put(`/students/${id}/reinstate`, data);
export const deleteStudent = (id, reason) =>
  client.delete(`/students/${id}/permanent`, { data: { reason } });

const postCsv = async (url, input, signal) => {
  const file = input instanceof FormData ? input.get("csv_file") : input;
  if (!file || typeof file.text !== "function")
    throw new Error("Select a CSV file before uploading");
  const csv = await file.text();
  if (!csv.trim()) throw new Error("The selected CSV file is empty");
  if (signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
  return client.post(url, { csv }, { signal });
};

export const importStudents = (input, signal) =>
  postCsv("/api/students/import", input, signal);

export const listStaff = (params = {}) => client.get("/staff", { params });
export const createStaff = (data) => client.post("/staff", data);
export const updateStaff = (id, data) => client.put(`/staff/${id}`, data);
export const withdrawStaff = (id, data) =>
  client.put(`/staff/${id}/withdraw`, data);
export const reinstateStaff = (id, data = {}) =>
  client.put(`/staff/${id}/reinstate`, data);
export const deleteStaff = (id, reason) =>
  client.delete(`/staff/${id}/permanent`, { data: { reason } });
export const importStaff = (input, signal) =>
  postCsv("/api/staff/import", input, signal);

export const listRooms = (params = {}) => client.get("/rooms", { params });
export const createRoom = (data) => client.post("/rooms", data);
export const updateRoom = (id, data) => client.put(`/rooms/${id}`, data);
export const withdrawRoom = (id, data) =>
  client.put(`/rooms/${id}/withdraw`, data);
export const reinstateRoom = (id, data = {}) =>
  client.put(`/rooms/${id}/reinstate`, data);
export const deleteRoom = (id, reason) =>
  client.delete(`/rooms/${id}/permanent`, { data: { reason } });
export const importRooms = (input, signal) =>
  postCsv("/api/rooms/import", input, signal);

export const listInventory = (params = {}) =>
  client.get("/inventory", { params });
export const createItem = (data) => client.post("/inventory", data);
export const updateItem = (id, data) => client.put(`/inventory/${id}`, data);
export const withdrawItem = (id, data) =>
  client.put(`/inventory/${id}/withdraw`, data);
export const reinstateItem = (id, data = {}) =>
  client.put(`/inventory/${id}/reinstate`, data);
export const deleteItem = (id, reason) =>
  client.delete(`/inventory/${id}/permanent`, { data: { reason } });
export const importInventory = (input, signal) =>
  postCsv("/api/inventory/import", input, signal);

export const listInsightProducts = (
  scopeType = "organisation",
  scopeId = "current",
) =>
  client.get("/intelligence/products", {
    params: { scope_type: scopeType, scope_id: scopeId },
  });
export const runWithdrawalAnalysis = (data = {}) =>
  client.post("/intelligence/providers/core.withdrawal-patterns/run", data);
export const runIntelligenceProvider = (id, data = {}) =>
  client.post(`/intelligence/providers/${id}/run`, data);
export const decideOnInsight = (id, data) =>
  client.post(`/intelligence/products/${id}/decisions`, data);
export const createIntelligenceAction = (data) =>
  client.post("/intelligence/actions", data);
export const listIntelligenceActions = (params = {}) =>
  client.get("/intelligence/actions", { params });
export const updateIntelligenceAction = (id, data) =>
  client.put(`/intelligence/actions/${id}`, data);
export const generateIntelligenceReminders = () =>
  client.post("/intelligence/reminders/generate", {});
export const recordIntelligenceOutcome = (data) =>
  client.post("/intelligence/outcomes", data);
