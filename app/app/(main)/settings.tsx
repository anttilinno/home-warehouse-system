import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../contexts/SyncContext';

export default function SettingsScreen() {
  const { user, currentWorkspace, workspaces, logout, setCurrentWorkspace } = useAuth();
  const { isOnline, isSyncing, pendingCount, lastSync, sync } = useSync();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleWorkspaceChange = () => {
    if (workspaces.length <= 1) {
      Alert.alert('Single Workspace', 'You only have one workspace.');
      return;
    }

    Alert.alert(
      'Switch Workspace',
      'Select a workspace:',
      workspaces.map((ws) => ({
        text: ws.name + (ws.id === currentWorkspace?.id ? ' ✓' : ''),
        onPress: () => setCurrentWorkspace(ws),
      }))
    );
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleString();
  };

  return (
    <ScrollView style={styles.container}>
      {/* User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || '-'}</Text>

          <Text style={[styles.label, styles.marginTop]}>Name</Text>
          <Text style={styles.value}>{user?.full_name || '-'}</Text>
        </View>
      </View>

      {/* Workspace */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workspace</Text>
        <TouchableOpacity style={styles.card} onPress={handleWorkspaceChange}>
          <Text style={styles.label}>Current Workspace</Text>
          <Text style={styles.value}>{currentWorkspace?.name || '-'}</Text>
          <Text style={styles.role}>Role: {currentWorkspace?.role || '-'}</Text>
          {workspaces.length > 1 && (
            <Text style={styles.hint}>Tap to switch workspace</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Sync Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, isOnline ? styles.online : styles.offline]} />
              <Text style={styles.value}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>

          <View style={[styles.row, styles.marginTop]}>
            <Text style={styles.label}>Pending Actions</Text>
            <Text style={styles.value}>{pendingCount}</Text>
          </View>

          <View style={[styles.row, styles.marginTop]}>
            <Text style={styles.label}>Last Sync</Text>
            <Text style={styles.value}>{formatDate(lastSync)}</Text>
          </View>

          {isOnline && (
            <TouchableOpacity
              style={[styles.button, styles.syncButton]}
              onPress={sync}
              disabled={isSyncing}
            >
              <Text style={styles.buttonText}>
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Server */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Server</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(auth)/server-config')}
        >
          <Text style={styles.label}>Configure Server URL</Text>
          <Text style={styles.hint}>Tap to change server settings</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.version}>Home Warehouse Companion v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 16,
    color: '#1a1a1a',
    marginTop: 2,
  },
  role: {
    fontSize: 14,
    color: '#0066cc',
    marginTop: 8,
  },
  hint: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  marginTop: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
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
  button: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButton: {
    backgroundColor: '#0066cc',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  logoutButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  version: {
    color: '#999',
    fontSize: 14,
  },
});
