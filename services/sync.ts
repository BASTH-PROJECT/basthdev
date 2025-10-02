import { Book, DatabaseService, Transaction } from "./database";
import { SupabaseClient } from '@supabase/supabase-js';

// UUID generator for sync operations
function generateSyncId(localId: number): string {
  // Generate a proper UUID v4 format
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const hex = '0123456789abcdef';
  let uuid = '';

  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // UUID version 4
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8]; // UUID variant (8, 9, A, or B)
    } else {
      uuid += hex[Math.floor(Math.random() * 16)];
    }
  }

  return uuid;
}

// Extended types for sync operations
export interface SyncBook extends Book {
  updated_at?: string;
  synced?: number;
  sync_id?: string;
  last_synced?: string;
  deleted?: number;
}

export interface SyncTransaction extends Transaction {
  updated_at?: string;
  sync_id?: string;
  last_synced?: string;
  synced?: number;
  deleted?: number;
}

// --- Remote Supabase schema ---
// This schema matches the SQL schema for Clerk authentication
export interface Database {
  public: {
    Tables: {
      books: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
          deleted: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: {
          name?: string;
          updated_at?: string;
          deleted?: boolean;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          type: 'income' | 'expense';
          amount: number;
          note: string | null;
          category: string | null;
          created_at: string;
          updated_at: string;
          deleted: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          type: 'income' | 'expense';
          amount: number;
          note?: string | null;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: {
          book_id?: string;
          type?: 'income' | 'expense';
          amount?: number;
          note?: string | null;
          category?: string | null;
          updated_at?: string;
          deleted?: boolean;
        };
      };
      user_metadata: {
        Row: {
          user_id: string;
          initialized: boolean;
          last_sync: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          initialized?: boolean;
          last_sync?: string;
          created_at?: string;
        };
        Update: {
          initialized?: boolean;
          last_sync?: string;
        };
      };
    };
  };
}

// Type for the Supabase client with our database schema
export type Supabase = SupabaseClient<Database>;

// Conflict resolution types
export interface Conflict {
  type: 'book' | 'transaction';
  localId: number;
  remoteId: string;
  localData: any;
  remoteData: any;
  localUpdated: string;
  remoteUpdated: string;
}

export interface PullResult {
  hasNewData: boolean;
  booksCount: number;
  transactionsCount: number;
  conflicts: Conflict[];
}

// --- Sync + CRUD Service ---
export class SyncService {
  private db = DatabaseService.getInstance();
  
  /**
   * Sync all data for a user
   * @param userId The ID of the user to sync data for
   * @param supabase Authenticated Supabase client
   */
  async syncAll(userId: string, supabase: SupabaseClient<Database>): Promise<void> {
    console.log('[SYNC-SERVICE] syncAll() called for user:', userId);
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    if (!supabase) {
      throw new Error('Supabase client is required');
    }
    
    try {
      console.log('[SYNC-SERVICE] Starting sync with Clerk JWT authentication');
      
      // Sync books first since transactions depend on them
      await this.syncBooks(userId, supabase);
      
      // Then sync transactions
      await this.syncTransactions(userId, supabase);
      
      console.log('[SYNC-SERVICE] syncAll() completed successfully');
    } catch (error) {
      console.error('[SYNC-SERVICE] Error in syncAll:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  /**
   * Sync books between local and remote
   */
  private async syncBooks(userId: string, supabase: SupabaseClient<Database>): Promise<void> {
    console.log('[SYNC-SERVICE] Starting books sync for user:', userId);
    
    try {
      // Ensure database is open and ready
      const db = await this.db.openUserDB(userId);
      
      // Add a delay to ensure migrations are complete and database is not locked
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get last sync timestamp from local storage
      console.log('[SYNC-SERVICE] Getting last sync timestamp for books');
      const lastSync = await this.db.getUserPreference(userId, "last_sync_books");
      console.log('[SYNC-SERVICE] Last books sync timestamp:', lastSync);

      // Fetch books updated since last sync
      console.log('[SYNC-SERVICE] Fetching updated books from server...');
      const { data: remoteBooks, error } = await supabase
        .from("books")
        .select("*")
        .eq("user_id", userId) // Use the Clerk user ID here
        .gt("updated_at", lastSync || "1970-01-01");

      if (error) {
        console.error('[SYNC-SERVICE] Error fetching remote books:', error);
        throw new Error(`Failed to fetch books: ${error.message}`);
      }

      console.log('[SYNC-SERVICE] Found', remoteBooks?.length || 0, 'remote books to sync');

      // Merge into local
      for (const r of (remoteBooks || []) as any[]) {
        try {
          console.log('[SYNC-SERVICE] Processing remote book:', r.id, r.name);

          // Check if we already have this book locally by sync_id
          const existingBySyncId = await db.getFirstAsync(
            "SELECT * FROM books WHERE sync_id = ?",
            [r.id]
          ) as SyncBook | null;

          if (existingBySyncId) {
            // Update existing record - just mark as synced
            console.log('[SYNC-SERVICE] Book already synced locally:', r.name);
            try {
              await db.runAsync(
                "UPDATE books SET name = ?, synced = 1 WHERE sync_id = ?",
                [r.name, r.id]
              );
            } catch (e) {
              console.error('[SYNC-SERVICE] Error updating book:', e);
            }
          } else {
            // Check if we have it by local mapping or create new
            const local = await db.getFirstAsync(
              "SELECT * FROM books WHERE id = ?",
              [r.local_id || -1]
            ) as SyncBook | null;

            if (!local) {
              console.log('[SYNC-SERVICE] Creating new local book:', r.name);
              try {
                await db.runAsync(
                  "INSERT OR REPLACE INTO books (name, created_at, synced, sync_id) VALUES (?, ?, 1, ?)",
                  [r.name, r.created_at, r.id]
                );
              } catch (e) {
                console.error('[SYNC-SERVICE] Error creating book:', e);
              }
            } else {
              console.log('[SYNC-SERVICE] Updating existing local book:', r.name);
              try {
                await db.runAsync(
                  "UPDATE books SET name = ?, synced = 1, sync_id = ? WHERE id = ?",
                  [r.name, r.id, local.id]
                );
              } catch (e) {
                console.error('[SYNC-SERVICE] Error updating book:', e);
              }
            }
          }
        } catch (error) {
          console.error(`[SYNC-SERVICE] Error processing book ${r.id}:`, error);
          // Continue with next book even if one fails
          continue;
        }
      }

      // Push local dirty (books without sync_id or not synced)
      console.log('[SYNC-SERVICE] Checking for unsynced local books');
      const unsynced = (await db.getAllAsync(
        "SELECT * FROM books WHERE synced = 0 OR sync_id IS NULL"
      )) as SyncBook[];
      console.log('[SYNC-SERVICE] Found', unsynced.length, 'unsynced local books');

      for (const b of unsynced) {
        try {
          // Check if this book already has a sync_id (already synced)
          if (b.sync_id) {
            console.log('[SYNC-SERVICE] Book already has sync_id, marking as synced:', b.name);
            try {
              await db.runAsync(
                "UPDATE books SET synced = 1 WHERE id = ?",
                [b.id]
              );
            } catch (updateError) {
              console.error('[SYNC-SERVICE] Error updating book sync status:', updateError);
            }
            continue;
          }

          console.log('[SYNC-SERVICE] Syncing local book to remote:', b.name);
          const syncId = generateSyncId(b.id);
          console.log('[SYNC-SERVICE] Generated sync ID:', syncId);

          // Get the current timestamp for the update
          const now = new Date().toISOString();
          
          // Check if book already exists on server
          const { data: existing } = await supabase
            .from("books")
            .select("id")
            .eq("user_id", userId)
            .eq("name", b.name)
            .maybeSingle();

          if (existing && (existing as any).id) {
            console.log('[SYNC-SERVICE] Book already exists on server, using existing ID');
            try {
              await db.runAsync(
                "UPDATE books SET synced = 1, sync_id = ? WHERE id = ?",
                [(existing as any).id, b.id]
              );
            } catch (updateError) {
              console.error('[SYNC-SERVICE] Error updating book sync status:', updateError);
            }
            continue;
          }
          
          const { data, error: pushErr } = await supabase
            .from("books")
            .insert({
              id: syncId,
              user_id: userId,
              name: b.name,
              created_at: b.created_at || now,
              updated_at: now,
            } as any)
            .select()
            .single();

          if (!pushErr && data) {
            console.log('[SYNC-SERVICE] Successfully synced book:', b.name);
            try {
              await db.runAsync(
                "UPDATE books SET synced = 1, sync_id = ? WHERE id = ?",
                [syncId, b.id]
              );
            } catch (updateError) {
              console.error('[SYNC-SERVICE] Error updating book sync status:', updateError);
            }
          } else {
            console.error('[SYNC-SERVICE] Failed to sync book:', b.name, pushErr);
          }
        } catch (error) {
          console.error(`[SYNC-SERVICE] Error syncing book ${b.id}:`, error);
          // Continue with next book even if one fails
          continue;
        }
      }

      // Update last sync timestamp
      await this.db.setUserPreference(
        userId,
        "last_sync_books",
        new Date().toISOString()
      );
      console.log('[SYNC-SERVICE] Books sync completed');
    } catch (error) {
      console.error('[SYNC-SERVICE] Error in syncBooks:', error);
      throw error;
    }
  }

  private async syncTransactions(userId: string, supabase: SupabaseClient<Database>) {
    console.log('[SYNC-SERVICE] Starting transactions sync for user:', userId);
    
    // Ensure database is open and ready
    const db = await this.db.openUserDB(userId);
    
    // Add a delay to ensure any pending operations are complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Pull from Supabase
    console.log('[SYNC-SERVICE] Getting last sync timestamp for transactions');
    const lastSync = await this.db.getUserPreference(
      userId,
      "last_sync_transactions"
    );
    console.log('[SYNC-SERVICE] Last transactions sync timestamp:', lastSync);

    const { data: remoteTx, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId) // Use the Clerk user ID here
      .gt("updated_at", lastSync || "1970-01-01");

    if (error) {
      console.error('[SYNC-SERVICE] Error fetching remote transactions:', error);
      throw error;
    }

    console.log('[SYNC-SERVICE] Found', remoteTx?.length || 0, 'remote transactions to sync');

    for (const r of (remoteTx || []) as any[]) {
      console.log('[SYNC-SERVICE] Processing remote transaction:', r.id, r.type, r.amount);

      // Check if we already have this transaction locally by sync_id
      const existingBySyncId = await db.getFirstAsync(
        "SELECT * FROM transactions WHERE sync_id = ?",
        [r.id]
      ) as SyncTransaction | null;

      if (existingBySyncId) {
        // Update existing record
        if (new Date(r.updated_at) > new Date(existingBySyncId.updated_at || existingBySyncId.created_at)) {
          console.log('[SYNC-SERVICE] Updating existing local transaction by sync_id');
          await db.runAsync(
            `UPDATE transactions SET
              book_id = ?, type = ?, amount = ?, note = ?, category = ?, updated_at = ?, synced = 1
              WHERE sync_id = ?`,
            [r.book_id, r.type, r.amount, r.note, r.category, r.updated_at, r.id]
          );
        }
      } else {
        // Check if we have it by local mapping or create new
        const local = await db.getFirstAsync(
          "SELECT * FROM transactions WHERE id = ?",
          [r.local_id || -1]
        ) as SyncTransaction | null;

        if (!local) {
          console.log('[SYNC-SERVICE] Creating new local transaction');
          await db.runAsync(
            `INSERT OR REPLACE INTO transactions
              (book_id, type, amount, note, category, created_at, updated_at, synced, sync_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [r.book_id, r.type, r.amount, r.note, r.category, r.created_at, r.updated_at, r.id]
          );
        } else if (new Date(r.updated_at) > new Date(local.updated_at || local.created_at)) {
          console.log('[SYNC-SERVICE] Updating existing local transaction');
          await db.runAsync(
            `UPDATE transactions SET
              book_id = ?, type = ?, amount = ?, note = ?, category = ?, updated_at = ?, synced = 1, sync_id = ?
              WHERE id = ?`,
            [r.book_id, r.type, r.amount, r.note, r.category, r.updated_at, r.id, local.id]
          );
        }
      }
    }

    // Push local dirty
    console.log('[SYNC-SERVICE] Checking for unsynced local transactions');
    const unsynced = (await db.getAllAsync(
      `SELECT t.*, b.sync_id as book_sync_id 
       FROM transactions t 
       LEFT JOIN books b ON t.book_id = b.id 
       WHERE t.synced = 0`
    )) as (SyncTransaction & { book_sync_id?: string })[];
    
    console.log('[SYNC-SERVICE] Found', unsynced.length, 'unsynced local transactions');

    for (const t of unsynced) {
      try {
        console.log('[SYNC-SERVICE] Syncing local transaction to remote:', t.type, t.amount);
        
        // CRITICAL: Get the book's sync_id - the book MUST be synced first
        if (!t.book_sync_id) {
          console.error('[SYNC-SERVICE] Cannot sync transaction - book not synced yet. Book ID:', t.book_id);
          console.error('[SYNC-SERVICE] Skipping transaction. Please sync books first.');
          continue; // Skip this transaction
        }
        
        const syncId = generateSyncId(t.id);
        console.log('[SYNC-SERVICE] Generated transaction sync ID:', syncId);
        console.log('[SYNC-SERVICE] Using book sync ID:', t.book_sync_id);

        // Get the current timestamp for the update
        const now = new Date().toISOString();

        const { data, error: pushErr } = await supabase
          .from("transactions")
          .upsert({
            id: syncId,
            user_id: userId, // Use the Clerk user ID
            book_id: t.book_sync_id, // Use the book's sync ID (must exist!)
            type: t.type,
            amount: t.amount,
            note: t.note,
            category: t.category,
            created_at: t.created_at || now,
            updated_at: now, // Always use current time for updates
          } as any)
          .select()
          .single();

        if (!pushErr && data) {
          console.log('[SYNC-SERVICE] Successfully synced transaction');
          // Use a safer update that handles missing columns
          try {
            await db.runAsync(
              "UPDATE transactions SET synced = 1, sync_id = ? WHERE id = ?",
              [syncId, t.id]
            );
          } catch (updateError) {
            console.error('[SYNC-SERVICE] Error updating transaction sync status:', updateError);
          }
        } else {
          console.error('[SYNC-SERVICE] Failed to sync transaction:', pushErr);
        }
      } catch (error) {
        console.error(`[SYNC-SERVICE] Error syncing transaction ${t.id}:`, error);
        // Continue with next transaction even if one fails
        continue;
      }
    }

    await this.db.setUserPreference(
      userId,
      "last_sync_transactions",
      new Date().toISOString()
    );
    console.log('[SYNC-SERVICE] Transactions sync completed');
  }

  // -------------------------------
  // CRUD HELPERS
  // -------------------------------
  async addBook(userId: string, name: string) {
    const db = await this.db.openUserDB(userId);
    const now = new Date().toISOString();
    await db.runAsync(
      "INSERT INTO books (name, created_at, updated_at, synced) VALUES (?, ?, ?, 0)",
      [name, now, now]
    );
  }

  async updateBook(userId: string, id: number, name: string) {
    const db = await this.db.openUserDB(userId);
    const now = new Date().toISOString();
    await db.runAsync(
      "UPDATE books SET name = ?, updated_at = ?, synced = 0 WHERE id = ?",
      [name, now, id]
    );
  }

  async deleteBook(userId: string, id: number) {
    const db = await this.db.openUserDB(userId);
    await db.runAsync("DELETE FROM books WHERE id = ?", [id]);
  }

  async addTransaction(
    userId: string,
    bookId: number,
    type: string,
    amount: number,
    note: string,
    category: string
  ) {
    const db = await this.db.openUserDB(userId);
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO transactions (book_id, type, amount, note, category, created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [bookId, type, amount, note, category, now, now]
    );
  }

  async updateTransaction(
    userId: string,
    id: number,
    fields: Partial<Omit<SyncTransaction, "id">>
  ) {
    const db = await this.db.openUserDB(userId);
    const now = new Date().toISOString();
    const { type, amount, note, category } = fields;
    await db.runAsync(
      `UPDATE transactions SET
        type = COALESCE(?, type),
        amount = COALESCE(?, amount),
        note = COALESCE(?, note),
        category = COALESCE(?, category),
        updated_at = ?,
        synced = 0
      WHERE id = ?`,
      [type || '', amount || 0, note || '', category || '', now, id]
    );
  }

  async deleteTransaction(userId: string, id: number) {
    const db = await this.db.openUserDB(userId);
    await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);
  }

  /**
   * Debug: Reset sync status for all books (forces re-sync)
   */
  async resetBookSyncStatus(userId: string) {
    const db = await this.db.openUserDB(userId);
    await db.runAsync("UPDATE books SET synced = 0, sync_id = NULL");
    console.log('[SYNC-SERVICE] Reset all books sync status');
  }

  /**
   * Debug: Reset sync status for all transactions (forces re-sync)
   */
  async resetTransactionSyncStatus(userId: string) {
    const db = await this.db.openUserDB(userId);
    await db.runAsync("UPDATE transactions SET synced = 0, sync_id = NULL");
    console.log('[SYNC-SERVICE] Reset all transactions sync status');
  }

  /**
   * Pull latest data from server
   * Returns information about new data and conflicts
   */
  async pullFromServer(userId: string, supabase: SupabaseClient<Database>): Promise<PullResult> {
    console.log('[PULL] Starting pull from server for user:', userId);
    
    const db = await this.db.openUserDB(userId);
    const conflicts: Conflict[] = [];
    let booksCount = 0;
    let transactionsCount = 0;

    try {
      // Get last sync timestamps
      const lastBookSync = await this.db.getUserPreference(userId, "last_sync_books") || "1970-01-01";
      const lastTransactionSync = await this.db.getUserPreference(userId, "last_sync_transactions") || "1970-01-01";

      // Pull books from server
      console.log('[PULL] Fetching books updated after:', lastBookSync);
      const { data: remoteBooks, error: booksError } = await supabase
        .from("books")
        .select("*")
        .eq("user_id", userId)
        .gt("updated_at", lastBookSync);

      if (booksError) throw booksError;

      booksCount = remoteBooks?.length || 0;
      console.log('[PULL] Found', booksCount, 'new/updated books from server');

      // Merge books and detect conflicts
      for (const remoteBook of (remoteBooks || []) as any[]) {
        const localBook = await db.getFirstAsync(
          "SELECT * FROM books WHERE sync_id = ?",
          [remoteBook.id]
        ) as SyncBook | null;

        if (localBook) {
          // Check for conflict
          const localUpdated = localBook.updated_at || localBook.created_at;
          const remoteUpdated = remoteBook.updated_at;
          
          if (localUpdated && new Date(localUpdated) > new Date(remoteUpdated)) {
            console.log('[PULL] Conflict detected for book:', remoteBook.name);
            conflicts.push({
              type: 'book',
              localId: localBook.id,
              remoteId: remoteBook.id,
              localData: localBook,
              remoteData: remoteBook,
              localUpdated,
              remoteUpdated,
            });
          } else {
            // Server is newer or same - update local
            await db.runAsync(
              "UPDATE books SET name = ?, updated_at = ?, synced = 1 WHERE id = ?",
              [remoteBook.name, remoteBook.updated_at, localBook.id]
            );
          }
        } else {
          // New book from server - create locally
          await db.runAsync(
            "INSERT OR REPLACE INTO books (name, created_at, updated_at, synced, sync_id) VALUES (?, ?, ?, 1, ?)",
            [remoteBook.name, remoteBook.created_at, remoteBook.updated_at, remoteBook.id]
          );
        }
      }

      // Pull transactions from server
      console.log('[PULL] Fetching transactions updated after:', lastTransactionSync);
      const { data: remoteTransactions, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gt("updated_at", lastTransactionSync);

      if (transactionsError) throw transactionsError;

      transactionsCount = remoteTransactions?.length || 0;
      console.log('[PULL] Found', transactionsCount, 'new/updated transactions from server');

      // Merge transactions and detect conflicts
      for (const remoteTx of (remoteTransactions || []) as any[]) {
        const localTx = await db.getFirstAsync(
          "SELECT * FROM transactions WHERE sync_id = ?",
          [remoteTx.id]
        ) as SyncTransaction | null;

        if (localTx) {
          // Check for conflict
          const localUpdated = localTx.updated_at || localTx.created_at;
          const remoteUpdated = remoteTx.updated_at;
          
          if (localUpdated && new Date(localUpdated) > new Date(remoteUpdated)) {
            console.log('[PULL] Conflict detected for transaction:', remoteTx.id);
            conflicts.push({
              type: 'transaction',
              localId: localTx.id,
              remoteId: remoteTx.id,
              localData: localTx,
              remoteData: remoteTx,
              localUpdated,
              remoteUpdated,
            });
          } else {
            // Server is newer or same - update local
            await db.runAsync(
              `UPDATE transactions SET 
                book_id = ?, type = ?, amount = ?, note = ?, category = ?, 
                updated_at = ?, synced = 1 
              WHERE id = ?`,
              [remoteTx.book_id, remoteTx.type, remoteTx.amount, remoteTx.note, 
               remoteTx.category, remoteTx.updated_at, localTx.id]
            );
          }
        } else {
          // New transaction from server - create locally
          // First, find the local book_id for this remote book_id
          const book = await db.getFirstAsync(
            "SELECT id FROM books WHERE sync_id = ?",
            [remoteTx.book_id]
          ) as { id: number } | null;

          if (book) {
            await db.runAsync(
              `INSERT OR REPLACE INTO transactions 
                (book_id, type, amount, note, category, created_at, updated_at, synced, sync_id) 
              VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
              [book.id, remoteTx.type, remoteTx.amount, remoteTx.note, remoteTx.category,
               remoteTx.created_at, remoteTx.updated_at, remoteTx.id]
            );
          }
        }
      }

      const hasNewData = booksCount > 0 || transactionsCount > 0;
      console.log('[PULL] Pull completed:', { hasNewData, booksCount, transactionsCount, conflictsCount: conflicts.length });

      // Trigger UI refresh if we pulled new data
      if (hasNewData) {
        console.log('[PULL] Triggering UI refresh for pulled data');
        const { DeviceEventEmitter } = require('react-native');
        DeviceEventEmitter.emit('booksUpdated');
        DeviceEventEmitter.emit('transactionsUpdated');
      }

      return {
        hasNewData,
        booksCount,
        transactionsCount,
        conflicts,
      };
    } catch (error) {
      console.error('[PULL] Error pulling from server:', error);
      throw error;
    }
  }

  /**
   * Resolve conflicts using server-wins strategy
   * Can be customized for different strategies
   */
  async resolveConflicts(userId: string, conflicts: Conflict[]): Promise<void> {
    console.log('[CONFLICT] Resolving', conflicts.length, 'conflicts');
    
    const db = await this.db.openUserDB(userId);

    for (const conflict of conflicts) {
      console.log('[CONFLICT] Resolving', conflict.type, 'conflict - Server wins strategy');
      
      if (conflict.type === 'book') {
        // Server wins - update local with remote data
        await db.runAsync(
          "UPDATE books SET name = ?, updated_at = ?, synced = 1 WHERE id = ?",
          [conflict.remoteData.name, conflict.remoteData.updated_at, conflict.localId]
        );
      } else if (conflict.type === 'transaction') {
        // Server wins - update local with remote data
        await db.runAsync(
          `UPDATE transactions SET 
            type = ?, amount = ?, note = ?, category = ?, 
            updated_at = ?, synced = 1 
          WHERE id = ?`,
          [conflict.remoteData.type, conflict.remoteData.amount, conflict.remoteData.note,
           conflict.remoteData.category, conflict.remoteData.updated_at, conflict.localId]
        );
      }
    }

    console.log('[CONFLICT] All conflicts resolved');
    
    // Trigger UI refresh after resolving conflicts
    if (conflicts.length > 0) {
      console.log('[CONFLICT] Triggering UI refresh after conflict resolution');
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('booksUpdated');
      DeviceEventEmitter.emit('transactionsUpdated');
    }
  }

  /**
   * Push local changes to server
   */
  async pushToServer(userId: string, supabase: SupabaseClient<Database>): Promise<void> {
    console.log('[PUSH] Starting push to server for user:', userId);
    
    const db = await this.db.openUserDB(userId);

    // Push books
    const unsyncedBooks = (await db.getAllAsync(
      "SELECT * FROM books WHERE synced = 0 OR sync_id IS NULL"
    )) as SyncBook[];
    
    console.log('[PUSH] Found', unsyncedBooks.length, 'unsynced books');

    for (const book of unsyncedBooks) {
      try {
        const now = new Date().toISOString();
        console.log('[PUSH] Processing book:', { id: book.id, name: book.name, sync_id: book.sync_id, synced: (book as any).synced });

        if (book.sync_id) {
          // Already synced before - UPDATE on server using upsert
          const isDeleted = (book as SyncBook).deleted === 1;
          console.log('[PUSH] Updating existing book on server:', book.name, 'with sync_id:', book.sync_id, 'deleted:', isDeleted);
          
          const { error, data } = await supabase
            .from("books")
            .upsert({
              id: book.sync_id,
              user_id: userId,
              name: book.name,
              created_at: book.created_at || now,
              updated_at: now,
              deleted: isDeleted, // Sync deleted status
            } as any)
            .select();

          console.log('[PUSH] Upsert result:', { error, data });

          if (!error) {
            await db.runAsync("UPDATE books SET synced = 1, updated_at = ? WHERE id = ?", [now, book.id]);
            console.log('[PUSH] Successfully updated book:', book.name, 'deleted:', isDeleted);
          } else {
            console.error('[PUSH] Failed to update book:', error);
          }
          continue;
        }

        // New book - generate sync_id
        const syncId = generateSyncId(book.id);
        console.log('[PUSH] Generated new sync_id for book:', syncId);

        // Check if already exists by name (duplicate prevention)
        const { data: existing } = await supabase
          .from("books")
          .select("id")
          .eq("user_id", userId)
          .eq("name", book.name)
          .maybeSingle();

        if (existing) {
          console.log('[PUSH] Book already exists on server with id:', (existing as any).id);
          await db.runAsync(
            "UPDATE books SET synced = 1, sync_id = ? WHERE id = ?",
            [(existing as any).id, book.id]
          );
          continue;
        }

        // Insert new book
        const isDeleted = (book as SyncBook).deleted === 1;
        console.log('[PUSH] Inserting new book:', book.name, 'deleted:', isDeleted);
        const { error, data } = await supabase
          .from("books")
          .insert({
            id: syncId,
            user_id: userId,
            name: book.name,
            created_at: book.created_at || now,
            updated_at: now,
            deleted: isDeleted, // Include deleted status
          } as any)
          .select();

        console.log('[PUSH] Insert result:', { error, data });

        if (!error) {
          await db.runAsync(
            "UPDATE books SET synced = 1, sync_id = ? WHERE id = ?",
            [syncId, book.id]
          );
          console.log('[PUSH] Successfully inserted book:', book.name);
        } else {
          console.error('[PUSH] Failed to insert book:', error);
        }
      } catch (bookError) {
        console.error('[PUSH] Error processing book:', bookError);
        // Continue with next book
      }
    }

    // Push transactions
    const unsyncedTransactions = (await db.getAllAsync(
      `SELECT t.*, b.sync_id as book_sync_id 
       FROM transactions t 
       LEFT JOIN books b ON t.book_id = b.id 
       WHERE t.synced = 0 OR t.sync_id IS NULL`
    )) as (SyncTransaction & { book_sync_id?: string })[];
    
    console.log('[PUSH] Found', unsyncedTransactions.length, 'unsynced transactions');
    
    if (unsyncedTransactions.length > 0) {
      console.log('[PUSH] Transaction details:', unsyncedTransactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        synced: t.synced,
        sync_id: t.sync_id,
        book_sync_id: t.book_sync_id
      })));
    }

    for (const tx of unsyncedTransactions) {
      if (!tx.book_sync_id) {
        console.error('[PUSH] Cannot sync transaction - book not synced yet. Transaction ID:', tx.id);
        continue;
      }

      const now = new Date().toISOString();

      // Check if already has sync_id (existing item being updated)
      if (tx.sync_id) {
        const isDeleted = (tx as SyncTransaction).deleted === 1;
        console.log('[PUSH] Updating existing transaction on server:', { id: tx.id, type: tx.type, amount: tx.amount, deleted: isDeleted });
        
        const { error } = await supabase
          .from("transactions")
          .upsert({
            id: tx.sync_id,
            user_id: userId,
            book_id: tx.book_sync_id,
            type: tx.type,
            amount: tx.amount,
            note: tx.note,
            category: tx.category,
            created_at: tx.created_at || now,
            updated_at: now,
            deleted: isDeleted, // Sync deleted status
          } as any)
          .eq("id", tx.sync_id);

        if (!error) {
          console.log('[PUSH] Successfully updated transaction:', tx.id);
          await db.runAsync(
            "UPDATE transactions SET synced = 1, updated_at = ? WHERE id = ?",
            [now, tx.id]
          );
        } else {
          console.error('[PUSH] Failed to update transaction:', error);
        }
        continue;
      }

      // New transaction - generate sync_id and insert
      const syncId = generateSyncId(tx.id);
      const isDeleted = (tx as SyncTransaction).deleted === 1;
      console.log('[PUSH] Inserting new transaction:', { id: tx.id, type: tx.type, amount: tx.amount, syncId, deleted: isDeleted });

      const { error } = await supabase
        .from("transactions")
        .insert({
          id: syncId,
          user_id: userId,
          book_id: tx.book_sync_id,
          type: tx.type,
          amount: tx.amount,
          note: tx.note,
          category: tx.category,
          created_at: tx.created_at || now,
          updated_at: now,
          deleted: isDeleted, // Include deleted status
        } as any);

      if (!error) {
        console.log('[PUSH] Successfully inserted transaction:', tx.id);
        await db.runAsync(
          "UPDATE transactions SET synced = 1, sync_id = ? WHERE id = ?",
          [syncId, tx.id]
        );
      } else {
        console.error('[PUSH] Failed to insert transaction:', error);
      }
    }

    // Update last sync timestamps
    await this.db.setUserPreference(userId, "last_sync_books", new Date().toISOString());
    await this.db.setUserPreference(userId, "last_sync_transactions", new Date().toISOString());

    console.log('[PUSH] Push completed');
  }
}
