import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSync } from '../../../contexts/SyncContext';
import { cache } from '../../../lib/storage/cache';
import { Inventory, Item, Container } from '../../../lib/api';

interface InventoryWithDetails extends Inventory {
  itemName?: string;
  containerName?: string;
}

export default function InventoryListScreen() {
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { isOnline, sync, isSyncing } = useSync();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cachedInventory, cachedItems, cachedContainers] = await Promise.all([
      cache.getInventory(),
      cache.getItems(),
      cache.getContainers(),
    ]);

    setItems(cachedItems);
    setContainers(cachedContainers);

    // Enrich inventory with item and container names
    const enriched = cachedInventory.map((inv) => {
      const item = cachedItems.find((i) => i.id === inv.item_id);
      const container = cachedContainers.find((c) => c.id === inv.container_id);
      return {
        ...inv,
        itemName: item?.name || 'Unknown Item',
        containerName: container?.name,
      };
    });

    setInventory(enriched);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (isOnline) {
      await sync();
    }
    await loadData();
    setRefreshing(false);
  };

  const filteredInventory = inventory.filter((inv) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      inv.itemName?.toLowerCase().includes(searchLower) ||
      inv.containerName?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return '#22c55e';
      case 'IN_USE': return '#3b82f6';
      case 'ON_LOAN': return '#f59e0b';
      case 'RESERVED': return '#8b5cf6';
      default: return '#666';
    }
  };

  const renderItem = ({ item: inv }: { item: InventoryWithDetails }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({
        pathname: '/(main)/inventory/adjust',
        params: { inventoryId: inv.id },
      })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.itemName} numberOfLines={1}>{inv.itemName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(inv.status) }]}>
          <Text style={styles.statusText}>{inv.status}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.row}>
          <Text style={styles.label}>Quantity</Text>
          <Text style={styles.quantity}>{inv.quantity}</Text>
        </View>

        {inv.containerName && (
          <View style={styles.row}>
            <Text style={styles.label}>Container</Text>
            <Text style={styles.value}>{inv.containerName}</Text>
          </View>
        )}

        {inv.condition && (
          <View style={styles.row}>
            <Text style={styles.label}>Condition</Text>
            <Text style={styles.value}>{inv.condition}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredInventory}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isSyncing}
            onRefresh={handleRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No inventory found</Text>
            <Text style={styles.emptyHint}>
              Scan a barcode to add items
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  quantity: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0066cc',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
  },
});
