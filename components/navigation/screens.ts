import Books from '@/app/(protected)/books';
import Home from '@/app/(protected)/index';
import Profile from '@/app/(protected)/profile';
import Report from '@/app/(protected)/report';
import Settings from '@/app/(protected)/settings';
import Transaction from '@/app/(protected)/transaction';

export const screens = [
  { key: 'home', label: 'Beranda', icon: 'home' as const, component: Home },
  { key: 'transaction', label: 'Transaksi', icon: 'receipt-outline' as const, component: Transaction },
  { key: 'report', label: 'Laporan', icon: 'document-text-outline' as const, component: Report },
  { key: 'books', label: 'Semua Buku', icon: 'book-outline' as const, component: Books },
  // { key: 'clerkSupabase', label: 'Clerk + Supabase', icon: 'person-outline' as const, component: ClerkSupabase },
  { key: 'settings', label: 'Pengaturan', icon: 'settings-outline' as const, component: Settings },
  // { key: 'help', label: 'Bantuan & Dukungan', icon: 'help-circle-outline' as const, component: Help },
] as const;

// Profile screen - available for navigation but not in drawer menu
export const profileScreen = { key: 'profile', label: 'Profile', icon: 'person-outline' as const, component: Profile };

export type ScreenKey = typeof screens[number]['key'] | 'profile';

export function getScreenByKey(key: ScreenKey) {
  if (key === 'profile') {
    return profileScreen;
  }
  return screens.find(s => s.key === key);
}
