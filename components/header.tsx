import { screenMeta } from '@/components/navigation/screens.meta';
import { useScreen } from '@/contexts/ScreenContext';
import { useSync } from '@/contexts/SyncContext';
import { useDirtyCount } from '@/hooks/useDirtyCount';
import { SyncService } from '@/services/sync';
import { colors } from '@/styles/colors';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Header() {
  const { setDrawerOpen, isDrawerOpen, currentScreen } = useScreen();
  const { dirtyCount } = useDirtyCount();
  const { syncAll, isSyncing, syncPhase, lastSyncError, clearSyncError, hasPendingPulls } = useSync();
  const { user } = useUser();

  const meta = screenMeta.find(s => s.key === currentScreen);
  const title = meta?.label ?? 'ONI cashApp';

  // Get sync status text based on phase
  const getSyncStatusText = () => {
    switch (syncPhase) {
      case 'pulling':
        return 'Pulling...';
      case 'resolving':
        return 'Resolving...';
      case 'syncing':
        return 'Syncing...';
      case 'completed':
        return 'Synced!';
      default:
        return isSyncing ? 'Syncing...' : '';
    }
  };

  const handleSync = async () => {
    if (isSyncing) {
      console.log('[HEADER] Sync already in progress, ignoring duplicate request');
      return; // Already syncing
    }

    if (lastSyncError) {
      console.log('[HEADER] Clearing previous sync error:', lastSyncError);
      clearSyncError();
    }

    console.log('[HEADER] Starting sync...');
    console.log('[HEADER] Current dirty count:', dirtyCount);

    try {
      // New simplified API - everything handled automatically!
      await syncAll();
      console.log('[HEADER] Sync completed successfully');
    } catch (error) {
      console.error('[HEADER] Sync failed with error:', error);
      Alert.alert('Sync Error', 'Failed to sync data. Please try again.');
    }
  };

  const handleResetSync = async () => {
    if (!user?.id) return;
    
    Alert.alert(
      'Reset Sync Status',
      'This will reset all sync status and force a complete re-sync. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const syncService = new SyncService();
              await syncService.resetBookSyncStatus(user.id);
              await syncService.resetTransactionSyncStatus(user.id);
              Alert.alert('Success', 'Sync status reset. Tap sync button to re-sync.');
            } catch (error) {
              console.error('[HEADER] Reset failed:', error);
              Alert.alert('Error', 'Failed to reset sync status');
            }
          },
        },
      ]
    );
  };

  const getSyncIcon = () => {
    if (syncPhase === 'pulling') {
      return 'cloud-download-outline'; // Download icon when pulling
    }
    if (syncPhase === 'resolving') {
      return 'git-merge-outline'; // Merge icon when resolving
    }
    if (syncPhase === 'syncing' || isSyncing) {
      return 'sync-outline'; // Sync icon when pushing
    }
    if (syncPhase === 'completed') {
      return 'checkmark-circle'; // Success icon
    }
    if (lastSyncError) {
      return 'alert-circle'; // Error icon
    }
    if (hasPendingPulls) {
      return 'cloud-download'; // Has data to pull
    }
    if (dirtyCount.total > 0) {
      return 'cloud-upload-outline'; // Upload icon when there are unsynced items
    }
    return 'sync-outline'; // Default cloud icon
  };

  const getSyncColor = () => {
    if (syncPhase === 'pulling') {
      return '#3B82F6'; // Blue when pulling
    }
    if (syncPhase === 'resolving') {
      return '#F59E0B'; // Orange when resolving
    }
    if (syncPhase === 'syncing' || isSyncing) {
      return colors.brand; // Brand color when syncing
    }
    if (syncPhase === 'completed') {
      return colors.income; // Green when completed
    }
    if (lastSyncError) {
      return colors.danger; // Red when error
    }
    if (hasPendingPulls) {
      return '#3B82F6'; // Blue when has data to pull
    }
    if (dirtyCount.total > 0) {
      return colors.expense; // Red when unsynced items
    }
    return colors.income; // Green when synced
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => setDrawerOpen(!isDrawerOpen)}
        style={styles.menuButton}
        activeOpacity={0.7}
      >
        <Image
          source={require('@/assets/images/menus.png')}
          style={styles.menuButton}
        />
      </TouchableOpacity>

      <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>

      {/* Unified Sync Button */}
      <TouchableOpacity
        onPress={handleSync}
        onLongPress={handleResetSync}
        style={[
          styles.syncButton,
          isSyncing && styles.syncButtonActive,
          dirtyCount.total > 0 && !isSyncing && styles.syncButtonDirty,
          lastSyncError && styles.syncButtonError,
        ]}
        disabled={isSyncing}
        activeOpacity={0.7}
      >
        <View style={styles.syncContent}>
          {/* Icon */}
          <Ionicons
            name={getSyncIcon() as any}
            size={20}
            color={getSyncColor()}
          />
          
          {/* Status Text or Count */}
          {isSyncing || syncPhase !== 'idle' ? (
            <Text style={[styles.syncStatusText, { color: getSyncColor() }]}>
              {getSyncStatusText()}
            </Text>
          ) : dirtyCount.total > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{dirtyCount.total}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuButton: {
    width: 30,
    height: 30,
    borderRadius: 20,
    // backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'left',
    marginLeft: 12,
    flex: 1,
  },
  syncButton: {
    padding: 5,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    // minWidth: 60,
  },
  syncButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: colors.incomeBg,
  },
  syncButtonDirty: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: colors.expenseBg,
  },
  syncButtonError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: colors.danger,
  },
  syncContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});