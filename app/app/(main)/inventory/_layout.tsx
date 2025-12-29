import { Stack } from 'expo-router';

export default function InventoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#0066cc',
        headerTitleStyle: { fontWeight: '600', color: '#1a1a1a' },
        headerBackVisible: true,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Inventory', headerShown: false }}
      />
      <Stack.Screen
        name="add"
        options={{ title: 'Add Inventory' }}
      />
      <Stack.Screen
        name="adjust"
        options={{ title: 'Adjust Stock' }}
      />
    </Stack>
  );
}
