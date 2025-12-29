import { Stack } from 'expo-router';

export default function ContainersLayout() {
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
        options={{ title: 'Containers' }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Container Contents' }}
      />
    </Stack>
  );
}
