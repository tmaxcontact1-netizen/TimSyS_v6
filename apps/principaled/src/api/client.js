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
export const deleteStudent = (id) => client.delete(`/students/${id}`);
export const importStudents = (formData) => client.post('/api/students/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const listStaff = () => client.get('/staff');
export const createStaff = (data) => client.post('/staff', data);
export const updateStaff = (id, data) => client.put(`/staff/${id}`, data);
export const deleteStaff = (id) => client.delete(`/staff/${id}`);
export const importStaff = (formData) => client.post('/api/staff/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const listRooms = () => client.get('/rooms');
export const createRoom = (data) => client.post('/rooms', data);
export const updateRoom = (id, data) => client.put(`/rooms/${id}`, data);
export const deleteRoom = (id) => client.delete(`/rooms/${id}`);
export const importRooms = (formData) => client.post('/api/rooms/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const listInventory = () => client.get('/inventory');
export const createItem = (data) => client.post('/inventory', data);
export const updateItem = (id, data) => client.put(`/inventory/${id}`, data);
export const deleteItem = (id) => client.delete(`/inventory/${id}`);
export const importInventory = (formData) => client.post('/api/inventory/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const listApps = () => client.get('/api/apps');
export const createApp = (data) => client.post('/api/apps', data);
export const updateApp = (id, data) => client.patch(`/api/apps/${id}`, data);
export const deleteApp = (id) => client.delete(`/api/apps/${id}`);
