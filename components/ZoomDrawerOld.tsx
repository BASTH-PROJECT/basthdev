import { useScreen } from '@/contexts/ScreenContext';
import { colors } from '@/styles/colors';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    PanResponder,
    StyleSheet,
    TouchableWithoutFeedback,
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
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        }),
      ]).start();
    }
  }, [isDrawerOpen, drawerAnimation, scaleAnimation, borderRadiusAnimation]);

  // Pan gesture handler for swipe to open/close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx < 0 && !isDrawerOpen) return; // Don't allow swipe left when closed

        const progress = Math.min(Math.max(gestureState.dx / (SCREEN_WIDTH * 0.7), 0), 1);
        drawerAnimation.setValue(progress);
        scaleAnimation.setValue(1 - (progress * 0.15));
        borderRadiusAnimation.setValue(progress * 20);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const threshold = SCREEN_WIDTH * 0.3;
        if (gestureState.dx > threshold) {
          setDrawerOpen(true);
        } else if (gestureState.dx < -threshold && isDrawerOpen) {
          setDrawerOpen(false);
        } else {
          // Snap back to current state based on progress
          const progress = gestureState.dx / (SCREEN_WIDTH * 0.7);
          if (progress > 0.3) {
            setDrawerOpen(true);
          } else {
            setDrawerOpen(false);
          }
        }
      },
    })
  );

  const drawerTranslateX = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH * 0.8, 0],
  });

  const mainScreenTranslateX = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_WIDTH * 0.7],
  });

  const overlayOpacity = drawerAnimation.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.3, 0.6],
  });

  return (
    <View style={styles.container} {...panResponder.current.panHandlers}>

      {/* Backdrop Overlay */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
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
        <TouchableWithoutFeedback onPress={() => setDrawerOpen(false)}>
          <View style={styles.mainScreenContent}>
            {children}
          </View>
        </TouchableWithoutFeedback>
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
    width: SCREEN_WIDTH * 0.77,
    height: SCREEN_HEIGHT,
    zIndex: 1,
  },
});
