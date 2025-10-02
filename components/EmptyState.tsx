import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

interface EmptyStateProps {
  iconName?: keyof typeof Ionicons.glyphMap;
  text: string;
  containerStyle?: ViewStyle;
}

export default function EmptyState({ iconName = 'file-tray-outline', text, containerStyle }: EmptyStateProps) {
  return (
    <View style={[styles.container, containerStyle]}
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={iconName as any} size={28} color={colors.textSecondary} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    flex: 1,
    flexGrow: 1,
    alignSelf: 'stretch',
    width: '100%',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 10,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
