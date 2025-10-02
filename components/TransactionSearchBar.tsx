import { getEditPermissionDescription } from '@/constants/editPermissions';
import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

interface TransactionSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function TransactionSearchBar({
  value,
  onChangeText,
  placeholder = 'Cari transaksi...',
}: TransactionSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const showEditInfo = () => {
    const permission = getEditPermissionDescription();
    Alert.alert(
      'Cara Edit Transaksi',
      `📝 Tekan dan tahan (long press) transaksi untuk mengedit.\n\n⏰ ${permission}\n\n💡 Tips:\n• Tekan dan tahan selama 0.2 detik\n• Perubahan akan otomatis disinkronkan ke cloud`,
      [{ text: 'Mengerti', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View
        style={[
          styles.searchWrapper,
          isFocused && styles.searchWrapperFocused,
        ]}
      >
        <Ionicons
          name="search-outline"
          size={20}
          color={isFocused ? colors.brand : colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="search"
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Info Button */}
      <TouchableOpacity
        style={styles.infoButton}
        onPress={showEditInfo}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="alert-circle-outline" size={24} color={colors.brand} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    marginTop: 10,
    backgroundColor: colors.white,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchWrapperFocused: {
    borderColor: colors.brand,
    backgroundColor: colors.white,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
  },
  infoButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
});
