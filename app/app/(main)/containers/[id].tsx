import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSync } from '../../../contexts/SyncContext';
import { cache } from '../../../lib/storage/cache';
import { Container, Inventory, Item, Location } from '../../../lib/api';

interface InventoryWithItem extends Inventory {
  itemName?: string;
  itemBrand?: string | null;
  itemSku?: string | null;
}

export default function ContainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isOnline, sync, isSyncing } = useSync();

  const [container, setContainer] = useState<Container | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [inventory, setInventory] = useState<InventoryWithItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    const [cachedContainers, cachedLocations, cachedInventory, cachedItems] = await Promise.all([
      cache.getContainers(),
      cache.getLocations(),
      cache.getInventory(),
      cache.getItems(),
    ]);

    const foundContainer = cachedContainers.find((c) => c.id === id);
    setContainer(foundContainer || null);

    if (foundContainer) {
      const foundLocation = cachedLocations.find((l) => l.id === foundContainer.location_id);
      setLocation(foundLocation || null);

      // Get inventory in this container
      const containerInventory = cachedInventory.filter((inv) => inv.container_id === id);

      // Enrich with item details
      const enriched = containerInventory.map((inv) => {
        const item = cachedItems.find((i) => i.id === inv.item_id);
        return {
          ...inv,
          itemName: item?.name || 'Unknown Item',
          itemBrand: item?.brand,
          itemSku: item?.sku,
        };
      });

      setInventory(enriched);
    }

    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (isOnline) {
      await sync();
    }
    await loadData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return '#22c55e';
      case 'IN_USE': return '#3b82f6';
      case 'ON_LOAN': return '#f59e0b';
      case 'RESERVED': return '#8b5cf6';
      default: return '#666';
    }
  };

  const renderItem = ({ item: inv }: { item: InventoryWithItem }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => router.push({
        pathname: '/(main)/inventory/adjust',
        params: { inventoryId: inv.id },
      })}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{inv.itemName}</Text>
          {inv.itemBrand && (
            <Text style={styles.itemBrand}>{inv.itemBrand}</Text>
          )}
          {inv.itemSku && (
            <Text style={styles.itemSku}>SKU: {inv.itemSku}</Text>
          )}
        </View>
        <View style={styles.itemQuantity}>
          <Text style={styles.quantityValue}>{inv.quantity}</Text>
          <Text style={styles.quantityLabel}>qty</Text>
        </View>
      </View>

      <View style={styles.itemFooter}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(inv.status) }]}>
          <Text style={styles.statusText}>{inv.status}</Text>
        </View>
        {inv.condition && (
          <Text style={styles.condition}>{inv.condition}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!container) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Container not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Container Info Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.containerName}>{container.name}</Text>
          {container.short_code && (
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{container.short_code}</Text>
            </View>
          )}
        </View>

        {location && (
          <Text style={styles.locationText}>{location.name}</Text>
        )}

        {container.description && (
          <Text style={styles.description}>{container.description}</Text>
        )}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{inventory.length}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {inventory.reduce((sum, inv) => sum + inv.quantity, 0)}
            </Text>
            <Text style={styles.statLabel}>Total Qty</Text>
          </View>
        </View>
      </View>

      {/* Inventory List */}
      <FlatList
        data={inventory}
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
            <Text style={styles.emptyText}>Container is empty</Text>
            <Text style={styles.emptyHint}>
              Scan a product barcode to add items
            </Text>
          </View>
        }
        ListHeaderComponent={
          inventory.length > 0 ? (
            <Text style={styles.listTitle}>Contents</Text>
          ) : null
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  notFoundText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  containerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  codeBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  codeText: {
    color: '#4338ca',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  locationText: {
    fontSize: 16,
    color: '#0066cc',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  stats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  list: {
    padding: 16,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  itemBrand: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  itemSku: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  itemQuantity: {
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0066cc',
  },
  quantityLabel: {
    fontSize: 11,
    color: '#666',
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
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
  condition: {
    fontSize: 12,
    color: '#666',
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
