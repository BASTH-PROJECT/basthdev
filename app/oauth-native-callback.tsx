import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';

// Handles Clerk OAuth redirect on Expo (web/native). If Clerk completes the
// session via cookies (web) or the native flow, we just forward home.
export default function OAuthNativeCallback() {
  useEffect(() => {
    console.log('oauth-native-callback: received OAuth redirect');
  }, []);

  return <Redirect href="/" />;
}
