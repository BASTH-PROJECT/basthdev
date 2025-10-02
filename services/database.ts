import * as SQLite from 'expo-sqlite';

export interface Book {
  id: number;
  name: string;
  created_at: string;
  sync_id?: string;
  last_synced?: string;
  is_dirty?: boolean;
  deleted?: boolean;
}

export interface Transaction {
  id: number;
  book_id: number;
  type: 'income' | 'expense';
  amount: number;
  note: string;
  category: string;
  created_at: string;
  sync_id?: string;
  last_synced?: string;
  is_dirty?: boolean;
  deleted?: boolean;
}

export interface TransactionSummary {
  balance: number;
  income: number;
  expense: number;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private static readonly CURRENT_DB_VERSION = 4; // Increment this when schema changes

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }
  private activeDB: SQLite.SQLiteDatabase | null = null;
  private activeUserId: string | null = null;
  // Simple async queue to serialize DB write operations
  private writeQueue: Promise<any> = Promise.resolve();
  // Serialize open() calls to avoid races with close()
  private openLock: Promise<any> = Promise.resolve();

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  private enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task);
    // ensure chain continues even if a task fails
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  async openUserDB(userId: string): Promise<SQLite.SQLiteDatabase> {
    // If the requested DB is already open, return it
    if (this.activeDB && this.activeUserId === userId) {
      return this.activeDB;
    }

    // Queue open/close to prevent races
    let opened: SQLite.SQLiteDatabase | null = null;
    this.openLock = this.openLock.then(async () => {
      // Re-check after waiting in queue
      if (this.activeDB && this.activeUserId === userId) {
        opened = this.activeDB;
        return;
      }
      if (this.activeDB && this.activeUserId !== userId) {
        await this.closeDatabase();
      }
      const dbName = `db_${userId}.db`;
      const db = await SQLite.openDatabaseAsync(dbName);
      this.activeDB = db;
      this.activeUserId = userId;
      // Enable FK, ignore if driver rejects
      try { await db.execAsync('PRAGMA foreign_keys = ON'); } catch (e) {
        console.log('[DB] failed to enable foreign_keys PRAGMA:', e);
      }
      // Initialize tables and run migrations (MUST succeed)
      try { 
        await this.initializeTables(db); 
        console.log('[DB] Database initialization completed successfully');
      } catch (e) {
        console.error('[DB] CRITICAL: initializeTables failed:', e);
        throw e; // Don't ignore migration failures
      }
      opened = db;
    });
    await this.openLock;
    // Fallback to whatever is active
    return opened ?? (this.activeDB as SQLite.SQLiteDatabase);
  }

  async closeDatabase(): Promise<void> {
    if (this.activeDB) {
      await this.activeDB.closeAsync();
      this.activeDB = null;
      this.activeUserId = null;
      console.log('Database closed.');
    }
  }

  private async initializeTables(db: SQLite.SQLiteDatabase): Promise<void> {
    console.log('[DB] Initializing database tables...');
    
    // Create db_version table first to track schema version
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS db_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Get current database version
    const versionRow = await db.getFirstAsync('SELECT version FROM db_version WHERE id = 1') as { version: number } | null;
    const currentVersion = versionRow?.version || 0;
    
    console.log(`[DB] Current database version: ${currentVersion}, Target version: ${DatabaseService.CURRENT_DB_VERSION}`);

    if (currentVersion === 0) {
      // Fresh database - create all tables with correct schema
      console.log('[DB] Creating fresh database with version', DatabaseService.CURRENT_DB_VERSION);
      await this.createFreshDatabase(db);
    } else if (currentVersion < DatabaseService.CURRENT_DB_VERSION) {
      // Run migrations
      console.log(`[DB] Migrating database from version ${currentVersion} to ${DatabaseService.CURRENT_DB_VERSION}`);
      await this.migrateDb(db, currentVersion);
    } else {
      console.log('[DB] Database is up to date');
    }
  }

  private async createFreshDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
    console.log('[DB] Creating fresh database schema...');
    
    // Create books table with all columns
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        sync_id TEXT UNIQUE,
        last_synced TEXT,
        is_dirty INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
      );
    `);

    // Create transactions table with all columns
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT,
        category TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        sync_id TEXT UNIQUE,
        last_synced TEXT,
        is_dirty INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );
    `);

    // Create user_preferences table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Create user_initialization table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_initialization (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        initialized_at TEXT NOT NULL,
        default_book_created INTEGER DEFAULT 1
      );
    `);

    // Set database version
    await db.execAsync(`
      INSERT OR REPLACE INTO db_version (id, version, updated_at) 
      VALUES (1, ${DatabaseService.CURRENT_DB_VERSION}, '${new Date().toISOString()}');
    `);
    
    console.log('[DB] Fresh database created successfully');
  }

  // Book CRUD operations
  async createBook(userId: string, name: string): Promise<Book> {
    return this.enqueueWrite<Book>(async () => {
      const created_at = new Date().toISOString();

      const attempt = async (): Promise<Book> => {
        const db = await this.openUserDB(userId);
        const result = await db.runAsync(
          'INSERT INTO books (name, created_at, is_dirty) VALUES (?, ?, 1)',
          [name, created_at]
        );
        return { id: result.lastInsertRowId, name, created_at, is_dirty: true };
      };

      try {
        return await attempt();
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes('prepareAsync') || msg.includes('execAsync') || msg.toLowerCase().includes('nullpointer')) {
          try { await this.closeDatabase(); } catch {}
          return await attempt();
        }
        throw e;
      }
    });
  }

  

  async listBooks(userId: string): Promise<Book[]> {
    const db = await this.openUserDB(userId);
    
    // Safety check: Ensure deleted column exists
    try {
      const result = await db.getAllAsync(
        'SELECT * FROM books WHERE deleted = 0 ORDER BY created_at ASC'
      );
      return result as Book[];
    } catch (error: any) {
      // If column doesn't exist, add it and retry
      if (error.message?.includes('no such column: deleted')) {
        console.log('[DB] Adding missing deleted column to books table');
        await this.addColumnIfNotExists(db, 'books', 'deleted', 'INTEGER DEFAULT 0');
        await this.addColumnIfNotExists(db, 'transactions', 'deleted', 'INTEGER DEFAULT 0');
        
        // Retry query
        const result = await db.getAllAsync(
          'SELECT * FROM books WHERE deleted = 0 ORDER BY created_at ASC'
        );
        return result as Book[];
      }
      throw error;
    }
  }

  async updateBook(userId: string, bookId: number, name: string): Promise<Book> {
    return this.enqueueWrite<Book>(async () => {
      const attempt = async (): Promise<Book> => {
        const db = await this.openUserDB(userId);
        const now = new Date().toISOString();
        await db.runAsync(
          'UPDATE books SET name = ?, updated_at = ?, synced = 0 WHERE id = ?',
          [name, now, bookId]
        );
        return { id: bookId, name, created_at: now, is_dirty: true };
      };

      try {
        return await attempt();
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes('prepareAsync') || msg.includes('execAsync') || msg.toLowerCase().includes('nullpointer')) {
          try { await this.closeDatabase(); } catch {}
          return await attempt();
        }
        throw e;
      }
    });
  }

  async deleteBook(userId: string, bookId: number): Promise<void> {
    return this.enqueueWrite<void>(async () => {
      const attempt = async (): Promise<void> => {
        const db = await this.openUserDB(userId);
        const now = new Date().toISOString();
        
        // Soft delete: Mark book and all its transactions as deleted
        await db.runAsync(
          'UPDATE books SET deleted = 1, synced = 0, updated_at = ? WHERE id = ?',
          [now, bookId]
        );
        
        // Also mark all transactions of this book as deleted
        await db.runAsync(
          'UPDATE transactions SET deleted = 1, synced = 0, updated_at = ? WHERE book_id = ?',
          [now, bookId]
        );
        
        console.log(`[DB] Soft deleted book ${bookId} and its transactions`);
      };

      try {
        await attempt();
      } catch (e: any) {
        const msg = String(e?.message || e);
        console.log('[DB] deleteBook failed:', msg);
        if (msg.includes('prepareAsync') || msg.includes('execAsync') || msg.toLowerCase().includes('nullpointer')) {
          try { await this.closeDatabase(); } catch {}
          await this.sleep(50);
          try {
            await attempt();
            return;
          } catch (e2) {
            try { await this.closeDatabase(); } catch {}
            await this.sleep(150);
            await attempt();
            return;
          }
        }
        throw e;
      }
    });
  }

  // Transaction CRUD operations
  async loadTransactions(userId: string, bookId: number): Promise<Transaction[]> {
    const db = await this.openUserDB(userId);
    const result = await db.getAllAsync(
      'SELECT * FROM transactions WHERE book_id = ? AND deleted = 0 ORDER BY created_at DESC',
      [bookId]
    );
    return result as Transaction[];
  }

  async addTransaction(
    userId: string,
    bookId: number,
    type: 'income' | 'expense',
    amount: number,
    note: string = '',
    category: string
  ): Promise<Transaction> {
    return this.enqueueWrite<Transaction>(async () => {
      const created_at = new Date().toISOString();
      const safeNote = (note ?? '').toString();
      const safeCategory = (category ?? '').toString();

      const attemptInsert = async (): Promise<Transaction> => {
        const db = await this.openUserDB(userId);
        // Database is already migrated in openUserDB, no need to migrate again

        console.log('[DB] addTransaction', { userId, bookId, type, amount, note: safeNote, category: safeCategory, created_at });
        let lastId = 0;
        await db.withTransactionAsync(async () => {
          const res = await db.runAsync(
            'INSERT INTO transactions (book_id, type, amount, note, category, created_at, is_dirty) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [bookId, type, amount, safeNote, safeCategory, created_at]
          );
          lastId = res.lastInsertRowId;
        });

        return {
          id: lastId,
          book_id: bookId,
          type,
          amount,
          note: safeNote,
          category: safeCategory,
          created_at,
          is_dirty: true,
        };
      };

      // Try once; if prepare/exec NPE happens, reopen DB and retry once
      try {
        return await attemptInsert();
      } catch (e: any) {
        const msg = String(e?.message || e);
        console.log('[DB] addTransaction first attempt failed:', msg);
        if (msg.includes('prepareAsync') || msg.includes('execAsync') || msg.toLowerCase().includes('nullpointer')) {
          try { await this.closeDatabase(); } catch {}
          await this.sleep(50);
          try {
            return await attemptInsert();
          } catch (e2) {
            // Second retry with longer backoff
            try { await this.closeDatabase(); } catch {}
            await this.sleep(150);
            return await attemptInsert();
          }
        }
        throw e;
      }
    });
  }

  async updateTransaction(
    userId: string,
    transactionId: number,
    type: 'income' | 'expense',
    amount: number,
    note: string = '',
    category: string
  ): Promise<Transaction> {
    return this.enqueueWrite<Transaction>(async () => {
      const updated_at = new Date().toISOString();
      const safeNote = (note ?? '').toString();
      const safeCategory = (category ?? '').toString();

      const attemptUpdate = async (): Promise<Transaction> => {
        const db = await this.openUserDB(userId);

        console.log('[DB] updateTransaction', { userId, transactionId, type, amount, note: safeNote, category: safeCategory, updated_at });
        
        await db.withTransactionAsync(async () => {
          await db.runAsync(
            'UPDATE transactions SET type = ?, amount = ?, note = ?, category = ?, updated_at = ?, synced = 0 WHERE id = ?',
            [type, amount, safeNote, safeCategory, updated_at, transactionId]
          );
        });

        // Fetch the updated transaction
        const result = await db.getFirstAsync(
          'SELECT * FROM transactions WHERE id = ?',
          [transactionId]
        ) as Transaction;

        return result;
      };

      try {
        return await attemptUpdate();
      } catch (e: any) {
        const msg = String(e?.message || e);
        console.log('[DB] updateTransaction first attempt failed:', msg);
        if (msg.includes('prepareAsync') || msg.includes('execAsync') || msg.toLowerCase().includes('nullpointer')) {
          try { await this.closeDatabase(); } catch {}
          await this.sleep(50);
          try {
            return await attemptUpdate();
          } catch (e2) {
            try { await this.closeDatabase(); } catch {}
            await this.sleep(150);
            return await attemptUpdate();
          }
        }
        throw e;
      }
    });
  }

  async deleteTransaction(userId: string, transactionId: number): Promise<void> {
    return this.enqueueWrite<void>(async () => {
      const db = await this.openUserDB(userId);
      const now = new Date().toISOString();
      
      // Soft delete: Mark transaction as deleted
      await db.runAsync(
        'UPDATE transactions SET deleted = 1, synced = 0, updated_at = ? WHERE id = ?',
        [now, transactionId]
      );
      
      console.log(`[DB] Soft deleted transaction ${transactionId}`);
    });
  }

  async getTransactionSummary(userId: string, bookId: number): Promise<TransactionSummary> {
    const db = await this.openUserDB(userId);
    
    const result = await db.getFirstAsync(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM transactions 
      WHERE book_id = ? AND deleted = 0
    `, [bookId]) as { income: number; expense: number };

    const balance = result.income - result.expense;

    return {
      balance,
      income: result.income,
      expense: result.expense,
    };
  }

  async getTransactionCount(userId: string, bookId: number): Promise<number> {
    const db = await this.openUserDB(userId);
    const row = await db.getFirstAsync(
      'SELECT COUNT(*) as cnt FROM transactions WHERE book_id = ?',
      [bookId]
    ) as { cnt: number } | null;
    return row ? (row.cnt ?? 0) : 0;
  }

  // User preferences operations
  async setUserPreference(userId: string, key: string, value: string): Promise<void> {
    return this.enqueueWrite<void>(async () => {
      const now = new Date().toISOString();
      const db = await this.openUserDB(userId);
      
      // Try to update existing preference first
      const existing = await db.getFirstAsync(
        'SELECT id FROM user_preferences WHERE key = ?',
        [key]
      );
      
      if (existing) {
        await db.runAsync(
          'UPDATE user_preferences SET value = ?, updated_at = ? WHERE key = ?',
          [value, now, key]
        );
      } else {
        await db.runAsync(
          'INSERT INTO user_preferences (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [key, value, now, now]
        );
      }
    });
  }

  async getUserPreference(userId: string, key: string): Promise<string | null> {
    const db = await this.openUserDB(userId);
    const result = await db.getFirstAsync(
      'SELECT value FROM user_preferences WHERE key = ?',
      [key]
    ) as { value: string } | null;
    
    return result ? result.value : null;
  }

  async getSelectedBookId(userId: string): Promise<number | null> {
    const value = await this.getUserPreference(userId, 'selected_book_id');
    return value ? parseInt(value, 10) : null;
  }

  async setSelectedBookId(userId: string, bookId: number): Promise<void> {
    await this.setUserPreference(userId, 'selected_book_id', bookId.toString());
  }

  // Check if user has been initialized
  async isUserInitialized(userId: string): Promise<boolean> {
    const db = await this.openUserDB(userId);
    const result = await db.getFirstAsync(
      'SELECT id FROM user_initialization WHERE user_id = ?',
      [userId]
    );
    return result !== null;
  }

  // Get user initialization details (for debugging)
  async getUserInitializationInfo(userId: string): Promise<{initialized: boolean, date?: string}> {
    const db = await this.openUserDB(userId);
    const result = await db.getFirstAsync(
      'SELECT initialized_at FROM user_initialization WHERE user_id = ?',
      [userId]
    ) as { initialized_at: string } | null;
    
    return {
      initialized: result !== null,
      date: result?.initialized_at
    };
  }

  // Mark user as initialized
  async markUserAsInitialized(userId: string): Promise<void> {
    return this.enqueueWrite<void>(async () => {
      const db = await this.openUserDB(userId);
      const now = new Date().toISOString();
      
      // Use INSERT OR IGNORE to prevent duplicates
      await db.runAsync(
        'INSERT OR IGNORE INTO user_initialization (user_id, initialized_at) VALUES (?, ?)',
        [userId, now]
      );
    });
  }

  // Initialize default book for new users (safe from duplicates)
  async initializeDefaultBook(userId: string): Promise<Book | null> {
    // Check if user is already initialized
    const isInitialized = await this.isUserInitialized(userId);
    if (isInitialized) {
      console.log(`[DB] User ${userId} already initialized, skipping default book creation`);
      // Return first book if exists
      const books = await this.listBooks(userId);
      return books.length > 0 ? books[0] : null;
    }

    console.log(`[DB] Initializing new user ${userId} with default book`);
    
    // Create default book and mark user as initialized
    const books = await this.listBooks(userId);
    let defaultBook: Book;
    
    if (books.length === 0) {
      defaultBook = await this.createBook(userId, 'Buku Utama');
      console.log(`[DB] Created default book for user ${userId}:`, defaultBook);
    } else {
      defaultBook = books[0];
      console.log(`[DB] Using existing book as default for user ${userId}:`, defaultBook);
    }
    
    // Mark user as initialized to prevent future duplicate creation
    await this.markUserAsInitialized(userId);
    
    return defaultBook;
  }

  private async migrateDb(db: SQLite.SQLiteDatabase, fromVersion: number): Promise<void> {
    try {
      console.log(`[DB] Starting migration from version ${fromVersion}`);

      // Migration from version 0 to 1: Add category column
      if (fromVersion < 1) {
        console.log('[DB] Migrating to version 1: Adding category column');
        await this.addColumnIfNotExists(db, 'transactions', 'category', 'TEXT');
      }

      // Migration from version 1 to 2: Add updated_at columns
      if (fromVersion < 2) {
        console.log('[DB] Migrating to version 2: Adding updated_at columns');
        await this.addColumnIfNotExists(db, 'books', 'updated_at', 'TEXT');
        await this.addColumnIfNotExists(db, 'transactions', 'updated_at', 'TEXT');
      }

      // Migration from version 2 to 3: Add sync columns
      if (fromVersion < 3) {
        console.log('[DB] Migrating to version 3: Adding sync columns');
        await this.addColumnIfNotExists(db, 'books', 'sync_id', 'TEXT');
        await this.addColumnIfNotExists(db, 'books', 'last_synced', 'TEXT');
        await this.addColumnIfNotExists(db, 'books', 'is_dirty', 'INTEGER DEFAULT 1');
        await this.addColumnIfNotExists(db, 'books', 'synced', 'INTEGER DEFAULT 0');
        
        await this.addColumnIfNotExists(db, 'transactions', 'sync_id', 'TEXT');
        await this.addColumnIfNotExists(db, 'transactions', 'last_synced', 'TEXT');
        await this.addColumnIfNotExists(db, 'transactions', 'is_dirty', 'INTEGER DEFAULT 1');
        await this.addColumnIfNotExists(db, 'transactions', 'synced', 'INTEGER DEFAULT 0');

        // Add UNIQUE constraint to sync_id columns by recreating tables
        console.log('[DB] Adding UNIQUE constraints to sync_id columns...');
        
        await db.execAsync(`
          PRAGMA foreign_keys=off;
          BEGIN TRANSACTION;
          
          -- Create new books table with UNIQUE constraint
          CREATE TABLE IF NOT EXISTS books_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            sync_id TEXT UNIQUE,
            last_synced TEXT,
            is_dirty INTEGER DEFAULT 1,
            synced INTEGER DEFAULT 0
          );
          
          -- Copy data from old books table
          INSERT OR IGNORE INTO books_new (id, name, created_at, updated_at, sync_id, last_synced, is_dirty, synced)
          SELECT 
            id, 
            name, 
            created_at, 
            updated_at,
            sync_id,
            last_synced,
            COALESCE(is_dirty, 1),
            COALESCE(synced, 0)
          FROM books;
          
          -- Drop old table and rename
          DROP TABLE books;
          ALTER TABLE books_new RENAME TO books;
          
          -- Create new transactions table with UNIQUE constraint
          CREATE TABLE IF NOT EXISTS transactions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            note TEXT,
            category TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            sync_id TEXT UNIQUE,
            last_synced TEXT,
            is_dirty INTEGER DEFAULT 1,
            synced INTEGER DEFAULT 0,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
          );
          
          -- Copy data from old transactions table
          INSERT OR IGNORE INTO transactions_new (
            id, book_id, type, amount, note, category, created_at, updated_at, 
            sync_id, last_synced, is_dirty, synced
          )
          SELECT 
            id, book_id, type, amount, note, category, created_at, updated_at,
            sync_id,
            last_synced,
            COALESCE(is_dirty, 1),
            COALESCE(synced, 0)
          FROM transactions;
          
          -- Drop old table and rename
          DROP TABLE transactions;
          ALTER TABLE transactions_new RENAME TO transactions;
          
          COMMIT;
          PRAGMA foreign_keys=on;
        `);
      }

      // Migration from version 3 to 4: Add deleted column for soft delete
      if (fromVersion < 4) {
        console.log('[DB] Migrating to version 4: Adding deleted column for soft delete');
        await this.addColumnIfNotExists(db, 'books', 'deleted', 'INTEGER DEFAULT 0');
        await this.addColumnIfNotExists(db, 'transactions', 'deleted', 'INTEGER DEFAULT 0');
      }

      // Update database version
      await db.execAsync(`
        INSERT OR REPLACE INTO db_version (id, version, updated_at) 
        VALUES (1, ${DatabaseService.CURRENT_DB_VERSION}, '${new Date().toISOString()}');
      `);

      console.log(`[DB] Migration completed successfully to version ${DatabaseService.CURRENT_DB_VERSION}`);
    } catch (error) {
      console.error('[DB] Migration failed:', error);
      throw error;
    }
  }

  private async addColumnIfNotExists(
    db: SQLite.SQLiteDatabase, 
    tableName: string, 
    columnName: string, 
    columnDefinition: string
  ): Promise<void> {
    try {
      console.log(`[DB] Checking if column "${columnName}" exists in ${tableName}`);
      const columns = await db.getAllAsync(`PRAGMA table_info(${tableName})`);
      const hasColumn = (columns as { name: string }[]).some(
        (column) => column.name === columnName
      );

      if (!hasColumn) {
        console.log(`[DB] Adding "${columnName}" column to ${tableName} table...`);
        
        // Handle UNIQUE constraint specially
        if (columnDefinition.includes('UNIQUE')) {
          // First add the column without UNIQUE constraint
          await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition.replace('UNIQUE', '').trim()}`);
          
          // Then update all rows with unique values
          const rows = await db.getAllAsync(`SELECT id FROM ${tableName}`) as { id: number }[];
          for (const row of rows) {
            await db.runAsync(
              `UPDATE ${tableName} SET ${columnName} = ? WHERE id = ?`,
              [`${tableName}_${row.id}_${Date.now()}`, row.id]
            );
          }
          
          // Finally, add UNIQUE constraint through a new table
          await db.execAsync(`
            PRAGMA foreign_keys=off;
            BEGIN TRANSACTION;
            
            -- Create new table with UNIQUE constraint
            CREATE TABLE ${tableName}_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              ${tableName === 'books' ? 'name TEXT NOT NULL, created_at TEXT NOT NULL' : 'book_id INTEGER NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, note TEXT, category TEXT, created_at TEXT NOT NULL'},
              sync_id TEXT UNIQUE,
              last_synced TEXT,
              is_dirty BOOLEAN DEFAULT 1,
              synced INTEGER DEFAULT 0
              ${tableName === 'transactions' ? ', FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE' : ''}
            );
            
            -- Copy data from old table to new table
            INSERT INTO ${tableName}_new (id, ${
              tableName === 'books' ? 'name, created_at' : 'book_id, type, amount, note, category, created_at'
            }, sync_id, last_synced, is_dirty, synced)
            SELECT id, ${
              tableName === 'books' ? 'name, created_at' : 'book_id, type, amount, note, category, created_at'
            }, sync_id, last_synced, is_dirty, synced FROM ${tableName};
            
            -- Drop old table and rename new one
            DROP TABLE ${tableName};
            ALTER TABLE ${tableName}_new RENAME TO ${tableName};
            
            COMMIT;
            PRAGMA foreign_keys=on;
          `);
          
          console.log(`[DB] Successfully added "${columnName}" with UNIQUE constraint to ${tableName} table`);
        } else {
          // For non-UNIQUE columns, just add the column normally
          await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
          console.log(`[DB] Successfully added "${columnName}" column to ${tableName} table`);
        }
      } else {
        console.log(`[DB] Column "${columnName}" already exists in ${tableName} table`);
      }
    } catch (error) {
      console.log(`[DB] Failed to add column "${columnName}" to ${tableName}:`, error);
      // Don't throw error to prevent breaking the app
    }
  }

  // Sync utility methods
  async markBookAsDirty(userId: string, bookId: number): Promise<void> {
    return this.enqueueWrite<void>(async () => {
      const db = await this.openUserDB(userId);
      await db.runAsync(
        'UPDATE books SET is_dirty = 1 WHERE id = ?',
        [bookId]
      );
    });
  }

  async markTransactionAsDirty(userId: string, transactionId: number): Promise<void> {
    return this.enqueueWrite<void>(async () => {
      const db = await this.openUserDB(userId);
      const now = new Date().toISOString();
      await db.runAsync(
        'UPDATE transactions SET updated_at = ?, synced = 0 WHERE id = ?',
        [now, transactionId]
      );
    });
  }

  async updateBookSyncStatus(userId: string, bookId: number, syncId: string, lastSynced?: string): Promise<void> {
    return this.enqueueWrite<void>(async () => {
      const db = await this.openUserDB(userId);
      const syncTime = lastSynced || new Date().toISOString();
      await db.runAsync(
        'UPDATE books SET sync_id = ?, last_synced = ?, is_dirty = 0 WHERE id = ?',
        [syncId, syncTime, bookId]
      );
    });
  }

  async updateTransactionSyncStatus(userId: string, transactionId: number, syncId: string, lastSynced?: string): Promise<void> {
    return this.enqueueWrite<void>(async () => {
      const db = await this.openUserDB(userId);
      const syncTime = lastSynced || new Date().toISOString();
      await db.runAsync(
        'UPDATE transactions SET sync_id = ?, last_synced = ?, is_dirty = 0 WHERE id = ?',
        [syncId, syncTime, transactionId]
      );
    });
  }

  async getDirtyBooks(userId: string): Promise<Book[]> {
    const db = await this.openUserDB(userId);
    const result = await db.getAllAsync(
      'SELECT * FROM books WHERE (synced = 0 OR sync_id IS NULL) ORDER BY created_at ASC'
    );
    return result as Book[];
  }

  async getDirtyTransactions(userId: string): Promise<Transaction[]> {
    const db = await this.openUserDB(userId);
    const result = await db.getAllAsync(
      'SELECT * FROM transactions WHERE (synced = 0 OR sync_id IS NULL) ORDER BY created_at ASC'
    );
    return result as Transaction[];
  }

  async getUnsyncedBooks(userId: string): Promise<Book[]> {
    const db = await this.openUserDB(userId);
    const result = await db.getAllAsync(
      'SELECT * FROM books WHERE sync_id IS NULL OR sync_id = "" ORDER BY created_at ASC'
    );
    return result as Book[];
  }

  async getUnsyncedTransactions(userId: string): Promise<Transaction[]> {
    const db = await this.openUserDB(userId);
    const result = await db.getAllAsync(
      'SELECT * FROM transactions WHERE sync_id IS NULL OR sync_id = "" ORDER BY created_at ASC'
    );
    return result as Transaction[];
  }
}

