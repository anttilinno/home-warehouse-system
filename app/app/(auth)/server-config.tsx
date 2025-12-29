import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ServerConfigScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadServerUrl();
  }, []);

  const loadServerUrl = async () => {
    const url = await AsyncStorage.getItem('api_base_url');
    if (url) {
      setServerUrl(url);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      let url = serverUrl.trim();

      if (url) {
        // Ensure URL has protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `http://${url}`;
        }

        // Remove trailing slash
        url = url.replace(/\/$/, '');

        // Test connection
        try {
          const response = await fetch(`${url}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!response.ok) {
            throw new Error('Server not responding');
          }
        } catch (err) {
          Alert.alert(
            'Connection Failed',
            'Could not connect to the server. Save anyway?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save Anyway',
                onPress: async () => {
                  await AsyncStorage.setItem('api_base_url', url);
                  router.back();
                },
              },
            ]
          );
          setIsSaving(false);
          return;
        }

        await AsyncStorage.setItem('api_base_url', url);
      } else {
        await AsyncStorage.removeItem('api_base_url');
      }

      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save server URL');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    await AsyncStorage.removeItem('api_base_url');
    setServerUrl('');
    Alert.alert('Reset', 'Server URL reset to default (localhost:8000)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Server Configuration</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          placeholder="http://192.168.1.100:8000"
          value={serverUrl}
          onChangeText={setServerUrl}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>
          Leave empty to use default (localhost:8000)
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={handleReset}
          >
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    color: '#0066cc',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  content: {
    padding: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  buttons: {
    marginTop: 32,
    gap: 16,
  },
  button: {
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#0066cc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
