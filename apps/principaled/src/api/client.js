import axios from 'axios';

const client = axios.create({
  baseURL: '/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const get = (url) => client.get(url);
export const listStudents = () => client.get('/students');
export const createStudent = (data) => client.post('/students', data);
export const updateStudent = (id, data) => client.put(`/students/${id}`, data);
export const withdrawStudent = (id) => client.put(`/students/${id}/withdraw`);
export const reinstateStudent = (id) => client.put(`/students/${id}/reinstate`);
export const deleteStudent = (id) => client.delete(`/students/${id}/permanent`);
export const importStudents = (formData) => client.post('/api/students/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const listStaff = () => client.get('/staff');
export const createStaff = (data) => client.post('/staff', data);
export const updateStaff = (id, data) => client.put(`/staff/${id}`, data);
export const withdrawStaff = (id) => client.put(`/staff/${id}/withdraw`);
export const reinstateStaff = (id) => client.put(`/staff/${id}/reinstate`);
export const deleteStaff = (id) => client.delete(`/staff/${id}/permanent`);
export const importStaff = (formData) => client.post('/api/staff/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const listRooms = () => client.get('/rooms');
export const createRoom = (data) => client.post('/rooms', data);
export const updateRoom = (id, data) => client.put(`/rooms/${id}`, data);
export const withdrawRoom = (id) => client.put(`/rooms/${id}/withdraw`);
export const reinstateRoom = (id) => client.put(`/rooms/${id}/reinstate`);
export const deleteRoom = (id) => client.delete(`/rooms/${id}/permanent`);
export const importRooms = (formData) => client.post('/api/rooms/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const listInventory = () => client.get('/inventory');
export const createItem = (data) => client.post('/inventory', data);
export const updateItem = (id, data) => client.put(`/inventory/${id}`, data);
export const withdrawItem = (id) => client.put(`/inventory/${id}/withdraw`);
export const reinstateItem = (id) => client.put(`/inventory/${id}/reinstate`);
export const deleteItem = (id) => client.delete(`/inventory/${id}/permanent`);
export const importInventory = (formData) => client.post('/api/inventory/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const listInsightProducts = (scopeType = 'organisation', scopeId = 'current') => client.get('/intelligence/products', { params: { scope_type: scopeType, scope_id: scopeId } });
export const runWithdrawalAnalysis = (data = {}) => client.post('/intelligence/providers/core.withdrawal-patterns/run', data);
export const runIntelligenceProvider = (id, data = {}) => client.post(`/intelligence/providers/${id}/run`, data);
export const decideOnInsight = (id, data) => client.post(`/intelligence/products/${id}/decisions`, data);
export const createIntelligenceAction = (data) => client.post('/intelligence/actions', data);
export const listIntelligenceActions = (params = {}) => client.get('/intelligence/actions', { params });
export const updateIntelligenceAction = (id, data) => client.put(`/intelligence/actions/${id}`, data);
export const generateIntelligenceReminders = () => client.post('/intelligence/reminders/generate', {});
export const recordIntelligenceOutcome = (data) => client.post('/intelligence/outcomes', data);
