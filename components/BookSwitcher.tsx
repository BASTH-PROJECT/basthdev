import { useBooks } from '@/contexts/BookContext';
import { Book } from '@/services/database';
import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppBottomSheet from './BottomSheet';
import EmptyState from './EmptyState';
import CreateBookForm from './form/CreateBookForm';
import EditBookForm from './form/EditBookForm';

export default function BookSwitcher() {
  const { books, activeBook, setActiveBook, deleteBook, isLoading } = useBooks();
  const [isBookListVisible, setBookListVisible] = useState(false);
  const [isCreateSheetVisible, setCreateSheetVisible] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isEditSheetVisible, setEditSheetVisible] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const activeName = useMemo(() => activeBook?.name || 'Tidak ada buku', [activeBook]);

  const handleSelect = (bookId: number) => {
    const b = books.find(b => b.id === bookId);
    if (b) setActiveBook(b);
    setBookListVisible(false);
  };

  const handleEditPress = (book: Book) => {
    setEditingBook(book);
    setBookListVisible(false);
    setEditSheetVisible(true);
  };

  const closeEditSheet = () => {
    setEditSheetVisible(false);
    setEditingBook(null);
  };

  const handleDelete = async (bookId: number) => {
    const target = books.find(b => b.id === bookId);
    if (!target) return;
    // Prevent deleting the last remaining book
    if (books.length <= 0) {
      Alert.alert(
        'Tidak bisa dihapus',
        'Minimal harus ada satu buku. Buat buku baru terlebih dahulu sebelum menghapus ini.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Buat Buku Baru',
            onPress: () => {
              setBookListVisible(false);
              setCreateSheetVisible(true);
            },
          },
        ]
      );
      return;
    }
    Alert.alert(
      'Hapus Buku',
      `Yakin ingin menghapus buku "${target.name}"? Semua transaksi di buku ini juga akan terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(bookId);
              // Proceed with deletion; BookContext will auto-switch active book after delete
              await deleteBook(bookId);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setBookListVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Switch book"
      >
        <View style={styles.left}>
          <Ionicons name="book-outline" size={20} color={colors.brand} />
          <Text style={styles.text} numberOfLines={1}>{activeName}</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Book List Bottom Sheet */}
      <AppBottomSheet
        isVisible={isBookListVisible}
        onClose={() => setBookListVisible(false)}
        title="Buku Anda"
        noScrollView
        snapPoints={['50%', '90%']}
        initialIndex={1}
      >
        <BottomSheetFlatList
          data={books}
          keyExtractor={(item: Book) => String(item.id)}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }: { item: Book }) => (
            <View style={styles.row}>
              <TouchableOpacity style={styles.rowLeft} onPress={() => handleSelect(item.id)}>
                <Ionicons name={activeBook?.id === item.id ? 'book' : 'book-outline'} size={20} color={colors.brand} />
                <Text style={[styles.rowText, activeBook?.id === item.id && styles.rowTextActive]} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  onPress={() => handleEditPress(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit buku"
                  style={styles.actionBtn}
                >
                  <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Hapus buku"
                  style={styles.actionBtn}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState iconName="book-outline" text="Tidak ada buku" />}
          contentContainerStyle={styles.sheetContent}
        />
        <View style={styles.sheetContent}>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => {
              setBookListVisible(false);
              setCreateSheetVisible(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.white} />
            <Text style={styles.createBtnText}>Buat Buku Baru</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>

      {/* Create Book Bottom Sheet */}
      <AppBottomSheet
        isVisible={isCreateSheetVisible}
        onClose={() => setCreateSheetVisible(false)}
        title="Buat Buku Baru"
        snapPoints={['30%', '60%']}
        initialIndex={0}
      >
        <CreateBookForm onSuccess={() => setCreateSheetVisible(false)} />
      </AppBottomSheet>

      {/* Edit Book Bottom Sheet */}
      <AppBottomSheet
        isVisible={isEditSheetVisible && !!editingBook}
        onClose={closeEditSheet}
        title="Edit Buku"
        snapPoints={['30%', '60%']}
        initialIndex={0}
      >
        {editingBook ? (
          <EditBookForm
            bookId={editingBook.id}
            currentName={editingBook.name}
            onSuccess={closeEditSheet}
            onCancel={closeEditSheet}
          />
        ) : null}
      </AppBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 35,
    maxWidth: 200,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 4,
  },
  text: {
    color: colors.brand,
    fontWeight: '700',
    maxWidth: 130,
  },
  sheetContent: {
    paddingHorizontal: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  rowText: {
    color: colors.textSecondary,
    fontWeight: '600',
    maxWidth: 220,
  },
  rowTextActive: {
    color: colors.brand,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    paddingHorizontal: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginVertical: 12,
  },
  createBtn: {
    backgroundColor: colors.brand,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  createBtnText: {
    color: colors.white,
    fontWeight: '800',
  },
});
