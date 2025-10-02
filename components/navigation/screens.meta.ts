export const screenMeta = [
  { key: 'home', label: 'Beranda', icon: 'home' as const },
  { key: 'transaction', label: 'Transaksi', icon: 'receipt-outline' as const },
  { key: 'report', label: 'Laporan', icon: 'document-text-outline' as const },
  { key: 'books', label: 'Semua Buku', icon: 'book-outline' as const },
  { key: 'profile', label: 'Profile', icon: 'person-outline' as const },
  // { key: 'clerkSupabase', label: 'Clerk + Supabase', icon: 'person-outline' as const },
  { key: 'settings', label: 'Pengaturan', icon: 'settings-outline' as const },
  // { key: 'help', label: 'Bantuan & Dukungan', icon: 'help-circle-outline' as const },
] as const;

export type ScreenKey = typeof screenMeta[number]['key'];
export type ScreenMetaItem = typeof screenMeta[number];
