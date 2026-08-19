import { localDB } from './database';

type NetworkChangeListener = (isOnline: boolean) => void;
type DataChangeListener = () => void;

class SyncManager {
  private isForceOffline: boolean = false;
  private listeners: Set<NetworkChangeListener> = new Set();
  private dataListeners: Set<DataChangeListener> = new Set();
  private syncIntervalId: any = null;

  constructor() {
    this.isForceOffline = localStorage.getItem('lf_force_offline') === 'true';
    
    // Listen to browser network changes
    window.addEventListener('online', () => this.triggerNetworkChange());
    window.addEventListener('offline', () => this.triggerNetworkChange());
  }

  // Network state accessors
  isOnline(): boolean {
    if (this.isForceOffline) {
      return false;
    }
    return navigator.onLine;
  }

  setForceOffline(force: boolean) {
    this.isForceOffline = force;
    localStorage.setItem('lf_force_offline', force ? 'true' : 'false');
    this.triggerNetworkChange();
    if (!force) {
      this.syncWithServer(); // Sync immediately when returning online
    }
  }

  getForceOffline(): boolean {
    return this.isForceOffline;
  }

  // Listeners for UI updates when online status changes
  addNetworkListener(listener: NetworkChangeListener) {
    this.listeners.add(listener);
    // Initial call
    listener(this.isOnline());
  }

  removeNetworkListener(listener: NetworkChangeListener) {
    this.listeners.delete(listener);
  }

  private triggerNetworkChange() {
    const online = this.isOnline();
    this.listeners.forEach(l => l(online));
  }

  // Listeners for data updates
  addDataListener(listener: DataChangeListener) {
    this.dataListeners.add(listener);
  }

  removeDataListener(listener: DataChangeListener) {
    this.dataListeners.delete(listener);
  }

  triggerDataChange() {
    this.dataListeners.forEach(l => l());
  }

  // Sync process
  async syncWithServer(): Promise<{ success: boolean; error?: string }> {
    if (!this.isOnline()) {
      return { success: false, error: 'Offline mode' };
    }

    const clientActions = localDB.getOfflineQueue();
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientActions,
          clientLastSyncTime: localDB.getLastSync()
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // 1. Sync server-side menu, orders, restaurant name and password back to local DB
        localDB.setMenu(data.menu);
        localDB.setOrders(data.orders);
        localDB.setRestaurantName(data.restaurantName);
        if (data.systemPassword) {
          localDB.setPassword(data.systemPassword);
        }

        // 2. Clear our offline queue as all actions are applied
        localDB.clearOfflineQueue();
        
        // 3. Mark last sync time
        localDB.setLastSync(data.serverTime);

        console.log('[Sync] Synchronized successfully with main system.');
        this.triggerNetworkChange(); // Refresh listeners
        this.triggerDataChange(); // Notify listeners of new orders/menu
        return { success: true };
      } else {
        return { success: false, error: 'Server sync failed' };
      }
    } catch (err: any) {
      console.error('[Sync] Error synchronizing with server:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // Start periodic sync background timer
  startAutoSync(intervalMs: number = 10000) {
    if (this.syncIntervalId) return;
    
    // Initial sync
    this.syncWithServer();

    this.syncIntervalId = setInterval(() => {
      this.syncWithServer();
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }
}

export const syncManager = new SyncManager();
