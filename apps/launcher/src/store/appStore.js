import { create } from 'zustand';
import { listApps, getApp } from '../api/apps';

const useAppStore = create((set, get) => ({
  apps: [],
  selectedApp: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const apps = await listApps({ active: true });
      set({
        apps,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error.message,
      });
    }
  },

  selectApp: (appId) => {
    set({ selectedApp: appId });
  },

  deselectApp: () => {
    set({ selectedApp: null });
  },

  refreshApps: async () => {
    try {
      const apps = await listApps({ active: true });
      set({ apps, error: null });
    } catch (error) {
      set({ error: error.message });
    }
  },
}));

export default useAppStore;