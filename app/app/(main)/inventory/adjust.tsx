import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { cache } from '../../../lib/storage/cache';
import { offlineQueue } from '../../../lib/storage/offline-queue';
import { useSync } from '../../../contexts/SyncContext';
import { api, Inventory, Item } from '../../../lib/api';

export default function AdjustStockScreen() {
  const { inventoryId } = useLocalSearchParams<{ inventoryId: string }>();
  const { isOnline, sync } = useSync();

  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [inventoryId]);

  const loadData = async () => {
    if (!inventoryId) return;

    const cachedInventory = await cache.getInventory();
    const inv = cachedInventory.find((i) => i.id === inventoryId);

    if (inv) {
      setInventory(inv);

      const cachedItems = await cache.getItems();
      const foundItem = cachedItems.find((i) => i.id === inv.item_id);
      setItem(foundItem || null);
    }
  };

  const handleAdjust = (delta: number) => {
    const newValue = adjustment + delta;
    // Don't allow adjustment that would result in negative quantity
    if (inventory && inventory.quantity + newValue < 0) {
      return;
    }
    setAdjustment(newValue);
  };

  const handleSave = async () => {
    if (!inventory || adjustment === 0) {
      router.back();
      return;
    }

    setSaving(true);

    try {
      const payload = {
        inventory_id: inventory.id,
        adjustment,
      };

      if (isOnline) {
        try {
          await api.inventory.adjust(inventory.id, adjustment);

          // Update local cache
          await cache.updateInventoryItem(inventory.id, {
            quantity: inventory.quantity + adjustment,
          });
        } catch (error) {
          console.error('Failed to adjust online:', error);
          // Queue for later
          await offlineQueue.add('adjust_stock', payload);
          // Optimistically update cache
          await cache.updateInventoryItem(inventory.id, {
            quantity: inventory.quantity + adjustment,
          });
        }
      } else {
        // Queue for later
        await offlineQueue.add('adjust_stock', payload);
        // Optimistically update cache
        await cache.updateInventoryItem(inventory.id, {
          quantity: inventory.quantity + adjustment,
        });
      }

      // Try to sync if online
      if (isOnline) {
        await sync();
      }

      Alert.alert('Success', 'Stock adjusted successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Adjust error:', error);
      Alert.alert('Error', 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const newQuantity = inventory ? inventory.quantity + adjustment : 0;

  if (!inventory) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Item Info */}
      <View style={styles.card}>
        <Text style={styles.itemName}>{item?.name || 'Unknown Item'}</Text>
        {item?.brand && <Text style={styles.itemBrand}>{item.brand}</Text>}
        {item?.sku && <Text style={styles.itemSku}>SKU: {item.sku}</Text>}
      </View>

      {/* Current Stock */}
      <View style={styles.stockCard}>
        <Text style={styles.stockLabel}>Current Stock</Text>
        <Text style={styles.stockValue}>{inventory.quantity}</Text>
      </View>

      {/* Adjustment Controls */}
      <View style={styles.adjustCard}>
        <Text style={styles.adjustLabel}>Adjustment</Text>

        <View style={styles.adjustControls}>
          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => handleAdjust(-10)}
          >
            <Text style={styles.adjustButtonText}>-10</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => handleAdjust(-1)}
          >
            <Text style={styles.adjustButtonText}>-1</Text>
          </TouchableOpacity>

          <View style={styles.adjustValueContainer}>
            <Text style={[
              styles.adjustValue,
              adjustment > 0 && styles.adjustPositive,
              adjustment < 0 && styles.adjustNegative,
            ]}>
              {adjustment > 0 ? `+${adjustment}` : adjustment}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => handleAdjust(1)}
          >
            <Text style={styles.adjustButtonText}>+1</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => handleAdjust(10)}
          >
            <Text style={styles.adjustButtonText}>+10</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => setAdjustment(0)}
        >
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* New Stock Preview */}
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>New Stock</Text>
        <Text style={[
          styles.previewValue,
          newQuantity <= 0 && styles.previewWarning,
        ]}>
          {newQuantity}
        </Text>
        {newQuantity <= 0 && (
          <Text style={styles.warningText}>Warning: Stock will be zero or negative</Text>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>
            {adjustment === 0 ? 'Cancel' : 'Save Adjustment'}
          </Text>
        )}
      </TouchableOpacity>

      {!isOnline && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineText}>
            Offline - Changes will sync when back online
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  itemName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  itemBrand: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  itemSku: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  stockCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  stockValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  adjustCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  adjustLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  adjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustButton: {
    width: 56,
    height: 56,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  adjustValueContainer: {
    width: 80,
    alignItems: 'center',
  },
  adjustValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#666',
  },
  adjustPositive: {
    color: '#22c55e',
  },
  adjustNegative: {
    color: '#dc2626',
  },
  resetButton: {
    marginTop: 16,
    padding: 8,
  },
  resetButtonText: {
    color: '#0066cc',
    fontSize: 14,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#0066cc',
  },
  previewWarning: {
    color: '#dc2626',
  },
  warningText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    height: 52,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  offlineNotice: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  offlineText: {
    color: '#92400e',
    fontSize: 14,
    textAlign: 'center',
  },
});
