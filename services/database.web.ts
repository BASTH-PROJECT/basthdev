import AsyncStorage from '@react-native-async-storage/async-storage';
import { Book, Transaction, TransactionSummary } from './database';

/**
 * Web-compatible database service using AsyncStorage
 * Mimics the SQLite DatabaseService API for cross-platform compatibility
 */
export class WebDatabaseService {
  private static instance: WebDatabaseService;
  private activeUserId: string | null = null;

  private constructor() {}

  public static getInstance(): WebDatabaseService {
    if (!WebDatabaseService.instance) {
      WebDatabaseService.instance = new WebDatabaseService();
    }
    return WebDatabaseService.instance;
  }

  private getStorageKey(userId: string, type: 'books' | 'transactions' | 'preferences' | 'init'): string {
    return `@onicash_${userId}_${type}`;
  }

  async openUserDB(userId: string): Promise<void> {
    this.activeUserId = userId;
    // Initialize storage structure if needed
    await this.initializeStorage(userId);
  }

  async closeDatabase(): Promise<void> {
    this.activeUserId = null;
  }

  private async initializeStorage(userId: string): Promise<void> {
    // Check if user is initialized
    const initKey = this.getStorageKey(userId, 'init');
    const isInit = await AsyncStorage.getItem(initKey);
    
    if (!isInit) {
      // Initialize empty arrays for books and transactions
      await AsyncStorage.setItem(this.getStorageKey(userId, 'books'), JSON.stringify([]));
      await AsyncStorage.setItem(this.getStorageKey(userId, 'transactions'), JSON.stringify([]));
      await AsyncStorage.setItem(this.getStorageKey(userId, 'preferences'), JSON.stringify({}));
      await AsyncStorage.setItem(initKey, JSON.stringify({ initialized: true, date: new Date().toISOString() }));
    }
  }

  // Book CRUD operations
  async createBook(userId: string, name: string): Promise<Book> {
    await this.openUserDB(userId);
    const booksKey = this.getStorageKey(userId, 'books');
    const booksData = await AsyncStorage.getItem(booksKey);
    const books: Book[] = booksData ? JSON.parse(booksData) : [];
    
    const newBook: Book = {
      id: Date.now(), // Use timestamp as ID
      name,
      created_at: new Date().toISOString(),
      is_dirty: true,
    };
    
    books.push(newBook);
    await AsyncStorage.setItem(booksKey, JSON.stringify(books));
    
    return newBook;
  }

  async listBooks(userId: string): Promise<Book[]> {
    await this.openUserDB(userId);
    const booksKey = this.getStorageKey(userId, 'books');
    const booksData = await AsyncStorage.getItem(booksKey);
    const books: Book[] = booksData ? JSON.parse(booksData) : [];
    
    // Filter out deleted books
    return books.filter(book => !book.deleted);
  }

  async updateBook(userId: string, bookId: number, name: string): Promise<Book> {
    await this.openUserDB(userId);
    const booksKey = this.getStorageKey(userId, 'books');
    const booksData = await AsyncStorage.getItem(booksKey);
    const books: Book[] = booksData ? JSON.parse(booksData) : [];
    
    const bookIndex = books.findIndex(b => b.id === bookId);
    if (bookIndex === -1) {
      throw new Error('Book not found');
    }
    
    books[bookIndex] = {
      ...books[bookIndex],
      name,
      is_dirty: true,
    };
    
    await AsyncStorage.setItem(booksKey, JSON.stringify(books));
    return books[bookIndex];
  }

  async deleteBook(userId: string, bookId: number): Promise<void> {
    await this.openUserDB(userId);
    const booksKey = this.getStorageKey(userId, 'books');
    const transactionsKey = this.getStorageKey(userId, 'transactions');
    
    const booksData = await AsyncStorage.getItem(booksKey);
    const books: Book[] = booksData ? JSON.parse(booksData) : [];
    
    const transactionsData = await AsyncStorage.getItem(transactionsKey);
    const transactions: Transaction[] = transactionsData ? JSON.parse(transactionsData) : [];
    
    // Soft delete book
    const bookIndex = books.findIndex(b => b.id === bookId);
    if (bookIndex !== -1) {
      books[bookIndex] = { ...books[bookIndex], deleted: true };
    }
    
    // Soft delete all transactions for this book
    const updatedTransactions = transactions.map(tx => 
      tx.book_id === bookId ? { ...tx, deleted: true } : tx
    );
    
    await AsyncStorage.setItem(booksKey, JSON.stringify(books));
    await AsyncStorage.setItem(transactionsKey, JSON.stringify(updatedTransactions));
  }

  // Transaction CRUD operations
  async loadTransactions(userId: string, bookId: number): Promise<Transaction[]> {
    await this.openUserDB(userId);
    const transactionsKey = this.getStorageKey(userId, 'transactions');
    const transactionsData = await AsyncStorage.getItem(transactionsKey);
    const transactions: Transaction[] = transactionsData ? JSON.parse(transactionsData) : [];
    
    return transactions
      .filter(tx => tx.book_id === bookId && !tx.deleted)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async addTransaction(
    userId: string,
    bookId: number,
    type: 'income' | 'expense',
    amount: number,
    note: string = '',
    category: string
  ): Promise<Transaction> {
    await this.openUserDB(userId);
    const transactionsKey = this.getStorageKey(userId, 'transactions');
    const transactionsData = await AsyncStorage.getItem(transactionsKey);
    const transactions: Transaction[] = transactionsData ? JSON.parse(transactionsData) : [];
    
    const newTransaction: Transaction = {
      id: Date.now(),
      book_id: bookId,
      type,
      amount,
      note,
      category,
      created_at: new Date().toISOString(),
      is_dirty: true,
    };
    
    transactions.push(newTransaction);
    await AsyncStorage.setItem(transactionsKey, JSON.stringify(transactions));
    
    return newTransaction;
  }

  async updateTransaction(
    userId: string,
    transactionId: number,
    type: 'income' | 'expense',
    amount: number,
    note: string = '',
    category: string
  ): Promise<Transaction> {
    await this.openUserDB(userId);
    const transactionsKey = this.getStorageKey(userId, 'transactions');
    const transactionsData = await AsyncStorage.getItem(transactionsKey);
    const transactions: Transaction[] = transactionsData ? JSON.parse(transactionsData) : [];
    
    const txIndex = transactions.findIndex(tx => tx.id === transactionId);
    if (txIndex === -1) {
      throw new Error('Transaction not found');
    }
    
    transactions[txIndex] = {
      ...transactions[txIndex],
      type,
      amount,
      note,
      category,
      is_dirty: true,
    };
    
    await AsyncStorage.setItem(transactionsKey, JSON.stringify(transactions));
    return transactions[txIndex];
  }

  async deleteTransaction(userId: string, transactionId: number): Promise<void> {
    await this.openUserDB(userId);
    const transactionsKey = this.getStorageKey(userId, 'transactions');
    const transactionsData = await AsyncStorage.getItem(transactionsKey);
    const transactions: Transaction[] = transactionsData ? JSON.parse(transactionsData) : [];
    
    const txIndex = transactions.findIndex(tx => tx.id === transactionId);
    if (txIndex !== -1) {
      transactions[txIndex] = { ...transactions[txIndex], deleted: true };
      await AsyncStorage.setItem(transactionsKey, JSON.stringify(transactions));
    }
  }

  async getTransactionSummary(userId: string, bookId: number): Promise<TransactionSummary> {
    const transactions = await this.loadTransactions(userId, bookId);
    
    const income = transactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const expense = transactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    return {
      balance: income - expense,
      income,
      expense,
    };
  }

  async getTransactionCount(userId: string, bookId: number): Promise<number> {
    const transactions = await this.loadTransactions(userId, bookId);
    return transactions.length;
  }

  // User preferences operations
  async setUserPreference(userId: string, key: string, value: string): Promise<void> {
    await this.openUserDB(userId);
    const prefsKey = this.getStorageKey(userId, 'preferences');
    const prefsData = await AsyncStorage.getItem(prefsKey);
    const prefs = prefsData ? JSON.parse(prefsData) : {};
    
    prefs[key] = value;
    await AsyncStorage.setItem(prefsKey, JSON.stringify(prefs));
  }

  async getUserPreference(userId: string, key: string): Promise<string | null> {
    await this.openUserDB(userId);
    const prefsKey = this.getStorageKey(userId, 'preferences');
    const prefsData = await AsyncStorage.getItem(prefsKey);
    const prefs = prefsData ? JSON.parse(prefsData) : {};
    
    return prefs[key] || null;
  }

  async getSelectedBookId(userId: string): Promise<number | null> {
    const value = await this.getUserPreference(userId, 'selected_book_id');
    return value ? parseInt(value, 10) : null;
  }

  async setSelectedBookId(userId: string, bookId: number): Promise<void> {
    await this.setUserPreference(userId, 'selected_book_id', bookId.toString());
  }

  // User initialization
  async isUserInitialized(userId: string): Promise<boolean> {
    const initKey = this.getStorageKey(userId, 'init');
    const isInit = await AsyncStorage.getItem(initKey);
    return isInit !== null;
  }

  async getUserInitializationInfo(userId: string): Promise<{initialized: boolean, date?: string}> {
    const initKey = this.getStorageKey(userId, 'init');
    const initData = await AsyncStorage.getItem(initKey);
    
    if (!initData) {
      return { initialized: false };
    }
    
    const parsed = JSON.parse(initData);
    return {
      initialized: true,
      date: parsed.date,
    };
  }

  async markUserAsInitialized(userId: string): Promise<void> {
    const initKey = this.getStorageKey(userId, 'init');
    await AsyncStorage.setItem(initKey, JSON.stringify({ 
      initialized: true, 
      date: new Date().toISOString() 
    }));
  }

  async initializeDefaultBook(userId: string): Promise<Book | null> {
    const isInitialized = await this.isUserInitialized(userId);
    if (isInitialized) {
      const books = await this.listBooks(userId);
      return books.length > 0 ? books[0] : null;
    }

    const books = await this.listBooks(userId);
    let defaultBook: Book;
    
    if (books.length === 0) {
      defaultBook = await this.createBook(userId, 'Buku Utama');
    } else {
      defaultBook = books[0];
    }
    
    await this.markUserAsInitialized(userId);
    return defaultBook;
  }

  // Sync utility methods (stubs for compatibility)
  async markBookAsDirty(userId: string, bookId: number): Promise<void> {
    // Implementation similar to updateBook
  }

  async markTransactionAsDirty(userId: string, transactionId: number): Promise<void> {
    // Implementation similar to updateTransaction
  }

  async updateBookSyncStatus(userId: string, bookId: number, syncId: string, lastSynced?: string): Promise<void> {
    // Update book with sync info
  }

  async updateTransactionSyncStatus(userId: string, transactionId: number, syncId: string, lastSynced?: string): Promise<void> {
    // Update transaction with sync info
  }

  async getDirtyBooks(userId: string): Promise<Book[]> {
    const books = await this.listBooks(userId);
    return books.filter(book => book.is_dirty);
  }

  async getDirtyTransactions(userId: string): Promise<Transaction[]> {
    await this.openUserDB(userId);
    const transactionsKey = this.getStorageKey(userId, 'transactions');
    const transactionsData = await AsyncStorage.getItem(transactionsKey);
    const transactions: Transaction[] = transactionsData ? JSON.parse(transactionsData) : [];
    
    return transactions.filter(tx => tx.is_dirty && !tx.deleted);
  }

  async getUnsyncedBooks(userId: string): Promise<Book[]> {
    const books = await this.listBooks(userId);
    return books.filter(book => !book.sync_id);
  }

  async getUnsyncedTransactions(userId: string): Promise<Transaction[]> {
    await this.openUserDB(userId);
    const transactionsKey = this.getStorageKey(userId, 'transactions');
    const transactionsData = await AsyncStorage.getItem(transactionsKey);
    const transactions: Transaction[] = transactionsData ? JSON.parse(transactionsData) : [];
    
    return transactions.filter(tx => !tx.sync_id && !tx.deleted);
  }
}
