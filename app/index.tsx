import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, View } from 'react-native';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('Index: Auth state changed', { isLoaded, isSignedIn });
    
    if (!isLoaded) {
      return;
    }

    const href = isSignedIn ? '/(protected)' : '/(auth)';
    console.log('Index: Redirecting to', href);
    
    const timeout = setTimeout(() => {
      router.replace(href);
    }, 100); // Small delay to ensure state is stable

    return () => clearTimeout(timeout);
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('@/assets/images/loader2.gif')}
          style={{ width: 200, height: 200 }}
        />
      </View>
    );
  }

  return null;
}

