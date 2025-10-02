import { screens } from '@/components/navigation/screens';
import { useScreen } from '@/contexts/ScreenContext';
import { colors } from '@/styles/colors';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  View
} from 'react-native';

export default function ScreenRenderer() {
  const { currentScreen } = useScreen();

  const [activeScreenKey, setActiveScreenKey] = useState(currentScreen);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  const ActiveComponent = useMemo(() => {
    const match = screens.find(s => s.key === activeScreenKey)?.component;
    const fallback = screens.find(s => s.key === 'home')?.component;
    return match || fallback || null;
  }, [activeScreenKey]);

  useEffect(() => {
    if (currentScreen === activeScreenKey) return;

    setIsTransitioning(true);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveScreenKey(currentScreen);
      setIsTransitioning(false);
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

      {isTransitioning && (
        <View style={styles.loaderOverlay} pointerEvents="none">
          {/* <ActivityIndicator size="large" color={colors.brand} /> */}
          <Image
            source={require('@/assets/images/loader2.gif')}
            style={{ width: 200, height: 200 }}
          />
        </View>
      )}
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
});
