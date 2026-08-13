import { create } from 'zustand';

const useAppStore = create((set, get) => ({
  apps: [
    { appId: 'principal-ed', displayName: "Principal'Ed", description: 'School administration dashboard' },
    { appId: 'competeed', displayName: "Compete'Ed", description: 'Competition and performance administration' },
    { appId: 'sanctifyed', displayName: "Sanctify'Ed", description: 'Safeguarding and compliance administration' },
    { appId: 'memecoined', displayName: 'MemecoinEd', description: 'Independent Solana trading application', supervised: true },
    { appId: 'builder', displayName: 'Builder', description: 'Module configuration' }
  ],
  selectedApp: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: false });
  },

  selectApp: (appId) => set({ selectedApp: appId }),
  deselectApp: () => set({ selectedApp: null }),
  getApp: (appId) => get().apps.find(a => a.appId === appId)
}));

export default useAppStore;
