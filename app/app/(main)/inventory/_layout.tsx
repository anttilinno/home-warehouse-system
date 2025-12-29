import { Stack } from 'expo-router';

export default function InventoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#1a1a1a',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Inventory' }}
      />
      <Stack.Screen
        name="add"
        options={{ title: 'Add Inventory', presentation: 'modal' }}
      />
      <Stack.Screen
        name="adjust"
        options={{ title: 'Adjust Stock', presentation: 'modal' }}
      />
    </Stack>
  );
}
