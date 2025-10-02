import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';

// Handles alternative Clerk OAuth redirect path.
export default function ClerkNativeCallback() {
  useEffect(() => {
    console.log('clerk-native-callback: received OAuth redirect');
  }, []);

  return <Redirect href="/" />;
}
