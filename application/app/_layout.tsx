import { Stack } from 'expo-router';
import { AuthProvider } from '../context/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="activeRecording" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="aiReflection" />
        <Stack.Screen name="aiLiveConversation" />
        <Stack.Screen name="jornalHistory" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(auth)/login" options={{ presentation: 'modal' }} />
      </Stack>
    </AuthProvider>
  );
}
