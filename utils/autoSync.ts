import { DatabaseService } from '@/services/database';

/**
 * Check if auto-sync is enabled for the user
 */
export async function isAutoSyncEnabled(userId: string): Promise<boolean> {
  try {
    const autoSyncPref = await DatabaseService.getInstance().getUserPreference(userId, 'auto_sync');
    return autoSyncPref === 'true';
  } catch (error) {
    console.error('[AUTO-SYNC] Error checking auto-sync preference:', error);
    return false; // Default to false if error
  }
}

/**
 * Trigger auto-sync if enabled
 * Emits an event that SyncContext will listen to
 */
export async function triggerAutoSync(userId: string): Promise<void> {
  const enabled = await isAutoSyncEnabled(userId);
  
  if (enabled) {
    console.log('[AUTO-SYNC] Auto-sync is enabled, triggering sync...');
    const { DeviceEventEmitter } = require('react-native');
    DeviceEventEmitter.emit('autoSyncTriggered');
  } else {
    console.log('[AUTO-SYNC] Auto-sync is disabled, skipping');
  }
}
