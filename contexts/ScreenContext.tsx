import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { ScreenKey } from '@/components/navigation/screens.meta';

export type ScreenType = ScreenKey;

interface ScreenContextType {
  currentScreen: ScreenType;
  navigateTo: (screen: ScreenType) => void;
  goBack: () => void;
  isDrawerOpen: boolean;
  setDrawerOpen: (isOpen: boolean) => void;
}

const ScreenContext = createContext<ScreenContextType | undefined>(undefined);

interface ScreenProviderProps {
  children: ReactNode;
}

export function ScreenProvider({ children }: ScreenProviderProps) {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const navigateTo = (screen: ScreenType) => {
    console.log(`🔄 Navigating to: ${screen}`);
    setCurrentScreen(screen);
    setDrawerOpen(false); // Auto-close drawer on navigation
  };

  const goBack = () => {
    // For now, just go back to home, but this could be enhanced
    setCurrentScreen('home');
    setDrawerOpen(false);
  };

  return (
    <ScreenContext.Provider
      value={{
        currentScreen,
        navigateTo,
        goBack,
        isDrawerOpen,
        setDrawerOpen,
      }}
    >
      {children}
    </ScreenContext.Provider>
  );
}

export function useScreen() {
  const context = useContext(ScreenContext);
  if (context === undefined) {
    throw new Error('useScreen must be used within a ScreenProvider');
  }
  return context;
}
