import { CATEGORY_META } from '@/constants/categories';
import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type TxType = 'income' | 'expense';

export interface TransactionData {
  id?: number;
  type: TxType;
  amount: number;
  category: string;
  note?: string;
  created_at?: string;
}

interface CreateFormProps {
  onCancel?: () => void;
  onSaved?: (payload: {
    type: TxType;
    amount: number;
    category: string | null;
    note?: string;
    createdAt: string;
  }, continueAfter: boolean) => void;
  editMode?: boolean;
  initialData?: TransactionData;
  initialType?: TxType;
  onUpdate?: (payload: {
    id: number;
    type: TxType;
    amount: number;
    category: string;
    note?: string;
  }) => void;
}

// Helper function to format amount input
const formatAmountInput = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) {
    return '';
  }
  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Helper function for auto-capitalization
const capitalizeEachWord = (text: string) => {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function CreateForm({ onCancel, onSaved, editMode = false, initialData, initialType, onUpdate }: CreateFormProps) {
  const [type, setType] = useState<TxType>(initialData?.type || initialType || 'expense');
  const [amount, setAmount] = useState(initialData ? formatAmountInput(initialData.amount.toString()) : '');
  const [category, setCategory] = useState<string | null>(initialData?.category || null);
  const [note, setNote] = useState(initialData?.note || '');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  //  for dev edit
  const [continueMessageVisible, setContinueMessageVisible] = useState(false);
  // 
  const continueMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update type when initialType changes (for shortcuts)
  useEffect(() => {
    if (initialType && !initialData) {
      console.log('Setting type from initialType:', initialType);
      console.log('Current type state:', type);
      setType(initialType);
      // Force re-render by also resetting category when type changes
      setCategory(null);
    }
  }, [initialType, initialData]);

  // Debug log to track type changes
  useEffect(() => {
    console.log('Type state changed to:', type);
  }, [type]);

  const categories = useMemo(() => CATEGORY_META.filter(c => c.type === type), [type]);
  const accent = useMemo(() => (type === 'income' ? colors.income : colors.expense), [type]);

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategory(null);
    setNote('');
    setNoteError(null);
    setAmountError(null);
    setCategoryError(null);
    setContinueMessageVisible(false);
    if (continueMessageTimer.current) {
      clearTimeout(continueMessageTimer.current);
      continueMessageTimer.current = null;
    }
  };

  // Sync fields when entering edit mode or when initialData changes
  useEffect(() => {
    if (editMode && initialData) {
      console.log('[CreateForm] Populating edit data:', initialData);
      setType(initialData.type);
      setAmount(formatAmountInput((initialData.amount ?? 0).toString()));
      setCategory(initialData.category ?? null);
      setNote(initialData.note ?? '');
      // clear errors on new payload
      setAmountError(null);
      setCategoryError(null);
      setNoteError(null);
    } else if (!editMode && !initialType) {
      // Only reset form when not in edit mode AND no initialType from shortcut
      console.log('[CreateForm] Resetting form (no initialType)');
      resetForm();
    }
  }, [editMode, initialData, initialType]);

  const parseAmount = () => {
    const digitsOnly = amount.replace(/\D/g, '');
    const n = Number(digitsOnly);
    return Number.isNaN(n) ? 0 : n;
  };
  const handleSave = (continueAfter: boolean) => {
    // Validate
    const amt = parseAmount();
    const validAmount = amt > 0;
    const validCategory = !!category;
    const trimmedNote = note.trim();
    // Capitalize first letter of note when saving
    const capitalizedNote = trimmedNote.charAt(0).toUpperCase() + trimmedNote.slice(1);
    const validNote = trimmedNote.length > 0;
    setAmountError(validAmount ? null : 'Masukkan jumlah yang lebih dari 0');
    setCategoryError(validCategory ? null : 'Pilih kategori');
    setNoteError(validNote ? null : 'Catatan tidak boleh kosong');
    if (!validAmount || !validCategory || !validNote) {
      return;
    }

    // Edit mode - update existing transaction
    if (editMode && initialData?.id && onUpdate) {
      const updatePayload = {
        id: initialData.id,
        type,
        amount: amt,
        category: category!,
        note: capitalizedNote,
      };
      console.log('[CreateForm] Update transaction:', updatePayload);
      onUpdate(updatePayload);
      return;
    }

    // Create mode - add new transaction
    const payload = {
      type,
      amount: amt,
      category,
      note: capitalizedNote,
      createdAt: new Date().toISOString(),
    };
    console.log('[CreateForm] Save transaction:', payload);
    onSaved?.(payload, continueAfter);
    if (continueAfter) {
      resetForm();
      // keep sheet open on Save & Continue
      setContinueMessageVisible(true);
      if (continueMessageTimer.current) {
        clearTimeout(continueMessageTimer.current);
      }
      continueMessageTimer.current = setTimeout(() => {
        setContinueMessageVisible(false);
        continueMessageTimer.current = null;
      }, 3000);
    } else {
      setContinueMessageVisible(false);
      if (continueMessageTimer.current) {
        clearTimeout(continueMessageTimer.current);
        continueMessageTimer.current = null;
      }
    }
  };

  return (
      <View style={styles.content}>
        {/* Type selector */}
        <View style={styles.segmentWrap}>
          <TouchableOpacity
            style={[styles.segment, type === 'income' && styles.segmentActive]}
            onPress={() => setType('income')}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up-circle" size={18} color={type === 'income' ? colors.income : colors.textSecondary} />
            <Text style={[styles.segmentText, type === 'income' && styles.incomeSegmentTextActive]}>Pemasukan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, type === 'expense' && styles.segmentActive]}
            onPress={() => setType('expense')}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-down-circle" size={18} color={type === 'expense' ? colors.expense : colors.textSecondary} />
            <Text style={[styles.segmentText, type === 'expense' && styles.expenseSegmentTextActive]}>Pengeluaran</Text>
          </TouchableOpacity>
        </View>

        {continueMessageVisible ? (
          <View style={styles.continueMessageBox}>
            <View style={styles.continueMessageTextWrap}>
              <Text style={styles.continueMessageText}>Transaksi tersimpan.</Text>
              <Text style={styles.continueMessageText}>Lanjutkan penambahan transaksi!</Text>
            </View>
            
            <Ionicons name="checkmark-circle" size={24} color={colors.white} />
          </View>
        ) : null}

        {/* Amount */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Jumlah</Text>
          <View style={[styles.amountInputWrap, amountError ? styles.inputError : null]}>
            <Text style={[styles.currency, { color: accent }]}>IDR</Text>
            <BottomSheetTextInput
              value={amount}
              onChangeText={(value) => {
                setAmount(formatAmountInput(value));
                if (amountError) setAmountError(null);
              }}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
              style={[styles.amountInput, { color: accent }]}
            />
          </View>
          {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}
        </View>

        {/* Category */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Kategori</Text>
          <View style={[styles.categoryGridWrapper, categoryError ? styles.inputError : null]}>
            <View style={styles.categoryGrid}>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.categoryItem, category === c.key && styles.categoryActive]}
                  onPress={() => {
                    setCategory(c.key);
                    if (categoryError) setCategoryError(null);
                  }}
                  activeOpacity={0.9}
                >
                  <View
                    style={[
                      styles.catIconWrap,
                      category === c.key && {
                        backgroundColor: type === 'income' ? colors.incomeBg : colors.expenseBg,
                        borderColor: type === 'income' ? colors.incomeBorder : colors.expenseBorder,
                      },
                    ]}
                  >
                    <Ionicons name={c.icon as any} size={18} color={category === c.key ? accent : colors.textSecondary} />
                  </View>
                  <Text style={[styles.catLabel, category === c.key && { color: accent, fontWeight: '700' }]} numberOfLines={1}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {categoryError ? <Text style={styles.errorText}>{categoryError}</Text> : null}
        </View>

        {/* Note */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Catatan</Text>
          <BottomSheetTextInput
            value={note}
            onChangeText={(value) => {
              setNote(value);
              if (noteError) setNoteError(null);
            }}
            placeholder="Belanja, makanan, dll."
            autoCapitalize="sentences"
            style={[styles.noteInput, noteError ? styles.inputError : null]}
            // multiline
          />
          {noteError ? <Text style={styles.errorText}>{noteError}</Text> : null}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
              <Text style={[styles.btnText, styles.btnGhostText]}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => handleSave(false)}>
              <Text style={styles.btnTextPrimary}>{editMode ? 'Update' : 'Simpan'}</Text>
            </TouchableOpacity>
          </View>
          {!editMode && (
            <View style={styles.actionsRowSingle}> 
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => handleSave(true)}>
                <Text style={styles.btnTextSecondary}>Simpan & Lanjut</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  segmentActive: {
    backgroundColor: colors.white,
  },
  segmentText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  continueMessageBox: {
    marginTop: 8,
    marginBottom: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  continueMessageTextWrap: {
    flex: 1,
    gap: 2,
  },
  continueMessageText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  incomeSegmentTextActive: {
    color: colors.income,
  },
  expenseSegmentTextActive: {
    color: colors.expense,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  currency: {
    fontWeight: '800',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginTop: 6,
  },
  categoryGridWrapper: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingTop: 4,
    backgroundColor: colors.white,
  },
  categoryItem: {
    width: '25%',
    paddingHorizontal: 6,
    marginBottom: 6,
    alignItems: 'center',
  },
  categoryActive: {},
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 6,
  },
  catIconActive: {
    backgroundColor: colors.incomeBg,
    borderColor: colors.incomeBorder,
  },
  catLabel: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  catLabelActive: {
    color: colors.brand,
    fontWeight: '700',
  },
  noteInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  inputError: {
    borderColor: colors.danger,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionsRowSingle: {
    marginTop: 10,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: colors.surface,
  },
  btnGhostText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  btnText: {
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: colors.brand,
  },
  btnTextPrimary: {
    color: colors.white,
    fontWeight: '800',
  },
  btnSecondary: {
    backgroundColor: colors.brand,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brand,
  },
  btnTextSecondary: {
    color: colors.white,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
});
