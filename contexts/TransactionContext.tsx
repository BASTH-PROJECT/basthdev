import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { Transaction, TransactionSummary } from '../services/database';
import { db } from '../services/database.factory';
import { useBooks } from './BookContext';
import { useUser } from './UserContext';
import { triggerAutoSync } from '@/utils/autoSync';

interface TransactionContextType {
  transactions: Transaction[];
  summary: TransactionSummary;
  isLoading: boolean;
  addTransaction: (type: 'income' | 'expense', amount: number,category: string, note?: string) => Promise<void>;
  updateTransaction: (transactionId: number, type: 'income' | 'expense', amount: number, category: string, note?: string) => Promise<void>;
  deleteTransaction: (transactionId: number) => Promise<void>;
  refreshTransactions: () => Promise<void>;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

interface TransactionProviderProps {
  children: ReactNode;
}

export const TransactionProvider: React.FC<TransactionProviderProps> = ({ children }) => {
  const { user, isLoading: userLoading } = useUser();
  const { activeBook } = useBooks();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>({
    balance: 0,
    income: 0,
    expense: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const refreshTransactions = async () => {
    // Wait for user context to finish loading before querying database
    if (!user || !activeBook || userLoading) {
      setTransactions([]);
      setSummary({ balance: 0, income: 0, expense: 0 });
      return;
    }
    
    setIsLoading(true);
    try {
      const [transactionList, transactionSummary] = await Promise.all([
        db.loadTransactions(user.id, activeBook.id),
        db.getTransactionSummary(user.id, activeBook.id),
      ]);
      
      setTransactions(transactionList);
      setSummary(transactionSummary);
    } catch (error) {
      console.error('Error refreshing transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTransaction = async (
    type: 'income' | 'expense',
    amount: number,
    category: string,
    note: string = ''
  ) => {
    if (!user || !activeBook || userLoading) return;
    
    setIsLoading(true);
    try {
      const newTransaction = await db.addTransaction(
        user.id,
        activeBook.id,
        type,
        amount,
        note,
        category
      );
      
      setTransactions(prev => [newTransaction, ...prev]);
      
      // Update summary
      const newSummary = { ...summary };
      if (type === 'income') {
        newSummary.income += amount;
        newSummary.balance += amount;
      } else {
        newSummary.expense += amount;
        newSummary.balance -= amount;
      }
      setSummary(newSummary);
      
      // Trigger dirty count update
      DeviceEventEmitter.emit('dirtyCountUpdate');
      
      // Trigger auto-sync if enabled
      await triggerAutoSync(user.id);
    } catch (error) {
      console.error('Error adding transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTransaction = async (
    transactionId: number,
    type: 'income' | 'expense',
    amount: number,
    category: string,
    note: string = ''
  ) => {
    if (!user || userLoading) return;
    
    setIsLoading(true);
    try {
      const oldTransaction = transactions.find(t => t.id === transactionId);
      if (!oldTransaction) return;
      
      const updatedTransaction = await db.updateTransaction(
        user.id,
        transactionId,
        type,
        amount,
        note,
        category
      );
      
      // Update transactions list
      setTransactions(prev => prev.map(t => t.id === transactionId ? updatedTransaction : t));
      
      // Update summary - revert old transaction and apply new one
      const newSummary = { ...summary };
      
      // Revert old transaction
      if (oldTransaction.type === 'income') {
        newSummary.income -= oldTransaction.amount;
        newSummary.balance -= oldTransaction.amount;
      } else {
        newSummary.expense -= oldTransaction.amount;
        newSummary.balance += oldTransaction.amount;
      }
      
      // Apply new transaction
      if (type === 'income') {
        newSummary.income += amount;
        newSummary.balance += amount;
      } else {
        newSummary.expense += amount;
        newSummary.balance -= amount;
      }
      
      setSummary(newSummary);
      
      // Trigger dirty count update
      DeviceEventEmitter.emit('dirtyCountUpdate');
      
      // Trigger auto-sync if enabled
      await triggerAutoSync(user.id);
    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTransaction = async (transactionId: number) => {
    if (!user || userLoading) return;
    
    setIsLoading(true);
    try {
      const transactionToDelete = transactions.find(t => t.id === transactionId);
      if (!transactionToDelete) return;
      
      await db.deleteTransaction(user.id, transactionId);
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      
      // Update summary
      const newSummary = { ...summary };
      if (transactionToDelete.type === 'income') {
        newSummary.income -= transactionToDelete.amount;
        newSummary.balance -= transactionToDelete.amount;
      } else {
        newSummary.expense -= transactionToDelete.amount;
        newSummary.balance += transactionToDelete.amount;
      }
      setSummary(newSummary);
      
      // Trigger dirty count update
      DeviceEventEmitter.emit('dirtyCountUpdate');
      
      // Trigger auto-sync if enabled
      await triggerAutoSync(user.id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh transactions when active book changes and user is ready
  useEffect(() => {
    if (!userLoading) {
      refreshTransactions();
    }
  }, [user, activeBook, userLoading]);

  // Listen for sync updates
  useEffect(() => {
    const handleTransactionsUpdated = () => {
      console.log('[TRANSACTION-CONTEXT] Received transactionsUpdated event, refreshing...');
      refreshTransactions();
    };

    const subscription = DeviceEventEmitter.addListener('transactionsUpdated', handleTransactionsUpdated);
    
    return () => {
      subscription.remove();
    };
  }, [user, activeBook, userLoading]);

  const value: TransactionContextType = {
    transactions,
    summary,
    isLoading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refreshTransactions,
  };

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = (): TransactionContextType => {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error('useTransactions must be used within a TransactionProvider');
  }
  return context;
};
