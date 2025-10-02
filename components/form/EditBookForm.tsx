import { useBooks } from '@/contexts/BookContext';
import { colors } from '@/styles/colors';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface EditBookFormProps {
  bookId: number;
  currentName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EditBookForm({ bookId, currentName, onSuccess, onCancel }: EditBookFormProps) {
  const { updateBook, isLoading } = useBooks();
  const [name, setName] = useState(currentName);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Nama buku tidak boleh kosong');
      return;
    }

    if (name.trim() === currentName) {
      onSuccess();
      return;
    }

    try {
      await updateBook(bookId, name.trim());
      onSuccess();
    } catch (error) {
      Alert.alert('Error', 'Gagal mengupdate buku');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Nama Buku</Text>

      <BottomSheetTextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Nama buku"
        placeholderTextColor={colors.textSecondary}
        autoFocus
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, styles.cancelButtonText]}>Batal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, styles.submitButtonText]}>
            {isLoading ? 'Menyimpan...' : 'Simpan'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.brand,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: colors.textSecondary,
  },
  submitButtonText: {
    color: colors.white,
  },
});
