import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { GestureResponderEvent, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

interface FABProps {
  onPress?: (event: GestureResponderEvent) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export default function FAB({ onPress, icon = 'add', label, style }: FABProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.fab, style]}
      accessibilityRole="button"
      accessibilityLabel={label || 'Create'}
    >
      <Ionicons name={icon} size={24} color={colors.white} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  label: {
    color: colors.white,
    fontWeight: '700',
    marginLeft: 8,
  },
});
