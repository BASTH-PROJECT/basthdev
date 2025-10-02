import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

interface BottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  noScrollView?: boolean;
  snapPoints?: (string | number)[];
  initialIndex?: number;
  enableContentPanningGesture?: boolean;
}

export default function AppBottomSheet({
  isVisible,
  onClose,
  title,
  children,
  noScrollView = false,
  snapPoints: customSnapPoints,
  initialIndex,
  enableContentPanningGesture = true,
}: BottomSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => customSnapPoints ?? ['50%', '90%'], [customSnapPoints]);
  const defaultIndex = useMemo(() => {
    if (initialIndex !== undefined) return initialIndex;
    return snapPoints.length > 1 ? snapPoints.length - 1 : 0;
  }, [initialIndex, snapPoints]);

  const handleClose = () => {
    onClose();
  };

  useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.snapToIndex(defaultIndex);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible, defaultIndex]);

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} transparent statusBarTranslucent animationType="fade">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheet
          ref={bottomSheetRef}
          index={defaultIndex}
          snapPoints={snapPoints}
          enablePanDownToClose
          enableContentPanningGesture={enableContentPanningGesture}
          onClose={handleClose}
          android_keyboardInputMode="adjustResize"
          keyboardBehavior="extend"     // 👈 makes sheet push up with keyboard
          keyboardBlurBehavior="restore"
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              pressBehavior="close"
            />
          )}
          style={styles.container}
          backgroundStyle={styles.background}
          handleIndicatorStyle={styles.handle}
        >
          {Platform.OS === 'android' && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
              onPress={() => bottomSheetRef.current?.close()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          )}

          <SafeAreaView style={styles.content} edges={['bottom', 'left', 'right']}>
            {noScrollView ? (
              <View style={styles.childrenContainer}>{children}</View>
            ) : (
              <BottomSheetScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.childrenContainer}>{children}</View>
              </BottomSheetScrollView>
            )}
          </SafeAreaView>
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  background: {
    backgroundColor: '#fff',
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#10b981',
    fontWeight: '600',
    display: 'none', // hide "X" unless you want it visible
  },
  handle: {
    backgroundColor: '#E5E5E5',
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  childrenContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
