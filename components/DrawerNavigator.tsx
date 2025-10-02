import { ScreenProvider } from '@/contexts/ScreenContext';
import React from 'react';
import { View } from 'react-native';
import ScreenRenderer from './ScreenRenderer';
import ZoomDrawer from './ZoomDrawer';

export default function DrawerNavigator() {
  return (
    <ScreenProvider>
      <View style={{ flex: 1 }}>
        <ZoomDrawer>
          <ScreenRenderer />
        </ZoomDrawer>
      </View>
    </ScreenProvider>
  );
}
