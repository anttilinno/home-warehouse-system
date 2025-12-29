import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

export type ActionType =
  | 'create_item'
  | 'create_inventory'
  | 'adjust_stock'
  | 'update_inventory';

export interface QueuedAction {
  id: string;
  type: ActionType;
  payload: any;
  timestamp: number;
  retryCount: number;
  tempId?: string; // For tracking temp IDs that need to be replaced
}

const QUEUE_KEY = 'offline_queue';

export const offlineQueue = {
  async add(
    type: ActionType,
    payload: any,
    tempId?: string
  ): Promise<QueuedAction> {
    const action: QueuedAction = {
      id: uuidv4(),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      tempId,
    };

    const queue = await this.getAll();
    queue.push(action);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    return action;
  },

  async getAll(): Promise<QueuedAction[]> {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  },

  async remove(id: string): Promise<void> {
    const queue = await this.getAll();
    const filtered = queue.filter((action) => action.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  },

  async incrementRetry(id: string): Promise<void> {
    const queue = await this.getAll();
    const action = queue.find((a) => a.id === id);
    if (action) {
      action.retryCount += 1;
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },

  async count(): Promise<number> {
    const queue = await this.getAll();
    return queue.length;
  },

  async updatePayload(id: string, payload: any): Promise<void> {
    const queue = await this.getAll();
    const action = queue.find((a) => a.id === id);
    if (action) {
      action.payload = payload;
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  },

  // Replace temp ID with real ID after sync
  async replaceTempId(tempId: string, realId: string): Promise<void> {
    const queue = await this.getAll();
    let updated = false;

    for (const action of queue) {
      // Replace in payload if it references the temp ID
      if (action.payload.item_id === tempId) {
        action.payload.item_id = realId;
        updated = true;
      }
      if (action.tempId === tempId) {
        action.tempId = undefined;
        updated = true;
      }
    }

    if (updated) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  },
};
