import AppBottomSheet from '@/components/BottomSheet';
import Container from '@/components/Container';
import EmptyState from '@/components/EmptyState';
import TransactionSearchBar from '@/components/TransactionSearchBar';
import CreateForm, { TransactionData } from '@/components/form/CreateForm';
import { CATEGORY_META } from '@/constants/categories';
import { isTransactionEditable } from '@/constants/editPermissions';
import { useTransactions } from '@/contexts/TransactionContext';
import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
function formatCurrency(value: number, currency: string = 'IDR') {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString('id-ID')}`;
  }
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const LONG_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

function formatShortDate(date: Date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

type TransactionsArray = ReturnType<typeof useTransactions>['transactions'];
type TransactionItem = TransactionsArray[number];
type TransactionSection = { key: string; title: string; data: TransactionsArray };
type SectionsCache = {
  transactionsRef: TransactionsArray;
  sections: TransactionSection[];
  hasTransactions: boolean;
};

interface TransactionRowProps {
  item: TransactionItem;
  sectionKey: string;
  onLongPress: (item: TransactionItem) => void;
  onDelete: (item: TransactionItem) => void;
}

const TransactionRow = memo(({ item, sectionKey, onLongPress, onDelete }: TransactionRowProps) => {
  const isIncome = item.type === 'income';
  const categoryInfo = CATEGORY_META.find(c => c.key === item.category);
  const icon = categoryInfo?.icon || 'card-outline';
  const label = categoryInfo?.label || 'Tanpa Kategori';
  const canEdit = isTransactionEditable(item.created_at);
  const leftThreshold = Math.round(Dimensions.get('window').width * 0.2);
  const swipeRef = React.useRef<Swipeable | null>(null);

  const renderMeta = useCallback(() => {
    const date = new Date(item.created_at);
    const formatter = sectionKey === 'today' || sectionKey === 'yesterday' ? TIME_FORMAT : LONG_DATE_FORMAT;
    const localized = new Intl.DateTimeFormat('id-ID', formatter).format(date);
    if (item.note?.trim()) {
      return `${localized} • ${item.note.trim()}`;
    }
    return localized;
  }, [item.created_at, item.note, sectionKey]);

  const renderLeftActions = () => (
    <View style={styles.leftAction}>
      <Ionicons name="trash-outline" size={20} color={colors.white} />
      <Text style={styles.leftActionText}>Geser untuk menghapus</Text>
    </View>
  );

  const handleSwipeOpen = () => {
    Alert.alert(
      'Hapus Transaksi',
      'Apakah Anda yakin ingin menghapus transaksi ini?',
      [
        {
          text: 'Batal',
          style: 'cancel',
          onPress: () => swipeRef.current?.close(),
        },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            onDelete(item);
            swipeRef.current?.close();
          },
        },
      ]
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeftActions}
      leftThreshold={leftThreshold}
      overshootLeft={false}
      onSwipeableOpen={handleSwipeOpen}
    >
      <Pressable 
        style={styles.row}
        onLongPress={canEdit ? () => onLongPress(item) : undefined}
        delayLongPress={500}
      >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: isIncome ? colors.incomeBg : colors.expenseBg,
            borderColor: isIncome ? colors.incomeBorder : colors.expenseBorder,
          },
        ]}
      >
        <Ionicons name={icon as any} size={18} color={isIncome ? colors.income : colors.expense} />
      </View>
      <View style={styles.rowCenter}>
        <Text style={styles.note}>{label}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {renderMeta()}
        </Text>
      </View>
      <Text style={[styles.amount, { color: isIncome ? colors.income : colors.expense }]}>
        {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
      </Text>
      {/* {canEdit && (
        <View style={styles.editIndicator}>
          <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
        </View>
      )} */}
      </Pressable>
    </Swipeable>
  );
});

TransactionRow.displayName = 'TransactionRow';

function TransactionComponent() {
  const { transactions, isLoading, refreshTransactions, updateTransaction, deleteTransaction } = useTransactions();
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const sectionsCacheRef = useRef<SectionsCache | null>(null);

  // Filter transactions based on search query
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) {
      return transactions;
    }

    const query = searchQuery.toLowerCase();
    return transactions.filter(tx => {
      const categoryInfo = CATEGORY_META.find(c => c.key === tx.category);
      const categoryLabel = categoryInfo?.label || '';
      const note = tx.note || '';
      const amount = tx.amount.toString();
      
      return (
        categoryLabel.toLowerCase().includes(query) ||
        note.toLowerCase().includes(query) ||
        amount.includes(query)
      );
    });
  }, [transactions, searchQuery]);

  const { sections, hasTransactions } = useMemo<SectionsCache>(() => {
    const cache = sectionsCacheRef.current;
    if (cache && cache.transactionsRef === filteredTransactions && !searchQuery) {
      return cache;
    }

    const todayStart = startOfDay(new Date());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const today: typeof filteredTransactions = [];
    const yesterday: typeof filteredTransactions = [];
    const earlier: typeof filteredTransactions = [];

    [...filteredTransactions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach(tx => {
        const txDate = new Date(tx.created_at);
        if (isSameDay(txDate, todayStart)) {
          today.push(tx);
        } else if (isSameDay(txDate, yesterdayStart)) {
          yesterday.push(tx);
        } else {
          earlier.push(tx);
        }
      });

    const earlierGroups = earlier.reduce<Map<string, { date: Date; data: typeof transactions }>>((groups, tx) => {
      const dayStart = startOfDay(new Date(tx.created_at));
      const key = dayStart.toISOString();
      if (!groups.has(key)) {
        groups.set(key, { date: dayStart, data: [] });
      }
      groups.get(key)!.data.push(tx);
      return groups;
    }, new Map());

    const earlierSections = Array.from(earlierGroups.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(group => ({
        key: `day-${group.date.toISOString()}`,
        title: formatShortDate(group.date),
        data: group.data,
      }));

    const computedSections: TransactionSection[] = [
      { key: 'today', title: `Hari ini (${formatShortDate(todayStart)})`, data: today },
      // Only include 'Kemarin' if it has data
      ...(yesterday.length > 0
        ? [{ key: 'yesterday', title: `Kemarin (${formatShortDate(yesterdayStart)})`, data: yesterday }]
        : []),
      ...earlierSections,
    ];

    const result: SectionsCache = {
      transactionsRef: filteredTransactions,
      sections: computedSections,
      hasTransactions: filteredTransactions.length > 0,
    };
    if (!searchQuery.trim()) {
      sectionsCacheRef.current = result;
    }
    return result;
  }, [filteredTransactions, searchQuery]);

  useEffect(() => {
    setCollapsedSections(prev => {
      const next: Record<string, boolean> = {};

      sections.forEach(section => {
        next[section.key] = prev[section.key] ?? (section.key !== 'today');
      });

      return next;
    });
  }, [sections]);

  const isSectionCollapsed = useCallback(
    (sectionKey: string) => collapsedSections[sectionKey] ?? (sectionKey !== 'today'),
    [collapsedSections]
  );

  // Always show at least the 'Hari ini' section. If no transactions at all, show an empty 'Hari ini'.
  const displaySections = hasTransactions
    ? sections
    : sections.length > 0
      ? [{ key: 'today', title: sections[0].title, data: [] }]
      : [{ key: 'today', title: `Hari ini (${formatShortDate(startOfDay(new Date()))})`, data: [] }];

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [key]: !(prev[key] ?? (key !== 'today')),
    }));
  }, []);

  const handleLongPress = useCallback((item: TransactionItem) => {
    console.log('[TRANSACTION] Long press edit:', item);
    setEditingTransaction(item);
    setEditSheetOpen(true);
  }, []);

  const handleUpdateTransaction = useCallback(async (payload: {
    id: number;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    note?: string;
  }) => {
    console.log('[TRANSACTION] Updating transaction:', payload);
    await updateTransaction(payload.id, payload.type, payload.amount, payload.category, payload.note || '');
    setEditSheetOpen(false);
    setEditingTransaction(null);
  }, [updateTransaction]);

  const handleSwipeDelete = useCallback(async (item: TransactionItem) => {
    try {
      await deleteTransaction(item.id);
    } catch (e) {
      console.log('[TRANSACTION] Swipe delete failed:', e);
    }
  }, [deleteTransaction]);

  const renderItem = useCallback(({ item, section }: { item: TransactionItem; section: TransactionSection }) => {
    if (isSectionCollapsed(section.key)) {
      return null;
    }
    return <TransactionRow item={item} sectionKey={section.key} onLongPress={handleLongPress} onDelete={handleSwipeDelete} />;
  }, [isSectionCollapsed, handleLongPress, handleSwipeDelete]);

  const renderSectionHeader = useCallback(({ section }: { section: TransactionSection }) => {
    const isCollapsed = isSectionCollapsed(section.key);
    return (
      <View style={styles.section}>
        <Pressable style={styles.sectionHeaderRow} onPress={() => toggleSection(section.key)}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionHeaderLine} />
          <Ionicons
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>
    );
  }, [isSectionCollapsed, toggleSection]);

  const renderSectionFooter = useCallback(({ section }: { section: TransactionSection }) => {
    if (isSectionCollapsed(section.key)) {
      return null;
    }
    if (section.data.length === 0) {
      return (
        <View style={[styles.sectionFooterGap, { paddingVertical: 16 }]}> 
          <EmptyState iconName="receipt-outline" text={section.key === 'today' ? 'Belum ada transaksi hari ini' : 'Tidak ada transaksi.'} />
        </View>
      );
    }
    return <View style={styles.sectionFooterGap} />;
  }, [isSectionCollapsed]);

  const renderItemSeparator = useCallback(({ section }: { section: TransactionSection }) => (
    isSectionCollapsed(section.key) ? null : <View style={styles.itemSeparator} />
  ), [isSectionCollapsed]);

  const editTransactionData: TransactionData | undefined = editingTransaction ? {
    id: editingTransaction.id,
    type: editingTransaction.type,
    amount: editingTransaction.amount,
    category: editingTransaction.category,
    note: editingTransaction.note,
    created_at: editingTransaction.created_at,
  } : undefined;

  return (
    <Container scroll={false}>
      {/* Search Bar */}
      <TransactionSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Cari transaksi..."
      />

      {/* Transaction List */}
      <SectionList
        sections={displaySections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        stickySectionHeadersEnabled={false}
        refreshing={isLoading}
        onRefresh={refreshTransactions}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyStateWrap}>
            <EmptyState 
              iconName="receipt-outline" 
              text={searchQuery ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi'} 
            />
          </View>
        )}
        ItemSeparatorComponent={renderItemSeparator}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Edit Transaction Bottom Sheet */}
      <AppBottomSheet
        isVisible={editSheetOpen}
        onClose={() => {
          setEditSheetOpen(false);
          setEditingTransaction(null);
        }}
        title="Edit Transaksi"
      >
        {editTransactionData && (
          <CreateForm
            key={editTransactionData.id} // Force remount with new data
            editMode
            initialData={editTransactionData}
            onUpdate={handleUpdateTransaction}
            onCancel={() => {
              setEditSheetOpen(false);
              setEditingTransaction(null);
            }}
          />
        )}
      </AppBottomSheet>
    </Container>
  );
}

export default memo(TransactionComponent);
const styles = StyleSheet.create({
  leftAction: {
    flex: 1,
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  leftActionText: {
    color: colors.white,
    fontWeight: '700',
  },
  listContent: {
    paddingTop: 8,
  },
  section: {
    // marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  sectionHeaderLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth + 1,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptySectionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  sectionFooterGap: {
    // marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 12,
    marginLeft: 10,
  },
  rowCenter: {
    flex: 1,
  },
  note: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 10,
  },
  itemSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  },
  sectionSeparator: {
    height: 16,
  },
  emptyStateWrap: {
    marginTop: 48,
    paddingHorizontal: 20,
  },
  editIndicator: {
    marginLeft: 8,
    opacity: 0.5,
  },
});