import { create } from 'zustand';
import apiClient from '../api/base';

const useAppStore = create((set, get) => ({
  apps: [],
  selectedApp: null,

  // Initialize from API (original - disabled below)
  initialize: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get('/apps');
      if (response.data.success && response.data.data) {
        set({ apps: response.data.data, isLoading: false });
      } else {
        throw new Error(response.data.error?.message || 'Failed to load apps');
      }
    } catch (error) {
      console.warn('API app loading failed:', error.message);
      // Fallback to hardcoded apps
      set({ apps: get().hardcodedApps(), isLoading: false });
    }
  },

  hardcodedApps: () => [
    { appId: 'principal-ed', displayName: 'Principal\'Ed', description: 'School administration dashboard', icon: '🏫' },
    { appId: 'compete-ed', displayName: 'Compete\'Ed', description: 'Assessment and benchmarking', icon: '📊' },
    { appId: 'sanctify-ed', displayName: 'Sanctify\'Ed', description: 'Compliance and reporting', icon: '✓' },
    { appId: 'builder', displayName: 'Builder', description: 'Module configuration', icon: '⚙️' }
  ],

  selectApp: (appId) => set({ selectedApp: appId }),
  deselectApp: () => set({ selectedApp: null })
}));

export default useAppStore;
