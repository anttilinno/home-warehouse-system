import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useSync } from '../../contexts/SyncContext';
import { cache } from '../../lib/storage/cache';
import { barcodeApi, Container, Item } from '../../lib/api';

type ScanType = 'product' | 'container' | 'unknown';

interface ScanResult {
  type: ScanType;
  value: string;
  rawData: string;
}

function parseScan(data: string, barcodeType: string): ScanResult {
  // Check for container QR code format: hw://container/{short_code}
  if (data.startsWith('hw://container/')) {
    const shortCode = data.replace('hw://container/', '');
    return { type: 'container', value: shortCode, rawData: data };
  }

  // Product barcodes (EAN, UPC, etc.)
  const productTypes = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'];
  if (productTypes.some((t) => barcodeType.toLowerCase().includes(t))) {
    return { type: 'product', value: data, rawData: data };
  }

  // QR codes that aren't container codes - treat as product
  if (barcodeType.toLowerCase() === 'qr') {
    return { type: 'product', value: data, rawData: data };
  }

  return { type: 'unknown', value: data, rawData: data };
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const { isOnline, pendingCount, isSyncing, sync } = useSync();

  // Restart camera when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[SCAN] Screen focused - activating camera');
      setIsFocused(true);
      setScanned(false);

      return () => {
        console.log('[SCAN] Screen unfocused - deactivating camera');
        setIsFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    console.log('[SCAN] Component mounted');
    console.log('[SCAN] Camera permission:', permission);
  }, [permission]);

  const handleBarCodeScanned = async ({ data, type }: BarcodeScanningResult) => {
    console.log('[SCAN] Barcode detected:', { data, type, scanned, processing });

    if (scanned || processing) {
      console.log('[SCAN] Ignoring - already scanned or processing');
      return;
    }

    setScanned(true);
    setProcessing(true);

    try {
      const result = parseScan(data, type);
      console.log('[SCAN] Parsed result:', result);

      if (result.type === 'container') {
        console.log('[SCAN] Handling as container:', result.value);
        await handleContainerScan(result.value);
      } else if (result.type === 'product') {
        console.log('[SCAN] Handling as product:', result.value);
        await handleProductScan(result.value);
      } else {
        console.log('[SCAN] Unknown barcode type');
        Alert.alert('Unknown Barcode', `Scanned: ${data}`);
      }
    } catch (error) {
      console.error('[SCAN] Error:', error);
      Alert.alert('Error', 'Failed to process barcode');
    } finally {
      setProcessing(false);
      // Reset after delay
      setTimeout(() => setScanned(false), 2000);
    }
  };

  const handleContainerScan = async (shortCode: string) => {
    // Try cache first
    let container = await cache.getContainerByShortCode(shortCode);

    if (!container && isOnline) {
      // Try to find online
      const containers = await cache.getContainers();
      container = containers.find((c) => c.short_code === shortCode) || null;
    }

    if (container) {
      router.push(`/(main)/containers/${container.id}`);
    } else {
      Alert.alert('Container Not Found', `No container with code: ${shortCode}`);
    }
  };

  const handleProductScan = async (barcode: string) => {
    // Check if we already have this item in cache (by SKU matching barcode)
    const items = await cache.getItems();
    const existingItem = items.find((item) => item.sku === barcode);

    if (existingItem) {
      // Item exists, go to add inventory
      router.push({
        pathname: '/(main)/inventory/add',
        params: { itemId: existingItem.id, barcode },
      });
      return;
    }

    // Try barcode lookup if online
    if (isOnline) {
      try {
        const product = await barcodeApi.lookup(barcode);
        if (product && !product.error) {
          router.push({
            pathname: '/(main)/inventory/add',
            params: {
              barcode,
              name: product.name || '',
              brand: product.brand || '',
              description: product.description || '',
            },
          });
          return;
        }
      } catch (error) {
        console.log('Barcode lookup failed:', error);
      }
    }

    // No match found, go to add with just barcode
    router.push({
      pathname: '/(main)/inventory/add',
      params: { barcode },
    });
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]} />
        <Text style={styles.statusText}>
          {isOnline ? 'Online' : 'Offline'}
          {pendingCount > 0 && ` • ${pendingCount} pending`}
        </Text>
        {isOnline && pendingCount > 0 && (
          <TouchableOpacity onPress={sync} disabled={isSyncing}>
            <Text style={styles.syncButton}>
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Camera - only render when focused */}
      {isFocused ? (
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
        {/* Scan overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.hint}>
            {processing ? 'Processing...' : 'Point camera at barcode or QR code'}
          </Text>
        </View>
        </CameraView>
      ) : (
        <View style={[styles.camera, styles.cameraInactive]}>
          <Text style={styles.hint}>Camera paused</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraInactive: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  online: {
    backgroundColor: '#22c55e',
  },
  offline: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    color: '#fff',
    flex: 1,
  },
  syncButton: {
    color: '#0066cc',
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  hint: {
    color: '#fff',
    marginTop: 24,
    fontSize: 16,
  },
});
