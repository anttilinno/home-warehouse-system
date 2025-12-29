import { Tabs, router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSync } from '../../contexts/SyncContext';

function SyncBadge() {
  const { pendingCount, isOnline } = useSync();

  if (pendingCount === 0 && isOnline) return null;

  return (
    <View style={[styles.badge, !isOnline && styles.badgeOffline]}>
      <Text style={styles.badgeText}>
        {isOnline ? pendingCount : '!'}
      </Text>
    </View>
  );
}

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: '#666',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24, color }}>📷</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: 24, color }}>📦</Text>
              <SyncBadge />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // Always navigate to inventory index when tab pressed
            e.preventDefault();
            router.replace('/(main)/inventory');
          },
        }}
      />
      <Tabs.Screen
        name="containers"
        options={{
          title: 'Containers',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24, color }}>🗃️</Text>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/(main)/containers');
          },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24, color }}>⚙️</Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#0066cc',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeOffline: {
    backgroundColor: '#f59e0b',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
