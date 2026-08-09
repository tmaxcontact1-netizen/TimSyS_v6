import axios from 'axios';
import { logout, refreshToken as apiRefreshToken } from './auth';

// Create axios instance without interceptors initially
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// State for request queuing during token refresh
let isRefreshing = false;
let failedQueue = [];

// Process queued requests after token refresh
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Error handler helper
export const normalizeError = (error) => {
  // Axios network errors
  if (!error.response && error.code === 'ERR_NETWORK') {
    return {
      type: 'NETWORK',
      message: 'Network connection lost',
      status: null,
      original: error
    };
  }

  // Timeout
  if (error.code === 'ECONNABORTED') {
    return {
      type: 'TIMEOUT',
      message: 'Request timed out',
      status: null,
      original: error
    };
  }

  // API errors with response
  if (error.response) {
    const { status, data } = error.response;
    return {
      type: 'API',
      message: data?.error?.message || data?.message || 'API error occurred',
      status,
      code: data?.error?.code,
      original: error
    };
  }

  // Unexpected errors
  return {
    type: 'UNKNOWN',
    message: error.message || 'An unexpected error occurred',
    status: null,
    original: error
  };
};

// Request interceptor - add auth header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(normalizeError(error));
  }
);

// Response interceptor - handle 401 with refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Normalize the error first
    const normalized = normalizeError(error);

    // Handle 401 unauthorized
    if (normalized.status === 401 && !originalRequest._retry) {
      // Skip refresh for the auth endpoint itself
      if (originalRequest.url === '/auth/login' || originalRequest.url === '/auth/refresh') {
        return Promise.reject(normalized);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh token
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await apiRefreshToken(refreshToken);
        const newToken = response.token;
        
        // Store new token
        localStorage.setItem('jwt_token', newToken);

        // Update authorization header for this request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        // Process all queued requests
        processQueue(null, newToken);

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        isRefreshing = false;
        processQueue(refreshError, null);
        
        // Clear storage and redirect handled by app level
        const finalError = normalizeError(refreshError);
        finalError.type = 'AUTH';
        finalError.message = 'Session expired. Please log in again.';
        
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_permissions');
        
        // Notify auth store via custom event
        window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'expired' } }));
        
        return Promise.reject(finalError);
      } finally {
        isRefreshing = false;
      }
    }

    // All other errors pass through normalized
    return Promise.reject(normalized);
  }
);

export default apiClient;

export const checkPlatformHealth = async () => {
  try {
    const response = await axios.get('/health');
    return { healthy: true, status: response.status };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
};
