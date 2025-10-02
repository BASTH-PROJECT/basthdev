import AppBottomSheet from '@/components/BottomSheet';
import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TransactionActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  transactionNote?: string;
  transactionCategory?: string;
}

export default function TransactionActionSheet({
  visible,
  onClose,
  onEdit,
  onDelete,
  transactionNote,
  transactionCategory,
}: TransactionActionSheetProps) {
  return (
    <AppBottomSheet
      isVisible={visible}
      onClose={onClose}
      title="Pilih Aksi"
      snapPoints={['45%']}
    >
      <View style={styles.content}>
        {/* Subtitle */}
        {(transactionNote || transactionCategory) && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {transactionCategory && `${transactionCategory}`}
            {transactionCategory && transactionNote && ' • '}
            {transactionNote}
          </Text>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {/* Edit Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              onClose();
              setTimeout(onEdit, 300);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, styles.editIconWrap]}>
              <Ionicons name="create-outline" size={24} color={colors.brand} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Edit Transaksi</Text>
              <Text style={styles.actionDescription}>
                Ubah jumlah, kategori, atau catatan
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              onClose();
              setTimeout(onDelete, 300);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, styles.deleteIconWrap]}>
              <Ionicons name="trash-outline" size={24} color={colors.danger} />
            </View>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, styles.deleteText]}>
                Hapus Transaksi
              </Text>
              <Text style={styles.actionDescription}>
                Hapus transaksi ini secara permanen
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Batal</Text>
        </TouchableOpacity>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    // paddingHorizontal: 20,
    // paddingBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  editIconWrap: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  deleteIconWrap: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  deleteText: {
    color: colors.danger,
  },
  actionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cancelButton: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
