import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { SyncService } from '@/services/sync';
import { useSupabase } from './SupabaseContext';
import { useUser } from '@clerk/clerk-expo';

export type SyncPhase = 'idle' | 'pulling' | 'resolving' | 'syncing' | 'completed';

interface SyncContextType {
  triggerDirtyCountUpdate: () => void;
  syncAll: () => Promise<void>;
  isSyncing: boolean;
  syncPhase: SyncPhase;
  lastSyncError: string | null;
  clearSyncError: () => void;
  hasPendingPulls: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [hasPendingPulls, setHasPendingPulls] = useState(false);
  const [syncService] = useState(() => new SyncService());
  
  const { supabase, isReady, refreshToken } = useSupabase();
  const { user } = useUser();

  // This will be used to notify components that dirty count should be refreshed
  const triggerDirtyCountUpdate = () => {
    // Emit a React Native event that the useDirtyCount hook can listen to
    DeviceEventEmitter.emit('dirtyCountUpdate');
  };

  const syncAll = useCallback(async () => {
    if (isSyncing) {
      console.log('[SYNC] Sync already in progress, ignoring request');
      return; // Prevent multiple simultaneous syncs
    }

    if (!isReady || !supabase || !user?.id) {
      const error = new Error('Sync prerequisites not met: ' + 
        (!isReady ? 'not ready' : !supabase ? 'no supabase client' : 'no user ID'));
      console.error('[SYNC] Error:', error);
      setLastSyncError(error.message);
      throw error;
    }

    console.log('[SYNC] === STARTING SYNC PROCESS ===');
    console.log('[SYNC] User ID:', user.id);
    console.log('[SYNC] Supabase client ready:', isReady);

    setIsSyncing(true);
    setLastSyncError(null);
    setSyncPhase('pulling');

    try {
      // Refresh token before syncing to avoid JWT expiration
      console.log('[SYNC] Refreshing Clerk token before sync...');
      await refreshToken();
      
      // Phase 1: Pull from server (check for new data)
      console.log('[SYNC] Phase 1: Pulling latest data from server...');
      setSyncPhase('pulling');
      const pullResult = await syncService.pullFromServer(user.id, supabase);
      setHasPendingPulls(pullResult.hasNewData);
      
      if (pullResult.hasNewData) {
        console.log('[SYNC] Found new data from server:', pullResult);
        await new Promise(resolve => setTimeout(resolve, 500)); // Visual delay
      }
      
      // Phase 2: Resolve conflicts if any
      if (pullResult.conflicts && pullResult.conflicts.length > 0) {
        console.log('[SYNC] Phase 2: Resolving conflicts...');
        setSyncPhase('resolving');
        await syncService.resolveConflicts(user.id, pullResult.conflicts);
        await new Promise(resolve => setTimeout(resolve, 500)); // Visual delay
      }
      
      // Phase 3: Push local changes to server
      console.log('[SYNC] Phase 3: Syncing local changes to server...');
      setSyncPhase('syncing');
      await syncService.pushToServer(user.id, supabase);
      
      // Complete
      setSyncPhase('completed');
      await new Promise(resolve => setTimeout(resolve, 300)); // Show completed state
      
      console.log('[SYNC] === SYNC COMPLETED SUCCESSFULLY ===');
      triggerDirtyCountUpdate(); // Update the dirty count after successful sync
    } catch (error) {
      console.error('[SYNC] === SYNC FAILED ===');
      console.error('[SYNC] Error details:', error);
      console.error('[SYNC] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[SYNC] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      setLastSyncError(error instanceof Error ? error.message : 'Sync failed');
      setSyncPhase('idle');
      throw error; // Re-throw so the header can handle it
    } finally {
      console.log('[SYNC] Sync process finished, setting isSyncing to false');
      setIsSyncing(false);
      setSyncPhase('idle');
      setHasPendingPulls(false);
    }
  }, [isSyncing, syncService, isReady, supabase, user?.id, refreshToken]);

  const clearSyncError = useCallback(() => {
    setLastSyncError(null);
  }, []);

  // Listen for auto-sync triggers
  useEffect(() => {
    const handleAutoSync = () => {
      console.log('[SYNC] Auto-sync triggered');
      if (!isSyncing) {
        syncAll().catch(error => {
          console.error('[SYNC] Auto-sync failed:', error);
        });
      } else {
        console.log('[SYNC] Already syncing, skipping auto-sync');
      }
    };

    const subscription = DeviceEventEmitter.addListener('autoSyncTriggered', handleAutoSync);
    
    return () => {
      subscription.remove();
    };
  }, [isSyncing, syncAll]);

  const value: SyncContextType = {
    triggerDirtyCountUpdate,
    syncAll,
    isSyncing,
    syncPhase,
    lastSyncError,
    clearSyncError,
    hasPendingPulls,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
