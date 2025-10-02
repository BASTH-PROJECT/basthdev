import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface InsightData {
  topCategories: Array<{ category: string; amount: number; percentage: number }>;
  biggestExpense: { amount: number; category: string; note?: string } | null;
  monthOverMonth: { change: number; isIncrease: boolean } | null;
}

interface SmartInsightsProps {
  data: InsightData;
  currencyFormatter: Intl.NumberFormat;
}

const SmartInsights: React.FC<SmartInsightsProps> = ({ data, currencyFormatter }) => {
  const { topCategories, biggestExpense, monthOverMonth } = data;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="bulb" size={20} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Analisis</Text>
          <Text style={styles.headerSubtitle}>Analisis cerdas dari transaksi Anda</Text>
        </View>
      </View>

      {/* Top 3 Categories */}
      {topCategories.length > 0 && (
        <View style={styles.insightBlock}>
          <Text style={styles.insightLabel}>Top 3 Kategori Pengeluaran</Text>
          <View style={styles.topCategoriesGrid}>
            {topCategories.map((cat, idx) => (
              <View key={cat.category} style={styles.topCategoryItem}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{idx + 1}</Text>
                </View>
                <View style={styles.categoryContent}>
                  <Text style={styles.categoryName}>{cat.category}</Text>
                  <Text style={styles.categoryAmount}>{currencyFormatter.format(cat.amount)}</Text>
                  <Text style={styles.categoryPercentage}>({cat.percentage.toFixed(1)}%)</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Biggest Expense */}
      {/* {biggestExpense && (
        <View style={styles.insightBlock}>
          <Text style={styles.insightLabel}>Pengeluaran Terbesar</Text>
          <View style={styles.biggestExpenseCard}>
            <View style={styles.biggestExpenseRow}>
              <Ionicons name="trending-up" size={18} color={colors.expense} />
              <Text style={styles.biggestAmount}>{currencyFormatter.format(biggestExpense.amount)}</Text>
            </View>
            <Text style={styles.biggestCategory}>{biggestExpense.category}</Text>
            {biggestExpense.note && <Text style={styles.biggestNote}>{biggestExpense.note}</Text>}
          </View>
        </View>
      )} */}

      {/* Month over Month */}
      {monthOverMonth && (
        <View style={styles.insightBlock}>
          <Text style={styles.insightLabel}>Perubahan Bulan ke Bulan</Text>
          <View style={[styles.momCard, monthOverMonth.isIncrease ? styles.momIncrease : styles.momDecrease]}>
            <Ionicons
              name={monthOverMonth.isIncrease ? 'arrow-up' : 'arrow-down'}
              size={20}
              color={monthOverMonth.isIncrease ? colors.expense : colors.income}
            />
            <Text style={[styles.momText, monthOverMonth.isIncrease ? styles.momTextIncrease : styles.momTextDecrease]}>
              {monthOverMonth.isIncrease ? '+' : ''}{monthOverMonth.change.toFixed(1)}%
            </Text>
            <Text style={styles.momLabel}>
              {monthOverMonth.isIncrease ? 'lebih tinggi' : 'lebih rendah'} dari bulan lalu
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    // padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
    marginTop: 2,
  },
  insightBlock: {
    gap: 8,
  },
  insightLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  topCategoriesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  topCategoryItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  categoryContent: {
    alignItems: 'center',
    gap: 2,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  categoryAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  categoryPercentage: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  biggestExpenseCard: {
    padding: 10,
    backgroundColor: `${colors.expense}10`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${colors.expense}30`,
  },
  biggestExpenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  biggestAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.expense,
  },
  biggestCategory: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  biggestNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  momCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  momIncrease: {
    backgroundColor: `${colors.expense}10`,
    borderColor: `${colors.expense}30`,
  },
  momDecrease: {
    backgroundColor: `${colors.income}10`,
    borderColor: `${colors.income}30`,
  },
  momText: {
    fontSize: 16,
    fontWeight: '700',
  },
  momTextIncrease: {
    color: colors.expense,
  },
  momTextDecrease: {
    color: colors.income,
  },
  momLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default SmartInsights;
