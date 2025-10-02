import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { Redirect, Slot, usePathname } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Token cache for Clerk (recommended for Expo)
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn('SecureStore getItemAsync error', err);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.warn('SecureStore setItemAsync error', err);
    }
  },
};

// Auth gate using pathname-based routing (more reliable)
function AuthGate() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();

  console.log('AuthGate: Current state', { pathname, isSignedIn, isLoaded });

  if (!isLoaded) {
    return <Slot />;
  }

  // Check if current route is protected or auth using pathname
  const isProtectedRoute = pathname.includes('/protected') || pathname.startsWith('/protected');
  const isAuthRoute = pathname.includes('/auth') || pathname.startsWith('/auth');

  console.log('AuthGate: Route analysis', { isProtectedRoute, isAuthRoute });

  // Redirect logic
  if (!isSignedIn && isProtectedRoute) {
    console.log('AuthGate: Redirecting to auth (not signed in)');
    return <Redirect href="/(auth)" />;
  }

  if (isSignedIn && isAuthRoute) {
    console.log('AuthGate: Redirecting to protected (signed in)');
    return <Redirect href="/(protected)" />;
  }

  console.log('AuthGate: No redirect needed, showing current route');
  return <Slot />;
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    console.warn('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthGate />
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}

