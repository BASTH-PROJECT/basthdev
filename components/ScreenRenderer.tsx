import { screens, profileScreen } from '@/components/navigation/screens';
import { useScreen } from '@/contexts/ScreenContext';
import { colors } from '@/styles/colors';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  View,
  InteractionManager,
} from 'react-native';

export default function ScreenRenderer() {
  const { currentScreen } = useScreen();

  const [activeScreenKey, setActiveScreenKey] = useState(currentScreen);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Keep loader mounted and animate its opacity with native driver to avoid jank while JS is busy
  const loaderPulse = useRef(new Animated.Value(0.85)).current; // pulsing value 0.6..1
  const loaderGate = useRef(new Animated.Value(0)).current; // 0->1 when showing loader, for smooth fade-in/out

  const ActiveComponent = useMemo(() => {
    // Check main screens first
    let match = screens.find(s => s.key === activeScreenKey)?.component;
    
    // If not found, check if it's the profile screen
    if (!match && activeScreenKey === 'profile') {
      match = profileScreen.component;
    }
    
    // Fallback to home
    const fallback = screens.find(s => s.key === 'home')?.component;
    return match || fallback || null;
  }, [activeScreenKey]);

  // Start a subtle pulsing on the loader (native-driven)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(loaderPulse, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        Animated.timing(loaderPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loaderPulse]);

  useEffect(() => {
    if (currentScreen === activeScreenKey) return;

    setIsTransitioning(true);
    // Smoothly fade in the loader gate while fading out the screen
    Animated.parallel([
      Animated.timing(loaderGate, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      // Defer mounting new screen work until after current animations settle
      InteractionManager.runAfterInteractions(() => {
        setActiveScreenKey(currentScreen);
        // Next frame, fade in new screen
        requestAnimationFrame(() => {
          Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start(() => {
            // Smoothly hide loader gate
            Animated.timing(loaderGate, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
              setIsTransitioning(false);
            });
          });
        });
      });
    });
  }, [currentScreen, activeScreenKey, fadeAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.screenContainer, { opacity: fadeAnim }]}
        pointerEvents={isTransitioning ? 'none' : 'auto'}
      >
        {ActiveComponent ? <ActiveComponent /> : null}
      </Animated.View>

      {/* Keep loader mounted to avoid decode stutter; combine gate * pulse for opacity */}
      <Animated.View
        style={[
          styles.loaderOverlay,
          { opacity: isTransitioning ? Animated.multiply(loaderGate, loaderPulse) : 0 },
        ]}
        pointerEvents="none"
      >
        <Image
          source={require('@/assets/images/loader2.gif')}
          style={styles.loaderImage}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenContainer: { flex: 1 },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderImage: {
    width: 200,
    height: 200,
    // Hint GPU compositing to keep animation smooth
    // @ts-ignore react-native style platform props
    renderToHardwareTextureAndroid: true,
    // @ts-ignore react-native style platform props
    shouldRasterizeIOS: true,
  },
});
