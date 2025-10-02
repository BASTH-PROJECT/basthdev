import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { DatabaseService } from '@/services/database';
import { useUser } from '@/contexts/UserContext';

export interface DirtyCount {
  books: number;
  transactions: number;
  total: number;
}

export const useDirtyCount = () => {
  const { user, isLoading: userLoading } = useUser();
  const [dirtyCount, setDirtyCount] = useState<DirtyCount>({
    books: 0,
    transactions: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const refreshDirtyCount = async () => {
    // Wait for user context to finish loading before querying database
    if (!user || userLoading) {
      setDirtyCount({ books: 0, transactions: 0, total: 0 });
      return;
    }

    setIsLoading(true);
    try {
      // Ensure database is opened before querying
      await DatabaseService.getInstance().openUserDB(user.id);
      
      const [dirtyBooks, dirtyTransactions] = await Promise.all([
        DatabaseService.getInstance().getDirtyBooks(user.id),
        DatabaseService.getInstance().getDirtyTransactions(user.id),
      ]);

      const booksCount = dirtyBooks.length;
      const transactionsCount = dirtyTransactions.length;
      const total = booksCount + transactionsCount;

      setDirtyCount({
        books: booksCount,
        transactions: transactionsCount,
        total,
      });

      console.log('[DirtyCount] Updated:', { books: booksCount, transactions: transactionsCount, total });
    } catch (error) {
      console.error('[DirtyCount] Error fetching dirty count:', error);
      // Don't reset to 0 on error, keep previous value
      // setDirtyCount({ books: 0, transactions: 0, total: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh count when user changes and is ready
  useEffect(() => {
    if (!userLoading) {
      refreshDirtyCount();
    }
  }, [user, userLoading]);

  // Auto-refresh every 30 seconds to catch any missed updates
  useEffect(() => {
    if (!userLoading) {
      const interval = setInterval(refreshDirtyCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, userLoading]);

  // Listen for manual dirty count update triggers
  useEffect(() => {
    const handleDirtyCountUpdate = () => {
      if (!userLoading) {
        refreshDirtyCount();
      }
    };

    const subscription = DeviceEventEmitter.addListener('dirtyCountUpdate', handleDirtyCountUpdate);
    
    return () => {
      subscription.remove();
    };
  }, [user, userLoading]);

  return {
    dirtyCount,
    isLoading,
    refreshDirtyCount,
  };
};
