import React, { useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/styles/colors';

interface SearchBarProps {
  value?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: (text: string) => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function SearchBar({
  value,
  placeholder = 'Search...',
  onChangeText,
  onSubmit,
  loading = false,
  style,
}: SearchBarProps) {
  const isControlled = useMemo(() => typeof value === 'string', [value]);
  const [internalValue, setInternalValue] = useState('');
  const text = isControlled ? (value as string) : internalValue;

  const setText = (t: string) => {
    if (!isControlled) setInternalValue(t);
    onChangeText?.(t);
  };

  const handleClear = () => {
    setText('');
  };

  const handleSubmit = () => {
    onSubmit?.(text);
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.container}>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.leftIcon} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          style={styles.input}
        />
        {text.length > 0 && (
          <Pressable onPress={handleClear} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
        {loading && (
          <View style={styles.rightAdornment}>
            <Text style={styles.loadingText}>...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 12,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  leftIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    marginLeft: 8,
  },
  rightAdornment: {
    marginLeft: 8,
  },
  loadingText: {
    color: colors.textSecondary,
  },
});
