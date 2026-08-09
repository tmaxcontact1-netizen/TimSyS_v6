import apiClient from './base';

export const listApps = async (filter = {}) => {
  const queryParams = new URLSearchParams();
  if (filter.active !== undefined) {
    queryParams.append('active', filter.active);
  }
  
  const url = queryParams.toString() ? `/apps?${queryParams}` : '/apps';
  const response = await apiClient.get(url);
  
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  
  throw new Error(response.data.error?.message || 'Failed to list apps');
};

export const getApp = async (appId) => {
  const response = await apiClient.get(`/apps/${appId}`);
  
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  
  throw new Error(response.data.error?.message || 'Failed to get app');
};

export const createApp = async (data) => {
  const response = await apiClient.post('/apps', data);
  
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  
  throw new Error(response.data.error?.message || 'Failed to create app');
};

export const updateApp = async (appId, data) => {
  const response = await apiClient.patch(`/apps/${appId}`, data);
  
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  
  throw new Error(response.data.error?.message || 'Failed to update app');
};

export const deleteUserApp = async (appId) => {
  const response = await apiClient.delete(`/apps/${appId}`);
  
  if (response.data.success) {
    return true;
  }
  
  throw new Error(response.data.error?.message || 'Failed to delete app');
};