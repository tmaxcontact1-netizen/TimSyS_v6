import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout, getCurrentUser } from '../api/auth';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  isLoading: false,
  error: null,

  // Initialize auth from stored token
  initialize: async () => {
    set({ isInitializing: true, isLoading: false, error: null });
    
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      set({ 
        user: null, 
        isAuthenticated: false, 
        isInitializing: false, 
        isLoading: false, 
        error: null 
      });
      return;
    }

    try {
      const result = await getCurrentUser();
      if (result.success && result.user) {
        set({ 
          user: result.user, 
          isAuthenticated: true, 
          isInitializing: false, 
          isLoading: false, 
          error: null 
        });
      } else {
        // Token invalid or expired
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_permissions');
        set({ 
          user: null, 
          isAuthenticated: false, 
          isInitializing: false, 
          isLoading: false, 
          error: 'Session expired' 
        });
      }
    } catch (error) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_permissions');
      set({ 
        user: null, 
        isAuthenticated: false, 
        isInitializing: false, 
        isLoading: false, 
        error: error.message || 'Authentication failed' 
      });
    }
  },

  // Login with credentials
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiLogin(credentials);
      set({ 
        user: result.user, 
        isAuthenticated: true, 
        isInitializing: false, 
        isLoading: false, 
        error: null 
      });
      return result;
    } catch (error) {
      set({ 
        isInitializing: false, 
        isLoading: false, 
        error: error.message || 'Login failed' 
      });
      throw error;
    }
  },

  // Logout
  logout: async () => {
    set({ isLoading: true });
    try {
      await apiLogout();
    } catch (error) {
      // Continue with local cleanup even if server fails
    }
    set({ 
      user: null, 
      isAuthenticated: false, 
      isInitializing: false, 
      isLoading: false, 
      error: null 
    });
  },

  // Permission check method
  hasPermission: (permission) => {
    const { user } = get();
    if (!user?.permissions) return false;
    if (user.permissions.includes('admin:*')) return true;
    if (user.permissions.includes(permission)) return true;
    
    // Check wildcard patterns like admin:builder:*
    const parts = permission.split(':');
    for (let i = parts.length - 1; i > 0; i--) {
      const wildcard = parts.slice(0, i).join(':') + ':*';
      if (user.permissions.includes(wildcard)) return true;
    }
    return false;
  },

  // Check multiple permissions (any)
  hasAnyPermission: (permissions) => {
    return permissions.some(p => get().hasPermission(p));
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Set user data directly (for token refresh flow)
  setUser: (user) => set({ 
    user, 
    isAuthenticated: true, 
    error: null 
  })
}));

export default useAuthStore;
