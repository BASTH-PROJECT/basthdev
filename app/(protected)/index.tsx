import BalanceCard from '@/components/BalanceCard';
import BookSwitcher from '@/components/BookSwitcher';
import AppBottomSheet from '@/components/BottomSheet';
import Container from '@/components/Container';
import FAB from '@/components/FAB';
import CreateForm, { TxType } from '@/components/form/CreateForm';
// import Header from '@/components/header';
import { useGreeting } from '@/components/greeting';
import Skeleton from '@/components/Skeleton';
import TRList from '@/components/TRList';
import { useBooks } from '@/contexts/BookContext';
import { useTransactions } from '@/contexts/TransactionContext';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/styles/colors';
import * as Linking from 'expo-linking';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  const { user } = useUser();
  const { activeBook, isLoading: isBookLoading } = useBooks();
  const {
    transactions,
    summary,
    isLoading: isTxLoading,
    addTransaction,
    refreshTransactions,
  } = useTransactions();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [initialTransactionType, setInitialTransactionType] = useState<TxType | undefined>();
  const hasProcessedInitialUrl = useRef(false);

  const greeting = useGreeting();

  // Handle deep links from Android shortcuts - only process once on mount
  useEffect(() => {
    // Only check initial URL once
    if (hasProcessedInitialUrl.current) return;

    // Small delay to let Expo Router process the URL first
    const timer = setTimeout(() => {
      Linking.getInitialURL().then((url) => {
        if (url) {
          hasProcessedInitialUrl.current = true;
          const { queryParams } = Linking.parse(url);
          const type = queryParams?.type as string;
          
          if (type === 'income' || type === 'expense') {
            // Add delay to ensure app is fully loaded
            setTimeout(() => {
              setInitialTransactionType(type as TxType);
              setCreateOpen(true);
            }, 500);
          }
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleSaveTransaction = async (
    payload: {
      type: TxType;
      amount: number;
      category: string | null;
      note?: string;
    },
    continueAfter: boolean
  ) => {
    if (!activeBook || !payload.category) return;
    await addTransaction(payload.type, payload.amount, payload.category, payload.note);
    if (!continueAfter) {
      setCreateOpen(false);
    }
  };

  return (
    <View style={styles.screenContainer}>
      <Container refreshing={isTxLoading} onRefresh={refreshTransactions}>
        {/* <Header /> */}
          <View style={styles.topBar}>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>{greeting},</Text>
              {user ? (
                <Text style={styles.name}>{user.name}</Text>
              ) : (
                <Skeleton width={120} height={24} />
              )}
            </View>
            {isBookLoading ? <Skeleton width={120} height={35} /> : <BookSwitcher />}
          </View>

          {isTxLoading ? (
            <Skeleton width="100%" height={150} />
          ) : (
            <BalanceCard
              balance={summary.balance}
              income={summary.income}
              expense={summary.expense}
              currency="IDR"
            />
          )}

          <View style={styles.trListContainer}>
            <TRList items={transactions} currency="IDR" />
          </View>
      </Container>

      {activeBook && <FAB onPress={() => setCreateOpen(true)} />}

      <AppBottomSheet
        isVisible={isCreateOpen}
        onClose={() => {
          setCreateOpen(false);
          setInitialTransactionType(undefined);
        }}
        title="Tambah Transaksi"
      >
        <CreateForm
          onCancel={() => {
            setCreateOpen(false);
            setInitialTransactionType(undefined);
          }}
          onSaved={handleSaveTransaction}
          initialType={initialTransactionType}
        />
      </AppBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  topBar: {
    marginTop: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: -2,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.brand,
  },
  greetingContainer: {
  },
  trListContainer: {
    marginTop: 16,
  },
  trTitle: {
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
    borderColor: colors.border,
  },
  rowCenter: { flex: 1 },
  note: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  date: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  separator: { height: 1, backgroundColor: colors.surface },
  loadingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 40,
    fontSize: 14,
  },
});