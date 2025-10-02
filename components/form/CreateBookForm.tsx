import { useBooks } from '@/contexts/BookContext';
import { colors } from '@/styles/colors';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CreateBookFormProps {
  onSuccess?: () => void;
}

export default function CreateBookForm({ onSuccess }: CreateBookFormProps) {
  const { createBook, isLoading } = useBooks();
  const [newBookName, setNewBookName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const handleCreate = async () => {
    const name = newBookName.trim();
    if (!name) {
      setNameError('Nama buku tidak boleh kosong.');
      return;
    }
    setNameError(null);
    await createBook(name);
    setNewBookName('');
    onSuccess?.();
  };

  return (
    <View style={styles.content}>
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Nama Buku</Text>
        <BottomSheetTextInput
          value={newBookName}
          onChangeText={(text) => {
            setNewBookName(text);
            if (nameError) setNameError(null);
          }}
          placeholder="Contoh: Pribadi, Pekerjaan, Project X"
          style={styles.input}
        />
        {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onSuccess}>
          <Text style={[styles.btnText, styles.btnGhostText]}>Batal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleCreate}
          disabled={isLoading || !newBookName.trim()}
        >
          <Text style={styles.btnTextPrimary}>Buat Buku</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
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
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
});
