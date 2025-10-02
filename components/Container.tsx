import { colors } from '@/styles/colors';
import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import type { ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from './header';

interface ContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string; // allow overrides if needed
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
  scroll?: boolean; // enable/disable scrolling. default: true
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'refreshControl' | 'contentContainerStyle' | 'style'>;
}

export default function Container({
  children,
  style,
  backgroundColor,
  refreshing = false,
  onRefresh,
  scroll = true,
  contentContainerStyle,
  scrollViewProps,
}: ContainerProps) {
  const containerStyle = [
    styles.container,
    backgroundColor ? { backgroundColor } : null,
    style,
  ];

  return (
    <SafeAreaView style={containerStyle}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <Header />
      {scroll ? (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentContainerStyle}
          refreshControl={
            onRefresh
              ? (
                  <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
                )
              : undefined
          }
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
  },
});
