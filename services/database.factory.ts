import { Platform } from 'react-native';
import { DatabaseService } from './database';
import { WebDatabaseService } from './database.web';

/**
 * Database factory that returns the appropriate database service
 * based on the platform (SQLite for native, AsyncStorage for web)
 */
export function getDatabaseService(): DatabaseService | WebDatabaseService {
  if (Platform.OS === 'web') {
    return WebDatabaseService.getInstance() as any;
  }
  return DatabaseService.getInstance();
}

// Export a singleton instance
export const db = getDatabaseService();
