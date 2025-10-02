import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BalanceCardProps {
  balance: number; // total balance
  income: number;  // total income
  expense: number; // total expense
  currency?: string; // e.g., IDR
}

function formatCurrency(value: number, currency: string = 'IDR') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    // Fallback if Intl fails on some Android locales
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

export default function BalanceCard({ balance, income, expense, currency = 'IDR' }: BalanceCardProps) {
  const digitCount = (value: number) => String(Math.trunc(Math.abs(value))).length || 1;
  const getPillFontSize = (value: number) => (digitCount(value) >= 9 ? 13 : 15);
  const incomeFontSize = getPillFontSize(income);
  const expenseFontSize = getPillFontSize(expense);
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Total Saldo</Text>
      <Text style={styles.balance}>{formatCurrency(balance, currency)}</Text>

      <View style={styles.row}>
        <View style={[styles.pill, styles.incomePill]}>
          <Ionicons name="arrow-up-circle" size={18} color={colors.income} style={styles.pillIcon} />
          <View>
            <Text style={styles.pillLabel}>Pemasukan</Text>
            <Text style={[styles.pillValue, { color: colors.income, fontSize: incomeFontSize }]}>{formatCurrency(income, currency)}</Text>
          </View>
        </View>
        <View style={[styles.pill, styles.expensePill]}>
          <Ionicons name="arrow-down-circle" size={18} color={colors.expense} style={styles.pillIcon} />
          <View>
            <Text style={styles.pillLabel}>Pengeluaran</Text>
            <Text style={[styles.pillValue, { color: colors.expense, fontSize: expenseFontSize }]}>{formatCurrency(expense, currency)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brand,
    borderRadius: 18,
    padding: 16,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  label: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  balance: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 14,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  incomePill: {
    backgroundColor: colors.incomeBg,
    borderColor: colors.incomeBorder,
    borderWidth: StyleSheet.hairlineWidth,
  },
  expensePill: {
    backgroundColor: colors.expenseBg,
    borderColor: colors.expenseBorder,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillIcon: {
    marginRight: 10,
  },
  pillLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  pillValue: {
    fontSize: 15,
    fontWeight: '700',
  }
});
