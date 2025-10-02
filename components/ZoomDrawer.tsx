import { useScreen } from '@/contexts/ScreenContext';
import { colors } from '@/styles/colors';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import CustomDrawer from './CustomDrawer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
interface ZoomDrawerProps {
  children: React.ReactNode;
}

export default function ZoomDrawer({ children }: ZoomDrawerProps) {
  const { isDrawerOpen, setDrawerOpen } = useScreen();
  const drawerAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const borderRadiusAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDrawerOpen) {
      // Open drawer animation
      Animated.parallel([
        Animated.timing(drawerAnimation, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        }),
        Animated.timing(scaleAnimation, {
          toValue: 0.85,
          duration: 350,
          useNativeDriver: true,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        }),
        Animated.timing(borderRadiusAnimation, {
          toValue: 20,
          duration: 350,
          useNativeDriver: true,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        }),
      ]).start();
    } else {
      // Close drawer animation
      Animated.parallel([
        Animated.timing(drawerAnimation, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        }),
        Animated.timing(scaleAnimation, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        }),
        Animated.timing(borderRadiusAnimation, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isDrawerOpen, drawerAnimation, scaleAnimation, borderRadiusAnimation]);

  // Gestures disabled: drawer opens only via menu icon, closes by tapping main screen.

  const drawerTranslateX = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH * 0.8, 0],
  });

  const mainScreenTranslateX = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_WIDTH * 0.7],
  });

  // Underlay "shadow" screen that peeks from the left to create stacked look
  const shadowTranslateX = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, SCREEN_WIDTH * 0.62],
  });

  const overlayOpacity = drawerAnimation.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.3, 0.6],
  });

  return (
    <View style={styles.container}>

      {/* Backdrop Overlay */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
          },
        ]}
      />

      {/* Shadow Underlay (beneath main) */}
      <Animated.View
        style={[
          styles.shadowScreen,
          {
            transform: [
              { translateX: shadowTranslateX },
              { scale: scaleAnimation },
            ],
            borderRadius: borderRadiusAnimation,
            opacity: overlayOpacity, // fade in with overlay
          },
        ]}
      />

      {/* Main Screen */}
      <Animated.View
        style={[
          styles.mainScreen,
          {
            transform: [
              { translateX: mainScreenTranslateX },
              { scale: scaleAnimation },
            ],
            borderRadius: borderRadiusAnimation,
          },
        ]}
      >
        <View style={styles.mainScreenContent}>
          {children}
        </View>
        <Pressable
          style={StyleSheet.absoluteFill}
          pointerEvents={isDrawerOpen ? 'auto' : 'none'}
          onPress={() => setDrawerOpen(false)}
        />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: drawerTranslateX }],
          },
        ]}
      >
        <CustomDrawer onClose={() => setDrawerOpen(false)} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  mainScreen: {
    flex: 1,
    backgroundColor: colors.white,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  mainScreenContent: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    // width: SCREEN_WIDTH * 0.77,
    width: SCREEN_WIDTH * 0.73,
    // height: SCREEN_HEIGHT,
    height: '100%',
    zIndex: 1,
  },
  shadowScreen: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    position: 'absolute',
    top: 20,
    left: 25,
    right: 25,
    bottom: 20,
    zIndex: -1,
  },
});
