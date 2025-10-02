import BalanceCard from '@/components/BalanceCard';
import Container from '@/components/Container';
import EmptyState from '@/components/EmptyState';
import { useBooks } from '@/contexts/BookContext';
import { useUser } from '@/contexts/UserContext';
import { DatabaseService, TransactionSummary } from '@/services/database';
import { colors } from '@/styles/colors';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BookStats {
  bookId: number;
  summary: TransactionSummary;
  count: number;
}

export default function BooksScreen() {
  const { books, isLoading, refreshBooks } = useBooks();
  const { user } = useUser();
  const [stats, setStats] = useState<Record<number, BookStats>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user) return;
    const db = DatabaseService.getInstance();
    const pairs = await Promise.all(
      books.map(async (b) => {
        const [summary, count] = await Promise.all([
          db.getTransactionSummary(user.id, b.id),
          db.getTransactionCount(user.id, b.id),
        ]);
        return [b.id, { bookId: b.id, summary, count }] as const;
      })
    );
    const map: Record<number, BookStats> = {};
    pairs.forEach(([id, s]) => (map[id] = s));
    setStats(map);
  }, [books, user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBooks();
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  }, [refreshBooks, loadStats]);

  const content = useMemo(() => {
    if (!books || books.length === 0) {
      return (
        <View style={styles.emptyStateWrap}>
          <EmptyState iconName="book-outline" text="Belum ada buku. Tambahkan buku terlebih dahulu." />
        </View>
      );
    }

    return (
      <View style={styles.list}>
        {books.map((book) => {
          const s = stats[book.id];
          const balance = s?.summary?.balance ?? 0;
          const income = s?.summary?.income ?? 0;
          const expense = s?.summary?.expense ?? 0;
          const count = s?.count ?? 0;
          return (
            <View key={book.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.bookName}>{book.name}</Text>
                <Text style={styles.countText}>{count} transaksi</Text>
              </View>
              <BalanceCard balance={balance} income={income} expense={expense} currency="IDR" />
            </View>
          );
        })}
      </View>
    );
  }, [books, stats]);

  return (
    <Container refreshing={refreshing || isLoading} onRefresh={onRefresh} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {/* <Text style={styles.title}>Semua Buku</Text> */}
          <Text style={styles.subtitle}>Ringkasan saldo dan jumlah transaksi per buku</Text>
        </View>
        {content}
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
    // gap: 16,
  },
  header: {
    marginTop: 16,
    paddingHorizontal: 4,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    marginTop: 8,
    gap: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  bookName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyStateWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
