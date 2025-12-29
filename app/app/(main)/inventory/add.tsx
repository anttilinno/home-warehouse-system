import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { cache } from '../../../lib/storage/cache';
import { offlineQueue } from '../../../lib/storage/offline-queue';
import { useSync } from '../../../contexts/SyncContext';
import { api, Location, Container, Category, Item } from '../../../lib/api';
import { v7 as uuidv7 } from 'uuid';

const CONDITIONS = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'FOR_REPAIR'];
const STATUSES = ['AVAILABLE', 'IN_USE', 'RESERVED', 'ON_LOAN', 'IN_TRANSIT', 'DISPOSED', 'MISSING'];

export default function AddInventoryScreen() {
  const params = useLocalSearchParams<{
    itemId?: string;
    barcode?: string;
    name?: string;
    brand?: string;
    description?: string;
  }>();

  const { isOnline, sync } = useSync();

  // Item fields (for new items)
  const [itemName, setItemName] = useState(params.name || '');
  const [itemBrand, setItemBrand] = useState(params.brand || '');
  const [itemDescription, setItemDescription] = useState(params.description || '');
  const [itemSku, setItemSku] = useState(params.barcode || '');
  const [categoryId, setCategoryId] = useState<string>('');

  // Inventory fields
  const [quantity, setQuantity] = useState('1');
  const [locationId, setLocationId] = useState<string>('');
  const [containerId, setContainerId] = useState<string>('');
  const [condition, setCondition] = useState('GOOD');
  const [status, setStatus] = useState('AVAILABLE');
  const [notes, setNotes] = useState('');

  // Data
  const [existingItem, setExistingItem] = useState<Item | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cachedLocations, cachedContainers, cachedCategories, cachedItems] = await Promise.all([
      cache.getLocations(),
      cache.getContainers(),
      cache.getCategories(),
      cache.getItems(),
    ]);

    setLocations(cachedLocations);
    setContainers(cachedContainers);
    setCategories(cachedCategories);

    // Check if we have an existing item
    if (params.itemId) {
      const item = cachedItems.find((i) => i.id === params.itemId);
      if (item) {
        setExistingItem(item);
        setItemName(item.name);
        setItemBrand(item.brand || '');
        setItemDescription(item.description || '');
        setItemSku(item.sku || '');
        setCategoryId(item.category_id || '');
      }
    }
  };

  const filteredContainers = locationId
    ? containers.filter((c) => c.location_id === locationId)
    : containers;

  const handleSave = async () => {
    if (!itemName.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }

    if (!locationId) {
      Alert.alert('Error', 'Location is required');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Error', 'Quantity must be at least 1');
      return;
    }

    setSaving(true);

    try {
      let itemId = existingItem?.id;

      // Create new item if needed
      if (!itemId) {
        const tempItemId = uuidv7();

        const itemPayload = {
          name: itemName.trim(),
          sku: itemSku || null,
          brand: itemBrand || null,
          description: itemDescription || null,
          category_id: categoryId || null,
        };

        if (isOnline) {
          try {
            const newItem = await api.items.create(itemPayload);
            itemId = newItem.id;
            // Update cache
            const items = await cache.getItems();
            await cache.setItems([...items, newItem]);
          } catch (error) {
            console.error('Failed to create item online:', error);
            // Queue for later
            await offlineQueue.add('create_item', itemPayload, tempItemId);
            itemId = tempItemId;
          }
        } else {
          // Queue for later
          await offlineQueue.add('create_item', itemPayload, tempItemId);
          itemId = tempItemId;
        }
      }

      // Create inventory record
      const inventoryPayload = {
        item_id: itemId,
        location_id: locationId,
        container_id: containerId || null,
        quantity: qty,
        condition,
        status,
        notes: notes || null,
      };

      if (isOnline) {
        try {
          const newInventory = await api.inventory.create(inventoryPayload);
          // Update cache
          const inventory = await cache.getInventory();
          await cache.setInventory([...inventory, newInventory]);
        } catch (error) {
          console.error('Failed to create inventory online:', error);
          await offlineQueue.add('create_inventory', inventoryPayload);
        }
      } else {
        await offlineQueue.add('create_inventory', inventoryPayload);
      }

      // Sync if online to push any queued actions
      if (isOnline) {
        await sync();
      }

      Alert.alert('Success', 'Inventory added successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save inventory');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Item Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Item Information</Text>

        {existingItem && (
          <View style={styles.existingBadge}>
            <Text style={styles.existingText}>Existing item found</Text>
          </View>
        )}

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={itemName}
          onChangeText={setItemName}
          placeholder="Item name"
          editable={!existingItem}
        />

        <Text style={styles.label}>SKU / Barcode</Text>
        <TextInput
          style={[styles.input, existingItem && styles.inputDisabled]}
          value={itemSku}
          onChangeText={setItemSku}
          placeholder="Barcode or SKU"
          editable={!existingItem}
        />

        <Text style={styles.label}>Brand</Text>
        <TextInput
          style={[styles.input, existingItem && styles.inputDisabled]}
          value={itemBrand}
          onChangeText={setItemBrand}
          placeholder="Brand name"
          editable={!existingItem}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={categoryId}
            onValueChange={setCategoryId}
            enabled={!existingItem}
          >
            <Picker.Item label="Select category..." value="" />
            {categories.map((cat) => (
              <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea, existingItem && styles.inputDisabled]}
          value={itemDescription}
          onChangeText={setItemDescription}
          placeholder="Description"
          multiline
          numberOfLines={3}
          editable={!existingItem}
        />
      </View>

      {/* Inventory Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inventory Details</Text>

        <Text style={styles.label}>Location *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={locationId}
            onValueChange={(value) => {
              setLocationId(value);
              setContainerId(''); // Reset container when location changes
            }}
          >
            <Picker.Item label="Select location..." value="" />
            {locations.map((loc) => (
              <Picker.Item key={loc.id} label={loc.name} value={loc.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Container (Optional)</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={containerId}
            onValueChange={setContainerId}
            enabled={filteredContainers.length > 0}
          >
            <Picker.Item label="No container" value="" />
            {filteredContainers.map((cont) => (
              <Picker.Item key={cont.id} label={cont.name} value={cont.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Quantity *</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          placeholder="1"
        />

        <Text style={styles.label}>Condition</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={condition} onValueChange={setCondition}>
            {CONDITIONS.map((c) => (
              <Picker.Item key={c} label={c} value={c} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Status</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={status} onValueChange={setStatus}>
            {STATUSES.map((s) => (
              <Picker.Item key={s} label={s} value={s} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Additional notes..."
          multiline
          numberOfLines={3}
        />
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
          <Text style={styles.saveButtonText}>Add to Inventory</Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  existingBadge: {
    backgroundColor: '#dbeafe',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  existingText: {
    color: '#1d4ed8',
    fontSize: 14,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  saveButton: {
    margin: 16,
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
  footer: {
    height: 32,
  },
});
