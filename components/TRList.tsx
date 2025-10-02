import { CATEGORY_META } from '@/constants/categories';
import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import EmptyState from './EmptyState';

export interface TRItem {
  id: string | number;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category?: string;
  created_at: string;
}

interface TRListProps {
  items: TRItem[];
  limit?: number;
  currency?: string;
}

function formatCurrency(value: number, currency: string = 'IDR') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

export default function TRList({ items, limit = 10, currency = 'IDR' }: TRListProps) {
  const data = useMemo(() => {
    return [...items]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }, [items, limit]);

  const renderItem = ({ item }: { item: TRItem }) => {
    const isIncome = item.type === 'income';
    const categoryInfo = CATEGORY_META.find(c => c.key === item.category);
    const icon = categoryInfo?.icon || 'help-circle-outline';

    return (
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: isIncome ? colors.incomeBg : colors.expenseBg, borderColor: isIncome ? colors.incomeBorder : colors.expenseBorder }]}>
          <Ionicons name={icon as any} size={16} color={isIncome ? colors.income : colors.expense} />
        </View>
        <View style={styles.rowCenter}>
          <Text style={styles.note} numberOfLines={1}>
            {categoryInfo?.label || 'Tanpa Kategori'}
          </Text>
          {item.note ? (
            <Text style={styles.date} numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.amount, { color: isIncome ? colors.income : colors.expense }]}>
          {isIncome ? '+' : '-'}{formatCurrency(item.amount, currency)}
        </Text>
      </View>
    );
  };

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Transaksi Hari Ini</Text>
        <EmptyState iconName="receipt-outline" text="Belum ada transaksi" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transaksi Hari Ini</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
        nestedScrollEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    marginBottom: 100,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowCenter: {
    flex: 1,
  },
  note: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: colors.surface,
  },
});
