// import { SignOutButton } from '@/components/clerk/SignOutButton';
import SignOutButton from '@/components/SignOutButton';
import { screens } from '@/components/navigation/screens';
import { useScreen } from '@/contexts/ScreenContext';
import { colors } from '@/styles/colors';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CustomDrawerProps {
  onClose: () => void;
}

export default function CustomDrawer({ onClose }: CustomDrawerProps) {
  const { user } = useUser();
  const { navigateTo, currentScreen } = useScreen();

  const drawerItems = screens
    .filter((s) => s.component) // hide optional screens that are not present
    .map((s) => ({
      icon: s.icon,
      label: s.label,
      screen: s.key,
      onPress: () => {
        navigateTo(s.key);
        onClose();
      },
    }));

  // Animation refs
  const profileOpacity = useRef(new Animated.Value(0)).current;
  const profileTranslateY = useRef(new Animated.Value(-20)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuTranslateY = useRef(new Animated.Value(-10)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const footerTranslateY = useRef(new Animated.Value(-10)).current;

  // Note: Avoid creating hooks inside loops/maps to prevent hook order changes

  useEffect(() => {
    // Staggered animations for drawer content
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(profileOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(profileTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(menuTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(footerTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [currentScreen]); // Re-run animations when screen changes

  return (
    <SafeAreaView style={styles.container}>
      {/* User Profile Section */}
      <Animated.View
        style={[
          styles.profileSection,
          {
            opacity: profileOpacity,
            transform: [{ translateY: profileTranslateY }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.profileTouchable}
          onPress={() => {
            navigateTo('profile');
            onClose();
          }}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: user?.imageUrl || 'https://via.placeholder.com/50' }}
            style={styles.avatar}
            defaultSource={{ uri: 'https://via.placeholder.com/50' }}
            onError={() => {
              // Fallback to placeholder if image fails to load
            }}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user?.firstName || 'User'}
            </Text>
            <Text
              style={styles.userEmail}
              numberOfLines={1}
              adjustsFontSizeToFit
              ellipsizeMode="tail"
            >
              {user?.emailAddresses?.[0]?.emailAddress || ''}
            </Text>
          </View>
          {/* Removed chevron-forward icon as requested */}
        </TouchableOpacity>
      </Animated.View>

      {/* Menu Items */}
      <Animated.View
        style={[
          styles.menuSection,
          {
            opacity: menuOpacity,
            transform: [{ translateY: menuTranslateY }],
          },
        ]}
      >
        {drawerItems.map((item, index) => {
          const isActive = currentScreen === item.screen;
          const iconColor = isActive ? colors.brand : 'rgba(255, 255, 255, 0.75)';
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                isActive ? styles.activeMenuItem : styles.inactiveMenuItem
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, isActive && styles.activeMenuIconWrap]}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={iconColor}
                />
              </View>
              <Text style={[
                styles.menuItemText,
                isActive ? styles.activeMenuItemText : styles.inactiveMenuItemText
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      {/* Footer */}
      <Animated.View
        style={[
          styles.footerSection,
          {
            opacity: footerOpacity,
            transform: [{ translateY: footerTranslateY }],
          },
        ]}
      >
        <SignOutButton
          variant="drawer"
          onBeforeSignOut={onClose}
        />
        {/* <Text style={styles.versionText}>v1.0.0</Text> */}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand,
    paddingTop: SCREEN_HEIGHT * 0.04,
    // paddingBottom: SCREEN_HEIGHT * 0.04,
    
  },
  profileSection: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    marginLeft: 10,
  },
  profileTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    marginRight: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
  userEmail: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  menuSection: {
    flex: 1,
    // paddingHorizontal: 15,
    paddingLeft: 20,
    paddingRight: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginBottom: 5,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    position: 'relative',
  },
  inactiveMenuItem: {
    backgroundColor: 'transparent',
  },
  activeMenuItem: {
    backgroundColor: colors.white,
    borderLeftColor: colors.white,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  activeMenuIconWrap: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  activeMenuItemText: {
    fontSize: 15,
    color: colors.brand,
    fontWeight: '700',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  inactiveMenuItemText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  footerSection: {
    paddingLeft: 20,
    paddingRight: 10,
    // borderTopWidth: 1,
    // borderTopColor: 'rgba(255, 255, 255, 0.2)',
    // paddingTop:15,
    // marginTop: 20,
    marginBottom: 20,
  },
});
