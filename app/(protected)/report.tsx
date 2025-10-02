import BalanceCard from '@/components/BalanceCard';
import AppBottomSheet from '@/components/BottomSheet';
import Container from '@/components/Container';
import EmptyState from '@/components/EmptyState';
import SmartInsights from '@/components/SmartInsights';
import { CATEGORY_META } from '@/constants/categories';
import { useBooks } from '@/contexts/BookContext';
import { useTransactions } from '@/contexts/TransactionContext';
import { exportTransactionsToExcel, exportTransactionsToPdf } from '@/services/export';
import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, InteractionManager, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import Svg, { Line } from 'react-native-svg';

type TransactionsArray = ReturnType<typeof useTransactions>['transactions'];
type TransactionItem = TransactionsArray[number];
type MonthCacheEntry = {
  transactionsRef: TransactionsArray;
  filteredTransactions: TransactionsArray;
  summary: { income: number; expense: number; balance: number; expenseCount: number };
  dailySeries: { day: number; expense: number; income: number }[];
  expenseByCategory: { x: string; y: number; key: string }[];
};

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
});

const monthLabelFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isSameMonth(date: Date, compare: Date) {
  return date.getFullYear() === compare.getFullYear() && date.getMonth() === compare.getMonth();
}

function ReportComponent() {
  const { transactions, isLoading, refreshTransactions } = useTransactions();
  const { activeBook } = useBooks();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [isExporting, setIsExporting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(true);
  const [showCharts, setShowCharts] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const monthEnd = useMemo(() => endOfMonth(cursor), [cursor]);
  const daysInMonth = monthEnd.getDate();

  const monthKey = useMemo(() => `${cursor.getFullYear()}-${cursor.getMonth()}`, [cursor]);

  const cacheRef = useRef<Map<string, MonthCacheEntry>>(new Map());

  const { filteredTransactions, summary, dailySeries, expenseByCategory } = useMemo(() => {
    setIsCalculating(true);
    const cache = cacheRef.current;
    const cached = cache.get(monthKey);
    if (
      cached &&
      cached.transactionsRef === transactions &&
      typeof cached.summary.expenseCount === 'number'
    ) {
      setIsCalculating(false);
      return cached;
    }

    const filtered = transactions.filter((tx: TransactionItem) => isSameMonth(new Date(tx.created_at), cursor));

    const summaryResult = filtered.reduce<{ income: number; expense: number; balance: number; expenseCount: number }>((acc, tx) => {
      if (tx.type === 'income') {
        acc.income += tx.amount;
        acc.balance += tx.amount;
      } else {
        acc.expense += tx.amount;
        acc.balance -= tx.amount;
        acc.expenseCount += 1;
      }
      return acc;
    }, { income: 0, expense: 0, balance: 0, expenseCount: 0 });

    const buckets = Array.from({ length: daysInMonth }, (_, idx) => ({
      day: idx + 1,
      expense: 0,
      income: 0,
    }));

    filtered.forEach(tx => {
      const txDate = new Date(tx.created_at);
      const dayIndex = txDate.getDate() - 1;
      if (dayIndex < 0 || dayIndex >= buckets.length) return;

      if (tx.type === 'expense') {
        buckets[dayIndex].expense += tx.amount;
      } else if (tx.type === 'income') {
        buckets[dayIndex].income += tx.amount;
      }
    });

    const normalizedExpenses = filtered.filter(tx => tx.type === 'expense');
    const map = new Map<string, number>();

    normalizedExpenses.forEach(tx => {
      const key = tx.category || 'uncategorized';
      map.set(key, (map.get(key) ?? 0) + tx.amount);
    });

    const expenseData = Array.from(map.entries()).map(([categoryKey, value]) => {
      const meta = CATEGORY_META.find(c => c.key === categoryKey);
      return {
        x: meta?.label ?? 'Tanpa Kategori',
        y: value,
        key: categoryKey,
      };
    });

    if (expenseData.length === 0) {
      expenseData.push({ x: 'Tidak ada data', y: 1, key: 'empty' });
    }

    const entry: MonthCacheEntry = {
      transactionsRef: transactions,
      filteredTransactions: filtered,
      summary: summaryResult,
      dailySeries: buckets,
      expenseByCategory: expenseData,
    };

    cache.set(monthKey, entry);
    if (cache.size > 6) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }

    // Defer setting isCalculating to false
    InteractionManager.runAfterInteractions(() => {
      setIsCalculating(false);
    });

    return entry;
  }, [transactions, cursor, monthKey, daysInMonth]);

  // Always compute monthly expense count from current filteredTransactions
  const monthlyExpenseCount = useMemo(() => (
    filteredTransactions.filter(tx => tx.type === 'expense').length
  ), [filteredTransactions]);

  // Compute Smart Insights data
  const insightsData = useMemo(() => {
    // Top 3 categories by expense
    const topCategories = expenseByCategory
      .filter(item => item.key !== 'empty')
      .sort((a, b) => b.y - a.y)
      .slice(0, 3)
      .map(item => {
        const totalExpense = expenseByCategory.reduce((sum, cat) => sum + cat.y, 0);
        return {
          category: item.x,
          amount: item.y,
          percentage: totalExpense > 0 ? (item.y / totalExpense) * 100 : 0,
        };
      });

    // Biggest single expense
    const expenses = filteredTransactions.filter(tx => tx.type === 'expense');
    const biggestExpense = expenses.length > 0
      ? expenses.reduce((max, tx) => (tx.amount > max.amount ? tx : max), expenses[0])
      : null;

    const biggestExpenseData = biggestExpense
      ? {
          amount: biggestExpense.amount,
          category: CATEGORY_META.find(c => c.key === biggestExpense.category)?.label ?? 'Tanpa Kategori',
          note: biggestExpense.note ?? undefined,
        }
      : null;

    // Month over month change (compare with previous month)
    const prevMonthStart = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    const prevMonthEnd = new Date(cursor.getFullYear(), cursor.getMonth(), 0);
    const prevMonthTransactions = transactions.filter((tx: TransactionItem) => {
      const txDate = new Date(tx.created_at);
      return txDate >= prevMonthStart && txDate <= prevMonthEnd;
    });
    const prevMonthExpense = prevMonthTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const monthOverMonth = prevMonthExpense > 0
      ? {
          change: ((summary.expense - prevMonthExpense) / prevMonthExpense) * 100,
          isIncrease: summary.expense > prevMonthExpense,
        }
      : null;

    return {
      topCategories,
      biggestExpense: biggestExpenseData,
      monthOverMonth,
    };
  }, [filteredTransactions, expenseByCategory, summary.expense, cursor, transactions]);

  // Progressive chart loading
  useEffect(() => {
    setShowCharts(false);
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        setShowCharts(true);
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [monthKey]);

  const handleExport = async (type: 'pdf' | 'xlsx') => {
    if (isExporting) {
      Alert.alert('Berbagi sedang berlangsung', 'Selesaikan proses berbagi sebelumnya sebelum mencoba lagi.');
      return;
    }

    if (filteredTransactions.length === 0) {
      Alert.alert('Tidak ada data', 'Belum ada transaksi di bulan ini.');
      return;
    }

    setIsExporting(true);

    try {
      // Check if sharing is available on Android
      if (Platform.OS === 'android' && !(await Sharing.isAvailableAsync())) {
        Alert.alert(
          'Berbagi tidak tersedia',
          "Instal atau perbarui 'Files by Google' atau 'Google Drive' agar dapat menyimpan dokumen."
        );
        setIsExporting(false);
        return;
      }

      const options = {
        monthLabel: monthLabelFormatter.format(monthStart),
        startDate: monthStart,
        endDate: monthEnd,
        bookName: activeBook?.name ?? null,
      };

      if (type === 'pdf') {
        await exportTransactionsToPdf(filteredTransactions, options);
        Alert.alert('Berhasil', 'File PDF berhasil dibuat dan dibagikan.');
      } else {
        await exportTransactionsToExcel(filteredTransactions, options);
        Alert.alert('Berhasil', 'File Excel berhasil dibuat dan dibagikan.');
      }
    } catch (error) {
      console.error('Export error', error);

      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Another share request')) {
        Alert.alert('Berbagi sedang berlangsung', 'Selesaikan proses berbagi sebelumnya sebelum mencoba lagi.');
      } else if (message.includes('EXPORT_SAVE_CANCELLED')) {
        Alert.alert(
          'Penyimpanan dibatalkan',
          'Pilih folder tujuan saat diminta untuk menyimpan file. Pada Android, aplikasi harus menggunakan pemilih folder untuk menyimpan berkas.'
        );
      } else if (message.includes('EXPORT_DIRECTORY_UNAVAILABLE') || message.includes('EXPORT_SHARE_UNAVAILABLE')) {
        Alert.alert(
          'Berbagi tidak tersedia',
          "Instal atau perbarui 'Files by Google' atau 'Google Drive' agar dapat menyimpan dokumen."
        );
      } else {
        Alert.alert('Gagal menyimpan', 'Terjadi kesalahan saat menyimpan file.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToDevice = async (type: 'pdf' | 'xlsx') => {
    if (isExporting) {
      Alert.alert('Proses sedang berjalan', 'Tunggu sampai proses sebelumnya selesai.');
      return;
    }

    if (filteredTransactions.length === 0) {
      Alert.alert('Tidak ada data', 'Belum ada transaksi di bulan ini.');
      return;
    }

    if (Platform.OS !== 'android') {
      Alert.alert('iOS', "Gunakan tombol 'Bagikan' lalu pilih 'Simpan ke File' untuk menyimpan ke perangkat.");
      return;
    }

    setIsExporting(true);
    try {
      const options = {
        monthLabel: monthLabelFormatter.format(monthStart),
        startDate: monthStart,
        endDate: monthEnd,
        bookName: activeBook?.name ?? null,
      };

      if (type === 'pdf') {
        await exportTransactionsToPdf(filteredTransactions, options, { saveToDevice: true });
        Alert.alert('Berhasil', 'File PDF berhasil disimpan ke perangkat.');
      } else {
        await exportTransactionsToExcel(filteredTransactions, options, { saveToDevice: true });
        Alert.alert('Berhasil', 'File Excel berhasil disimpan ke perangkat.');
      }
    } catch (error) {
      console.error('Save to device error', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('EXPORT_SAVE_CANCELLED')) {
        Alert.alert('Dibatalkan', 'Penyimpanan dibatalkan.');
      } else {
        Alert.alert('Gagal menyimpan', 'Terjadi kesalahan saat menyimpan file.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const windowWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(windowWidth - 40, 280);

  const hasLineData = useMemo(() => dailySeries.some(point => point.expense > 0 || point.income > 0), [dailySeries]);

  const lineChartData = useMemo(() => {
    const step = Math.max(1, Math.ceil(dailySeries.length / 6));
    const labels = dailySeries.map((point, index) => (index % step === 0 ? point.day.toString() : ''));
    const expenseData = dailySeries.map(point => point.expense);
    const incomeData = dailySeries.map(point => point.income);

    return {
      labels,
      datasets: [
        {
          data: expenseData,
          color: () => colors.expenseLight,
          strokeWidth: 3,
        },
        {
          data: incomeData,
          color: () => colors.incomeLight,
          strokeWidth: 3,
        },
      ],
    };
  }, [dailySeries]);

  // Separate data for bar chart (interleaves income and expense for each day)
  const barChartData = useMemo(() => {
    const step = Math.max(1, Math.ceil(dailySeries.length / 6));
    
    // Create interleaved labels and data: Day1-Income, Day1-Expense, Day2-Income, Day2-Expense, etc.
    const labels: string[] = [];
    const data: number[] = [];
    const colors_array: ((opacity: number) => string)[] = [];
    
    dailySeries.forEach((point, index) => {
      const showLabel = index % step === 0;
      const dayLabel = showLabel ? point.day.toString() : '';
      
      // Add income bar
      labels.push(dayLabel);
      data.push(point.income);
      colors_array.push((opacity = 1) => colors.incomeLight);
      
      // Add expense bar
      labels.push('');
      data.push(point.expense);
      colors_array.push((opacity = 1) => colors.expenseLight);
    });

    return {
      labels,
      datasets: [
        {
          data,
          colors: colors_array,
        },
      ],
    };
  }, [dailySeries]);

  const lineChartConfig = useMemo(
    () => ({
      backgroundGradientFrom: colors.white,
      backgroundGradientTo: colors.white,
      color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
      decimalPlaces: 0,
      propsForDots: {
        r: '4',
        strokeWidth: '2',
        stroke: colors.white,
      },
      propsForBackgroundLines: {
        stroke: colors.border,
        strokeDasharray: '4 6',
      },
    }),
    []
  );

  const colorPalette = ['#F87171', '#34D399', '#60A5FA', '#FBBF24', '#A855F7', '#F97316', '#2DD4BF', '#94A3B8'];

  const pieSegments = useMemo(() => {
    return expenseByCategory
      .filter(item => item.key !== 'empty')
      .map((item, index) => ({
        key: item.key,
        label: item.x,
        value: item.y,
        color: colorPalette[index % colorPalette.length],
      }));
  }, [expenseByCategory, colorPalette]);

  const hasPieData = pieSegments.length > 0;

  const pieChartData = useMemo(() => {
    return pieSegments.map((segment) => ({
      name: segment.label,
      population: segment.value,
      color: segment.color,
      legendFontColor: colors.textPrimary,
      legendFontSize: 12,
    }));
  }, [pieSegments]);

  const pieChartConfig = useMemo(() => ({
    backgroundGradientFrom: colors.white,
    backgroundGradientTo: colors.white,
    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(30, 41, 59, ${opacity})`,
    decimalPlaces: 0,
  }), []);

  const formatYAxisLabel = (value: string) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return value;
    if (numeric >= 1_000_000) {
      const millions = numeric / 1_000_000;
      const formatted = millions.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
      return `${formatted}jt`;
    }
    if (numeric >= 1_000) {
      const thousands = numeric / 1_000;
      const formatted = thousands.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
      return `${formatted}rb`;
    }
    return numeric.toString();
  };

  const handleMonthChange = (direction: -1 | 1) => {
    setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const handleOpenMonthPicker = () => {
    setSelectedYear(cursor.getFullYear());
    setSelectedMonth(cursor.getMonth());
    setShowMonthPicker(true);
  };

  const handleApplyMonthPicker = () => {
    setCursor(new Date(selectedYear, selectedMonth, 1));
    setShowMonthPicker(false);
  };

  const handleResetToCurrentMonth = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    setCursor(startOfMonth(now));
    setShowMonthPicker(false);
  };

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const chartContentWidth = Math.max(chartWidth - 48, 260);
  const lineChartWidth = useMemo(
    () => Math.max(chartContentWidth, dailySeries.length * 40),
    [chartContentWidth, dailySeries.length]
  );

  // Bar chart needs double width since we have 2 bars per day
  const barChartWidth = useMemo(
    () => Math.max(chartContentWidth, dailySeries.length * 2 * 20),
    [chartContentWidth, dailySeries.length]
  );

  return (
    <Container contentContainerStyle={styles.content} refreshing={isLoading} onRefresh={refreshTransactions}>
        <View style={styles.card}>
          {/* <View style={styles.bookSwitcherContainer}>
            <BookSwitcher />
          </View> */}
          <View style={styles.cardHeader}>
            <TouchableOpacity style={styles.navButton} onPress={() => handleMonthChange(-1)}>
              <Ionicons name="chevron-back" size={18} color={colors.brand} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.monthLabelWrap} onPress={handleOpenMonthPicker} activeOpacity={0.7}>
              <Text style={styles.monthTitle}>{monthLabelFormatter.format(monthStart)}</Text>
              <Text style={styles.monthRange}>{`${dateFormatter.format(monthStart)} • ${dateFormatter.format(monthEnd)}`}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => handleMonthChange(1)}
              disabled={isSameMonth(cursor, startOfMonth(new Date()))}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={isSameMonth(cursor, startOfMonth(new Date())) ? colors.textSecondary : colors.brand}
              />
            </TouchableOpacity>
          </View>

        

          <AppBottomSheet
            isVisible={showMonthPicker}
            onClose={() => setShowMonthPicker(false)}
            title="Pilih Bulan & Tahun"
            enableContentPanningGesture={false}
          >
            <View style={styles.pickerContainer}>
              {/* Year Selector */}
              <View style={styles.yearSection}>
                <Text style={styles.pickerLabel}>Tahun</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.yearScrollContent}
                >
                  {years.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.yearChip, selectedYear === year && styles.yearChipSelected]}
                      onPress={() => setSelectedYear(year)}
                    >
                      <Text style={[styles.yearChipText, selectedYear === year && styles.yearChipTextSelected]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Month Grid */}
              <View style={styles.monthSection}>
                <Text style={styles.pickerLabel}>Bulan</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.monthScrollContent}
                >
                  {months.map((month, index) => (
                    <TouchableOpacity
                      key={month}
                      style={[styles.monthChip, selectedMonth === index && styles.monthChipSelected]}
                      onPress={() => setSelectedMonth(index)}
                    >
                      <Text style={[styles.monthChipText, selectedMonth === index && styles.monthChipTextSelected]}>
                        {month}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.applyButton} onPress={handleApplyMonthPicker}>
                <Text style={styles.applyButtonText}>Terapkan</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.resetButton} onPress={handleResetToCurrentMonth}>
                <Ionicons name="today-outline" size={18} color={colors.brand} />
                <Text style={styles.resetButtonText}>Bulan Ini</Text>
              </TouchableOpacity>
            </View>
          </AppBottomSheet>

          <BalanceCard
            balance={summary.balance}
            income={summary.income}
            expense={summary.expense}
            currency="IDR"
          />

          {/* Smart Insights */}
          <SmartInsights data={insightsData} currencyFormatter={currencyFormatter} />

          {/* <View style={styles.downloadRow}> */}
            {/* <TouchableOpacity 
              style={[styles.downloadButton, isExporting && styles.downloadButtonDisabled]} 
              onPress={() => handleExport('xlsx')} 
              activeOpacity={0.8}
              disabled={isExporting || filteredTransactions.length === 0}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="document-text-outline" size={18} color={colors.white} />
              )}
              <Text style={styles.downloadLabel}>Excel</Text>
            </TouchableOpacity> */}
            {/* <TouchableOpacity 
              style={[styles.downloadButton, styles.downloadButtonSecondary, isExporting && styles.downloadButtonSecondaryDisabled]} 
              onPress={() => handleExport('pdf')} 
              activeOpacity={0.8}
              disabled={isExporting || filteredTransactions.length === 0}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Ionicons name="download-outline" size={18} color={colors.brand} />
              )}
              <Text style={[styles.downloadLabel, styles.downloadLabelSecondary]}>PDF</Text>
            </TouchableOpacity> */}
          {/* </View> */}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderInline}>
            <Ionicons name="trending-up" size={20} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Tren</Text>
              <Text style={styles.sectionSubtitle}>Total pengeluaran/pemasukan harian selama bulan ini</Text>
            </View>
            {/* Chart Type Toggle */}
            <View style={styles.chartToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, chartType === 'line' && styles.toggleButtonActive]}
                onPress={() => setChartType('line')}
              >
                <Ionicons 
                  name="analytics-outline" 
                  size={16} 
                  color={chartType === 'line' ? colors.white : colors.textSecondary} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, chartType === 'bar' && styles.toggleButtonActive]}
                onPress={() => setChartType('bar')}
              >
                <Ionicons 
                  name="bar-chart-outline" 
                  size={16} 
                  color={chartType === 'bar' ? colors.white : colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {isCalculating || !showCharts ? (
            <View style={[styles.emptyStateWrap, { paddingVertical: 60 }]}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={{ marginTop: 12, color: colors.textSecondary }}>Memuat grafik...</Text>
            </View>
          ) : !hasLineData ? (
            <View style={styles.emptyStateWrap}>
              <EmptyState iconName="trending-down-outline" text="Belum ada data pengeluaran bulan ini." />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              style={styles.chartScroll}
              contentContainerStyle={styles.chartScrollContent}
            >
              {chartType === 'line' ? (
                <LineChart
                  data={lineChartData}
                  width={lineChartWidth}
                  height={220}
                  chartConfig={lineChartConfig}
                  withDots
                  withInnerLines
                  withOuterLines={false}
                  bezier
                  fromZero
                  segments={4}
                  formatYLabel={formatYAxisLabel}
                  formatXLabel={(value: string) => value}
                  style={styles.chartKit}
                />
              ) : (
                <BarChart
                  data={barChartData}
                  width={barChartWidth}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundGradientFrom: colors.white,
                    backgroundGradientTo: colors.white,
                    color: (opacity = 1) => colors.brand,
                    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                    decimalPlaces: 0,
                    barPercentage: 0.8,
                    fillShadowGradient: colors.brand,
                    fillShadowGradientOpacity: 1,
                    formatYLabel: formatYAxisLabel,
                    propsForBackgroundLines: {
                      stroke: colors.border,
                      strokeDasharray: '4 6',
                    },
                  }}
                  withInnerLines={true}
                  fromZero={true}
                  showValuesOnTopOfBars={false}
                  withCustomBarColorFromData={true}
                  flatColor={true}
                  style={styles.chartKit}
                />
              )}
            </ScrollView>
          )}
          {hasLineData ? (
            <View style={styles.legendRowInline}>
              <View style={styles.legendItemInline}>
                <View style={[styles.legendDot, chartType === 'line' ? styles.legendDotExpense : styles.legendDotIncome]} />
                <Text style={styles.legendLabelInline}>{chartType === 'line' ? 'Pengeluaran' : 'Pemasukan'}</Text>
              </View>
              <View style={styles.legendItemInline}>
                <View style={[styles.legendDot, chartType === 'line' ? styles.legendDotIncome : styles.legendDotExpense]} />
                <Text style={styles.legendLabelInline}>{chartType === 'line' ? 'Pemasukan' : 'Pengeluaran'}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderInline}>
            <Ionicons name="pie-chart" size={20} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Kategori</Text>
              <Text style={styles.sectionSubtitle}>Distribusi pengeluaran berdasarkan kategori</Text>
            </View>
          </View>

          {isCalculating || !showCharts ? (
            <View style={[styles.emptyStateWrap, { paddingVertical: 60 }]}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={{ marginTop: 12, color: colors.textSecondary }}>Memuat grafik...</Text>
            </View>
          ) : !hasPieData ? (
            <View style={styles.emptyStateWrap}>
              <EmptyState iconName="pie-chart-outline" text="Belum ada data kategori bulan ini." />
            </View>
          ) : (
            <>
              {/* Pie Chart Centered as Doughnut */}
              <View style={styles.pieChartContainer}>
                <View style={[styles.pieChartWrap, { width: chartContentWidth, height: 220 }]}> 
                  <PieChart
                    data={pieChartData}
                    width={chartContentWidth}
                    height={220}
                    accessor="population"
                    backgroundColor="transparent"
                    chartConfig={pieChartConfig}
                    paddingLeft="0"
                    center={[chartContentWidth / 2 - 85, 0]}
                    hasLegend={false}
                    absolute
                    avoidFalseZero
                  />
                  {/* Segment separators overlay */}
                  <Svg
                    style={styles.pieOverlay}
                    width={chartContentWidth}
                    height={220}
                  >
                    {(() => {
                      const total = pieSegments.reduce((sum, s) => sum + s.value, 0) || 1;
                      const cx = chartContentWidth / 2;
                      const cy = 220 / 2;
                      const r = Math.min(chartContentWidth, 220) / 2 - 4; // match actual outer radius
                      const base = -Math.PI / 2; // start from top
                      const eps = 0.0001; // tiny offset so last line still renders
                      let acc = 0;
                      const lines: React.ReactNode[] = [];
                      // Separator between segments (not after the last one to avoid duplicate)
                      pieSegments.forEach((seg, idx) => {
                        const angle = (seg.value / total) * Math.PI * 2;
                        acc += angle;
                        // Only draw separator if not the last segment
                        if (idx < pieSegments.length - 1) {
                          const a = base + acc - eps;
                          const x2 = cx + r * Math.cos(a);
                          const y2 = cy + r * Math.sin(a);
                          lines.push(
                            <Line
                              key={`sep-${idx}`}
                              x1={cx}
                              y1={cy}
                              x2={x2}
                              y2={y2}
                              stroke={colors.white}
                              strokeWidth={5}
                              strokeLinecap="round"
                            />
                          );
                        }
                      });
                      return lines;
                    })()}
                  </Svg>
                  {/* Donut hole overlay */}
                  <View
                    style={[
                      styles.donutHole,
                      {
                        width: 100,
                        height: 100,
                        borderRadius: 50,
                        left: chartContentWidth / 2 - 50,
                        top: 220 / 2 - 50,
                      },
                    ]}
                  />
                  {/* Center amount (total expense) */}
                  <View style={styles.pieCenterOverlay}>
                    <Text style={styles.pieCenterAmount}>{currencyFormatter.format(summary.expense)}</Text>
                    <Text style={styles.pieCenterSub}>{monthlyExpenseCount} transaksi</Text>
                  </View>
                </View>
              </View>

              {/* Category Breakdown */}
              <View style={styles.categoryBreakdown}>
                {pieSegments.map(item => {
                  const totalExpense = pieSegments.reduce((sum, seg) => sum + seg.value, 0);
                  const percentage = (item.value / totalExpense) * 100;
                  const percentageText = percentage.toFixed(1);
                  
                  return (
                    <View key={item.key} style={styles.categoryItem}>
                      <Text style={styles.categoryName}>{item.label}</Text>
                      <View style={styles.categoryBarRow}>
                        <View style={styles.categoryBarBackground}>
                          <View style={{ flexDirection: 'row', width: '100%' }}>
                            <View 
                              style={[
                                styles.categoryBarFill, 
                                { flex: percentage, backgroundColor: item.color }
                              ]} 
                            />
                            <View style={{ flex: 100 - percentage }} />
                          </View>
                        </View>
                        <Text style={styles.categoryPercentage}>{percentageText}%</Text>
                      </View>
                      {/* <Text style={styles.categoryAmount}>{currencyFormatter.format(item.value)}</Text> */}
                    </View>
                  );
                })}
              </View>
            </>
          )}
          {/* Save to device actions (Android) */}
        <View style={styles.card}>
          <View style={styles.downloadRow}>
            <TouchableOpacity 
              style={[styles.downloadButton, isExporting && styles.downloadButtonDisabled]} 
              onPress={() => handleSaveToDevice('xlsx')} 
              activeOpacity={0.8}
              disabled={isExporting || filteredTransactions.length === 0 || Platform.OS !== 'android'}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="save-outline" size={18} color={colors.white} />
              )}
              <Text style={styles.downloadLabel}>Simpan Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.downloadButton, styles.downloadButtonSecondary, isExporting && styles.downloadButtonSecondaryDisabled]} 
              onPress={() => handleSaveToDevice('pdf')} 
              activeOpacity={0.8}
              disabled={isExporting || filteredTransactions.length === 0 || Platform.OS !== 'android'}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Ionicons name="save-outline" size={18} color={colors.brand} />
              )}
              <Text style={[styles.downloadLabel, styles.downloadLabelSecondary]}>Simpan PDF</Text>
            </TouchableOpacity>
          </View>
          {/* Share row */}
          <View style={[styles.downloadRow, { marginTop:0}]}>
            <TouchableOpacity 
              style={[styles.downloadButton, styles.downloadButtonSecondary, { flex: 1 }, isExporting && styles.downloadButtonSecondaryDisabled]} 
              onPress={() => handleExport('pdf')} 
              activeOpacity={0.8}
              disabled={isExporting || filteredTransactions.length === 0}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Ionicons name="share-outline" size={18} color={colors.brand} />
              )}
              <Text style={[styles.downloadLabel, styles.downloadLabelSecondary]}>Bagikan PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
    </Container>
  );
}

export default memo(ReportComponent);

const styles = StyleSheet.create({
  content: {
    marginTop: 16,
    paddingHorizontal: 0,
    paddingBottom: 32,
    gap: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    // borderWidth: StyleSheet.hairlineWidth,
    // borderColor: colors.border,
    // padding: 16,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHeaderInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  monthLabelWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  monthRange: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyStateWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartScroll: {
    marginHorizontal: -8,
  },
  chartScrollContent: {
    paddingHorizontal: 8,
  },
  legend: {
    marginTop: 12,
    gap: 10,
    paddingHorizontal: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendRowInline: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  legendItemInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotExpense: {
    backgroundColor: colors.expenseLight,
  },
  legendDotIncome: {
    backgroundColor: colors.incomeLight,
  },
  legendTextWrap: {
    flex: 1,
  },
  legendLabelInline: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    marginTop: 12,
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  downloadButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  downloadButtonSecondary: {
    backgroundColor: colors.incomeBg,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  downloadButtonSecondaryDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.textSecondary,
    opacity: 0.5,
  },
  downloadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  downloadLabelSecondary: {
    color: colors.brand,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  legendValue: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chartKit: {
    marginLeft: -8,
  },
  pieChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  pieOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  donutHole: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderRadius: 60,
  },
  pieCenterOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  pieCenterAmount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  categoryBreakdown: {
    marginTop: 16,
    gap: 20,
  },
  categoryItem: {
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  categoryBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: 8,
    borderRadius: 4,
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 4,
  },
  categoryPercentage: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    minWidth: 45,
    textAlign: 'right',
  },
  pickerContainer: {
    gap: 24,
    marginBottom: 20,
  },
  yearSection: {
    gap: 12,
  },
  monthSection: {
    gap: 12,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  yearScrollContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  yearChip: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 90,
  },
  yearChipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  yearChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  yearChipTextSelected: {
    color: colors.white,
  },
  monthScrollContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  monthChip: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 110,
  },
  monthChipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  monthChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  monthChipTextSelected: {
    color: colors.white,
  },
  buttonContainer: {
    gap: 12,
  },
  applyButton: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  resetButtonText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '600',
  },
  bookSwitcherContainer: {
    alignItems: 'flex-end',
    // marginBottom: 16,
  },
  pieChartWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: colors.surface,
  },
  pieCenterSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  chartToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.brand,
  },
});
