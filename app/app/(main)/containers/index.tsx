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
import { Container, Location } from '../../../lib/api';

interface ContainerWithLocation extends Container {
  locationName?: string;
}

export default function ContainersListScreen() {
  const [containers, setContainers] = useState<ContainerWithLocation[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { isOnline, sync, isSyncing } = useSync();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cachedContainers, cachedLocations] = await Promise.all([
      cache.getContainers(),
      cache.getLocations(),
    ]);

    const enriched = cachedContainers.map((container) => {
      const location = cachedLocations.find((l) => l.id === container.location_id);
      return {
        ...container,
        locationName: location?.name,
      };
    });

    setContainers(enriched);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (isOnline) {
      await sync();
    }
    await loadData();
    setRefreshing(false);
  };

  const filteredContainers = containers.filter((container) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      container.name.toLowerCase().includes(searchLower) ||
      container.short_code?.toLowerCase().includes(searchLower) ||
      container.locationName?.toLowerCase().includes(searchLower)
    );
  });

  const renderItem = ({ item: container }: { item: ContainerWithLocation }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(main)/containers/${container.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.containerName}>{container.name}</Text>
        {container.short_code && (
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>{container.short_code}</Text>
          </View>
        )}
      </View>

      {container.locationName && (
        <Text style={styles.location}>{container.locationName}</Text>
      )}

      {container.description && (
        <Text style={styles.description} numberOfLines={2}>
          {container.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search containers..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredContainers}
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
            <Text style={styles.emptyText}>No containers found</Text>
            <Text style={styles.emptyHint}>
              Scan a container QR code to view its contents
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
    marginBottom: 8,
  },
  containerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  codeBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  codeText: {
    color: '#4338ca',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  location: {
    fontSize: 14,
    color: '#0066cc',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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
