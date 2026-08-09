import apiClient from './base';

// Login
export const login = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials);

  if (response.data.success) {
    const { token, refreshToken, user } = response.data;

    localStorage.setItem('jwt_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user_id', user.id);
    localStorage.setItem('user_permissions', JSON.stringify(user.permissions || []));

    return { 
      success: true, 
      user,
      token,
      refreshToken
    };
  }

  throw new Error(response.data.error?.message || 'Login failed');
};

// Logout
export const logout = async () => {
  const refreshToken = localStorage.getItem('refresh_token');

  if (refreshToken) {
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch (error) {
      // Continue with local cleanup even if server fails
    }
  }

  localStorage.clear();
};

// Get current user
export const getCurrentUser = async () => {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    return { success: false };
  }

  try {
    const response = await apiClient.get('/auth/me');

    if (response.data.success && response.data.user) {
      const { user } = response.data;
      localStorage.setItem('user_id', user.id);
      localStorage.setItem('user_permissions', JSON.stringify(user.permissions || []));
      return { success: true, user };
    }

    if (response.data.success && response.data.data?.user) {
      const { user } = response.data.data;
      localStorage.setItem('user_id', user.id);
      localStorage.setItem('user_permissions', JSON.stringify(user.permissions || []));
      return { success: true, user };
    }

    return { success: false };
  } catch (error) {
    if (error.status === 401 || error.type === 'AUTH') {
      localStorage.removeItem('jwt_token');
    }
    return { success: false, error: error.message };
  }
};

// Refresh token
export const refreshToken = async (refreshToken) => {
  const response = await apiClient.post('/auth/refresh', { refreshToken });

  if (response.data.success) {
    const { token } = response.data;
    localStorage.setItem('jwt_token', token);
    return { success: true, token };
  }

  throw new Error(response.data.error?.message || 'Token refresh failed');
};

// Check if authenticated (helper function)
export const isAuthenticated = () => {
  return !!localStorage.getItem('jwt_token');
};
