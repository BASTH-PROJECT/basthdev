import { colors } from '@/styles/colors';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

interface SignOutButtonProps {
  variant?: 'drawer' | 'inline';
  containerStyle?: ViewStyle;
  onBeforeSignOut?: () => void; // e.g., close drawer
  confirm?: boolean; // show confirmation dialog before sign out
}

export default function SignOutButton({ variant = 'drawer', containerStyle, onBeforeSignOut, confirm = true }: SignOutButtonProps) {
  const { signOut, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(false);

  const doSignOut = async () => {
    if (loading) return;
    try {
      setLoading(true);
      console.log('[SignOut] Initiating sign out...');
      onBeforeSignOut?.();

      // Sign out from Clerk
      await signOut();
      console.log('[SignOut] Clerk session cleared');

      // Ensure navigation stack goes to auth
      router.replace('/(auth)');
      console.log('[SignOut] Redirected to /(auth)');
    } catch (err) {
      console.error('[SignOut] Error during sign out', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (!confirm) {
      doSignOut();
      return;
    }
    Alert.alert(
      'Keluar',
      'Apakah anda yakin ingin keluar?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: doSignOut },
      ],
      { cancelable: true }
    );
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[variant === 'drawer' ? styles.drawerButton : styles.inlineButton, containerStyle]}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Keluar"
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          {variant === 'drawer' && (
            <Ionicons name="log-out-outline" size={22} color={colors.white} style={{ marginRight: 12 }} />
          )}
          <Text style={styles.text}>Keluar</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  drawerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  inlineButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 15,
    color: colors.white,
    fontWeight: '600',
  },
});
