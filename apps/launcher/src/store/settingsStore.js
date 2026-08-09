import { create } from 'zustand';
import apiClient from '../api/base';

const useSettingsStore = create((set, get) => ({
  tileLayout: [],
  theme: 'dark',
  intelligencePanelOpen: true,
  isLoading: true,
  error: null,

  loadSettings: async (userId, appId) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiClient.get('/users/settings');
      if (response.data.success && response.data.data) {
        const settings = response.data.data;
        
        set({
          tileLayout: settings.tile_layout || [],
          theme: settings.theme || 'dark',
          intelligencePanelOpen: settings.intelligence_panel_open !== false,
          isLoading: false,
        });
      } else {
        // Use defaults
        set({
          tileLayout: [],
          theme: 'dark',
          intelligencePanelOpen: true,
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.message,
      });
    }
  },

  saveSettings: async (userId, appId) => {
    const state = get();
    const settings = {
      tile_layout: state.tileLayout,
      theme: state.theme,
      intelligence_panel_open: state.intelligencePanelOpen,
    };
    
    try {
      await apiClient.put('/users/settings', {
        app_id: appId,
        settings_key: 'dashboard_preferences',
        value: settings,
      });
      set({ error: null });
    } catch (error) {
      set({ error: error.message });
    }
  },

  setTileLayout: (layout) => set({ tileLayout: layout }),
  setTheme: (theme) => set({ theme }),
  toggleIntelligencePanel: () => set((state) => ({ intelligencePanelOpen: !state.intelligencePanelOpen })),
}));

export default useSettingsStore;