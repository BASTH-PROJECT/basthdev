/**
 * Edit Permissions Configuration
 * 
 * Control which transactions can be edited based on their date.
 * Uncomment/comment the lines below to enable/disable edit permissions.
 */

export type EditPermission = 'TODAY' | 'YESTERDAY' | 'TODAY_AND_YESTERDAY';

// ============================================
// EDIT PERMISSION CONFIGURATION
// ============================================
// Uncomment ONE of the following lines to set the edit permission:

// Option 1: Only allow editing transactions from TODAY
// export const EDIT_PERMISSION: EditPermission = 'TODAY';

// Option 2: Only allow editing transactions from YESTERDAY
// export const EDIT_PERMISSION: EditPermission = 'YESTERDAY';

// Option 3: Allow editing transactions from TODAY and YESTERDAY (default)
export const EDIT_PERMISSION: EditPermission = 'TODAY_AND_YESTERDAY';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a transaction date is within the allowed edit range
 */
export function isTransactionEditable(transactionDate: Date | string): boolean {
  const txDate = typeof transactionDate === 'string' ? new Date(transactionDate) : transactionDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const txDateOnly = new Date(txDate);
  txDateOnly.setHours(0, 0, 0, 0);
  
  switch (EDIT_PERMISSION) {
    case 'TODAY':
      return txDateOnly.getTime() === today.getTime();
      
    case 'YESTERDAY':
      return txDateOnly.getTime() === yesterday.getTime();
      
    case 'TODAY_AND_YESTERDAY':
      return txDateOnly.getTime() === today.getTime() || txDateOnly.getTime() === yesterday.getTime();
      
    default:
      return false;
  }
}

/**
 * Get human-readable description of current edit permission
 */
export function getEditPermissionDescription(): string {
  switch (EDIT_PERMISSION) {
    case 'TODAY':
      return 'Hanya transaksi hari ini yang dapat diedit';
      
    case 'YESTERDAY':
      return 'Hanya transaksi kemarin yang dapat diedit';
      
    case 'TODAY_AND_YESTERDAY':
      return 'Transaksi hari ini dan kemarin dapat diedit';
      
    default:
      return 'Tidak ada transaksi yang dapat diedit';
  }
}

/**
 * Get the date range for editable transactions
 */
export function getEditableDateRange(): { start: Date; end: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  
  switch (EDIT_PERMISSION) {
    case 'TODAY':
      return { start: today, end: endOfToday };
      
    case 'YESTERDAY':
      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);
      return { start: yesterday, end: endOfYesterday };
      
    case 'TODAY_AND_YESTERDAY':
      return { start: yesterday, end: endOfToday };
      
    default:
      return { start: today, end: today };
  }
}
