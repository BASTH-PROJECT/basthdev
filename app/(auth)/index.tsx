import AppBottomSheet from '@/components/BottomSheet';
import { OTPVerification } from '@/components/OTPVerification';
import { useEmailAuth } from '@/hooks/useEmailAuth';
import { colors } from '@/styles/colors';
import { useOAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Animation refs
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(50)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(40)).current;
  const buttonScale = useRef(new Animated.Value(0.8)).current;

  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' });
  const emailAuth = useEmailAuth();

  // Start animations when component mounts
  useEffect(() => {
    const animateElements = () => {
      // Staggered animations for smooth entrance
      Animated.stagger(200, [
        // Title animation
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(titleTranslateY, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        // Subtitle animation
        Animated.parallel([
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(subtitleTranslateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        // Button animation
        Animated.parallel([
          Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(buttonTranslateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(buttonScale, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    };

    // Small delay to ensure component is mounted
    const timer = setTimeout(animateElements, 100);
    return () => clearTimeout(timer);
  }, []);

  const onSignInWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      const { createdSessionId, setActive } = await startGoogleOAuth();

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/');
      }
    } catch (err: any) {
      console.error('Google OAuth error', err);
      Alert.alert('Masuk gagal', err?.message || 'Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [router, startGoogleOAuth]);

  const handleEmailAuth = async () => {
    if (!email.trim()) {
      Alert.alert('Email Diperlukan', 'Silakan masukkan alamat email Anda');
      return;
    }

    // Auto-add @gmail.com if user didn't include any @ symbol
    let finalEmail = email.trim();
    if (!finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@gmail.com`;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(finalEmail)) {
      Alert.alert('Email Tidak Valid', 'Silakan masukkan alamat email yang valid');
      return;
    }

    if (authMode === 'signup' && !userName.trim()) {
      Alert.alert('Nama Diperlukan', 'Silakan masukkan nama Anda');
      return;
    }

    if (authMode === 'signin') {
      await emailAuth.signInWithEmail(finalEmail);
    } else {
      await emailAuth.signUpWithEmail(finalEmail, userName.trim());
    }
  };

  const handleBackFromOTP = () => {
    emailAuth.reset();
    setEmail('');
    setUserName('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Centered Content */}
      <View style={styles.centerContent}>
        {/* Animated App Title */}
        <Animated.View
          style={[
            styles.titleContainer,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          <Image
            source={require('@/assets/icons/adaptive-icon.png')}
            style={styles.logo}
          />
          <Text style={styles.brand}>ONI CashApp</Text>
        </Animated.View>

        {/* Animated Subtitle */}
        <Animated.View
          style={[
            styles.subtitleContainer,
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }],
            },
          ]}
        >
          <Text style={styles.tagline}>Lacak lebih pintar. Belanja lebih baik.</Text>
        </Animated.View>
      </View>

      {/* Bottom Button */}
      <Animated.View
        style={[
          styles.bottomButtonContainer,
          {
            opacity: buttonOpacity,
            transform: [
              { translateY: buttonTranslateY },
              { scale: buttonScale },
            ],
          },
        ]}
      >
        <TouchableOpacity 
          style={styles.getStarted} 
          onPress={() => setSheetVisible(true)} 
          activeOpacity={0.9}
        >
          <Text style={styles.getStartedText}>Mulai</Text>
        </TouchableOpacity>
      </Animated.View>

      <AppBottomSheet
        isVisible={sheetVisible}
        onClose={() => {
          setSheetVisible(false);
          emailAuth.reset();
          setEmail('');
          setUserName('');
        }}
        title={emailAuth.state.pendingVerification ? 'Verifikasi Email' : 'Masuk'}
      >
        {emailAuth.state.pendingVerification ? (
          <OTPVerification
            email={emailAuth.state.email}
            isSignUp={emailAuth.state.isSignUp}
            onVerifyOTP={emailAuth.verifyOTP}
            onResendOTP={emailAuth.resendOTP}
            onBack={handleBackFromOTP}
            isLoading={emailAuth.state.isLoading}
            error={emailAuth.state.error}
          />
        ) : (
          <>
            <View style={styles.sheetHeader}> 
              <Text style={styles.sheetTitle}>
                {authMode === 'signin' ? 'Selamat datang kembali' : 'Buat akun'}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {authMode === 'signin' ? 'Masuk untuk melanjutkan' : 'Daftar untuk memulai'}
              </Text>
            </View>

            <View style={styles.authModeContainer}>
              <TouchableOpacity
                style={[styles.authModeButton, authMode === 'signin' && styles.authModeButtonActive]}
                onPress={() => setAuthMode('signin')}
              >
                <Text style={[styles.authModeText, authMode === 'signin' && styles.authModeTextActive]}>
                  Masuk
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authModeButton, authMode === 'signup' && styles.authModeButtonActive]}
                onPress={() => setAuthMode('signup')}
              >
                <Text style={[styles.authModeText, authMode === 'signup' && styles.authModeTextActive]}>
                  Daftar
                </Text>
              </TouchableOpacity>
            </View>

            {authMode === 'signup' && (
              <View style={styles.emailContainer}>
                <View style={styles.labelContainer}>
                  <Text style={styles.emailLabel}>Nama Anda</Text>
                  {/* <Text style={styles.info}>(Pilih dengan hati-hati - ini akan menjadi nama tampilan Anda!)</Text> */}
                </View>
                <BottomSheetTextInput
                  style={styles.emailInput}
                  value={userName}
                  onChangeText={(text) => {
                    setUserName(text);
                    emailAuth.clearError();
                  }}
                  placeholder="Masukkan nama Anda"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            )}

            <View style={styles.emailContainer}>
              <Text style={styles.emailLabel}>Alamat email</Text>
              <BottomSheetTextInput
                style={[styles.emailInput, emailAuth.state.error && styles.emailInputError]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  emailAuth.clearError();
                  if (authMode === 'signup' && !userName.trim()) {
                    Alert.alert('Nama Diperlukan', 'Silakan masukkan nama Anda');
                  }
                }}
                placeholder="Masukkan email Anda"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {emailAuth.state.error && (
                <Text style={styles.emailError}>{emailAuth.state.error}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.emailButton, (emailAuth.state.isLoading || !email.trim() || (authMode === 'signup' && !userName.trim())) && styles.emailButtonDisabled]}
              onPress={handleEmailAuth}
              disabled={emailAuth.state.isLoading || !email.trim() || (authMode === 'signup' && !userName.trim())}
            >
              {emailAuth.state.isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="mail" size={18} color="#ffffff" />
                  <Text style={styles.emailButtonText}>
                    {authMode === 'signin' ? 'Masuk dengan Email' : 'Daftar dengan Email'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {authMode === 'signin' && (
              <View style={styles.forgotEmailContainer}>
                <Text style={styles.forgotEmailText}>Lupa email Anda? </Text>
                <TouchableOpacity onPress={() => Alert.alert(
                  'Bantuan Login',
                  'Jika Anda lupa email yang digunakan untuk mendaftar:\n\n• Coba email yang sering Anda gunakan (Gmail, Yahoo, Outlook)\n• Periksa folder Spam/Junk di email Anda\n• Ingat email yang digunakan saat pertama install app\n• Coba variasi nama Anda + angka (contoh: nama123@gmail.com)\n\nJika masih tidak ingat, Anda bisa:\n• Daftar akun baru dengan email yang mudah diingat\n• Hubungi dukungan pelanggan untuk bantuan',
                  [
                    { text: 'Daftar Akun Baru', onPress: () => setAuthMode('signup') },
                    { text: 'Coba Lagi', style: 'default' },
                    { text: 'Tutup', style: 'cancel' }
                  ]
                )}>
                  <Text style={styles.forgotEmailButton}>Bantuan</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>atau</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={[styles.oauthButton, loading && styles.oauthButtonDisabled]}
              onPress={onSignInWithGoogle}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color="#111827" />
                  <Text style={styles.oauthText}>Lanjutkan dengan Google</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  subtitleContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bottomButtonContainer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brand: {
    fontSize: 36,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 24,
  },
  getStarted: {
    backgroundColor: colors.white,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    width: '100%',
    maxWidth: 280,
  },
  getStartedText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  sheetHeader: {
    gap: 4,
    marginBottom: 12,
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sheetSubtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  oauthButton: {
    marginTop: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  oauthButtonDisabled: {
    opacity: 0.7,
  },
  oauthText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  authModeContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  authModeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  authModeButtonActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  authModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  authModeTextActive: {
    color: colors.textPrimary,
  },
  emailContainer: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    // marginBottom: 8,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  info: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
    marginBottom: 8,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  emailInputError: {
    borderColor: colors.danger,
  },
  emailError: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  emailButton: {
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  emailButtonDisabled: {
    opacity: 0.7,
  },
  emailButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginHorizontal: 16,
  },
  forgotEmailContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  forgotEmailText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  forgotEmailButton: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '600',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
    borderRadius:25,
  },
});

