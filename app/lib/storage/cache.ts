import AsyncStorage from '@react-native-async-storage/async-storage';
import { Item, Location, Container, Inventory, Category } from '../api/types';

const CACHE_KEYS = {
  items: 'cache/items',
  locations: 'cache/locations',
  containers: 'cache/containers',
  inventory: 'cache/inventory',
  categories: 'cache/categories',
  lastSync: 'cache/last_sync',
};

export interface CachedData {
  items: Item[];
  locations: Location[];
  containers: Container[];
  inventory: Inventory[];
  categories: Category[];
}

export const cache = {
  // Items
  async getItems(): Promise<Item[]> {
    const data = await AsyncStorage.getItem(CACHE_KEYS.items);
    return data ? JSON.parse(data) : [];
  },

  async setItems(items: Item[]): Promise<void> {
    await AsyncStorage.setItem(CACHE_KEYS.items, JSON.stringify(items));
  },

  // Locations
  async getLocations(): Promise<Location[]> {
    const data = await AsyncStorage.getItem(CACHE_KEYS.locations);
    return data ? JSON.parse(data) : [];
  },

  async setLocations(locations: Location[]): Promise<void> {
    await AsyncStorage.setItem(CACHE_KEYS.locations, JSON.stringify(locations));
  },

  // Containers
  async getContainers(): Promise<Container[]> {
    const data = await AsyncStorage.getItem(CACHE_KEYS.containers);
    return data ? JSON.parse(data) : [];
  },

  async setContainers(containers: Container[]): Promise<void> {
    await AsyncStorage.setItem(CACHE_KEYS.containers, JSON.stringify(containers));
  },

  async getContainerByShortCode(shortCode: string): Promise<Container | null> {
    const containers = await this.getContainers();
    return containers.find((c) => c.short_code === shortCode) || null;
  },

  // Inventory
  async getInventory(): Promise<Inventory[]> {
    const data = await AsyncStorage.getItem(CACHE_KEYS.inventory);
    return data ? JSON.parse(data) : [];
  },

  async setInventory(inventory: Inventory[]): Promise<void> {
    await AsyncStorage.setItem(CACHE_KEYS.inventory, JSON.stringify(inventory));
  },

  async updateInventoryItem(id: string, updates: Partial<Inventory>): Promise<void> {
    const inventory = await this.getInventory();
    const index = inventory.findIndex((i) => i.id === id);
    if (index >= 0) {
      inventory[index] = { ...inventory[index], ...updates };
      await this.setInventory(inventory);
    }
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    const data = await AsyncStorage.getItem(CACHE_KEYS.categories);
    return data ? JSON.parse(data) : [];
  },

  async setCategories(categories: Category[]): Promise<void> {
    await AsyncStorage.setItem(CACHE_KEYS.categories, JSON.stringify(categories));
  },

  // Last Sync
  async getLastSync(): Promise<Date | null> {
    const data = await AsyncStorage.getItem(CACHE_KEYS.lastSync);
    return data ? new Date(data) : null;
  },

  async setLastSync(date: Date = new Date()): Promise<void> {
    await AsyncStorage.setItem(CACHE_KEYS.lastSync, date.toISOString());
  },

  // Clear all cache
  async clear(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
  },

  // Get all cached data
  async getAll(): Promise<CachedData> {
    const [items, locations, containers, inventory, categories] = await Promise.all([
      this.getItems(),
      this.getLocations(),
      this.getContainers(),
      this.getInventory(),
      this.getCategories(),
    ]);

    return { items, locations, containers, inventory, categories };
  },
};
