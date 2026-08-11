import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isInitializing: true, isLoading: false, error: null });
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      set({ user: null, isAuthenticated: false, isInitializing: false, isLoading: false, error: null });
      return;
    }
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          set({ user: data.user, isAuthenticated: true, isInitializing: false, isLoading: false, error: null });
          return;
        }
      }
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_permissions');
      set({ user: null, isAuthenticated: false, isInitializing: false, isLoading: false, error: null });
    } catch (error) {
      localStorage.removeItem('jwt_token');
      set({ user: null, isAuthenticated: false, isInitializing: false, isLoading: false, error: null });
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(credentials)
      });
      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('jwt_token', data.token);
        localStorage.setItem('user_id', data.user.id);
        localStorage.setItem('user_permissions', JSON.stringify(data.user.permissions));
        set({ user: data.user, isAuthenticated: true, isInitializing: false, isLoading: false, error: null });
        return { success: true, user: data.user };
      }
      throw new Error(data.error?.message || 'Login failed');
    } catch (error) {
      set({ isInitializing: false, isLoading: false, error: error.message || 'Login failed' });
      throw error;
    }
  },

  logout: async () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_permissions');
    set({ user: null, isAuthenticated: false, isInitializing: false, isLoading: false, error: null });
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user?.permissions) return false;
    if (user.permissions.includes('admin:*')) return true;
    if (user.permissions.includes(permission)) return true;
    const parts = permission.split(':');
    for (let i = parts.length - 1; i > 0; i--) {
      const wildcard = parts.slice(0, i).join(':') + ':*';
      if (user.permissions.includes(wildcard)) return true;
    }
    return false;
  },

  hasAnyPermission: (permissions) => {
    return permissions.some(p => get().hasPermission(p));
  },

  clearError: () => set({ error: null }),
  setUser: (user) => set({ user, isAuthenticated: true, error: null })
}));

export default useAuthStore;
