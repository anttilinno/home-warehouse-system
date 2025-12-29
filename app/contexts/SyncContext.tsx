import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import {
  itemsApi,
  inventoryApi,
  locationsApi,
  containersApi,
  categoriesApi,
} from '../lib/api';
import { cache } from '../lib/storage/cache';
import { offlineQueue, QueuedAction } from '../lib/storage/offline-queue';
import { useAuth } from './AuthContext';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: Date | null;
  sync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Refresh pending action count
  const refreshPendingCount = useCallback(async () => {
    const count = await offlineQueue.count();
    setPendingCount(count);
  }, []);

  // Process queued actions
  const processQueue = useCallback(async () => {
    const queue = await offlineQueue.getAll();

    for (const action of queue) {
      try {
        await processAction(action);
        await offlineQueue.remove(action.id);
      } catch (error) {
        console.error(`Failed to process action ${action.id}:`, error);
        await offlineQueue.incrementRetry(action.id);

        // Remove if too many retries
        if (action.retryCount >= 3) {
          console.error(`Removing action ${action.id} after 3 retries`);
          await offlineQueue.remove(action.id);
        }
      }
    }

    await refreshPendingCount();
  }, [refreshPendingCount]);

  // Process a single action
  const processAction = async (action: QueuedAction) => {
    switch (action.type) {
      case 'create_item': {
        const result = await itemsApi.create(action.payload);
        // Replace temp ID in any dependent actions
        if (action.tempId) {
          await offlineQueue.replaceTempId(action.tempId, result.id);
        }
        break;
      }
      case 'create_inventory':
        await inventoryApi.create(action.payload);
        break;
      case 'adjust_stock':
        await inventoryApi.adjustStock(action.payload.inventory_id, {
          adjustment: action.payload.adjustment,
        });
        break;
      case 'update_inventory':
        await inventoryApi.update(action.payload.id, action.payload.data);
        break;
    }
  };

  // Pull fresh data from server
  const pullData = useCallback(async () => {
    const [items, locations, containers, inventory, categories] = await Promise.all([
      itemsApi.list(),
      locationsApi.list(),
      containersApi.list(),
      inventoryApi.list(),
      categoriesApi.list(),
    ]);

    await Promise.all([
      cache.setItems(items),
      cache.setLocations(locations),
      cache.setContainers(containers),
      cache.setInventory(inventory),
      cache.setCategories(categories),
    ]);

    await cache.setLastSync();
    setLastSync(new Date());
  }, []);

  // Full sync: push queued actions, then pull fresh data
  const sync = useCallback(async () => {
    if (!isOnline || isSyncing || !isAuthenticated) return;

    setIsSyncing(true);
    try {
      // First, push any pending actions
      await processQueue();

      // Then, pull fresh data
      await pullData();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, isAuthenticated, processQueue, pullData]);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);

      // Auto-sync when coming back online
      if (online && isAuthenticated) {
        sync();
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, sync]);

  // Initial sync on auth
  useEffect(() => {
    if (isAuthenticated && isOnline) {
      sync();
    }
    refreshPendingCount();
  }, [isAuthenticated]);

  // Load last sync time
  useEffect(() => {
    cache.getLastSync().then(setLastSync);
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        lastSync,
        sync,
        refreshPendingCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
