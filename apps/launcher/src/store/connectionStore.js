import { create } from 'zustand';
import { checkPlatformHealth } from '../api/base';

const MAX_FAILURES = 5;
const BASE_DELAY = 1000;
const MAX_DELAY = 30000;
const POLL_INTERVAL = 30000;

const useConnectionStore = create((set, get) => ({
  status: 'checking',
  error: null,
  consecutiveFailures: 0,
  pollingInterval: null,

  check: async () => {
    set({ status: 'checking' });
    try {
      const result = await checkPlatformHealth();
      if (result.healthy) {
        set({ 
          status: 'online', 
          error: null, 
          consecutiveFailures: 0 
        });
        return true;
      } else {
        throw new Error(result.error || 'Health check failed');
      }
    } catch (error) {
      set((state) => {
        const failures = state.consecutiveFailures + 1;
        const shouldStop = failures >= MAX_FAILURES;
        return {
          status: shouldStop ? 'offline' : 'degraded',
          error: error.message,
          consecutiveFailures: failures
        };
      });
      return false;
    }
  },

  startPolling: (interval = POLL_INTERVAL) => {
    const state = get();
    
    // Clear existing interval
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
    }

    let currentInterval = interval;
    let timer = null;

    const tick = async () => {
      // Skip if document is hidden (tab not visible)
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      const result = await get().check();
      
      if (!result) {
        // Exponential backoff on failure
        currentInterval = Math.min(
          currentInterval * 2,
          MAX_DELAY
        );
      } else {
        // Reset to normal interval on success
        currentInterval = interval;
      }

      // Schedule next tick
      clearTimeout(timer);
      timer = setTimeout(tick, currentInterval);
    };

    timer = setTimeout(tick, currentInterval);
    set({ pollingInterval: timer });
  },

  stopPolling: () => {
    const state = get();
    if (state.pollingInterval) {
      clearTimeout(state.pollingInterval);
      set({ pollingInterval: null });
    }
  },

  reset: () => {
    get().stopPolling();
    set({ 
      status: 'checking', 
      error: null, 
      consecutiveFailures: 0 
    });
  }
}));

export default useConnectionStore;
