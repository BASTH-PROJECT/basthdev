import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/styles/colors';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

interface OTPVerificationProps {
  email: string;
  isSignUp: boolean;
  onVerifyOTP: (code: string) => Promise<void>;
  onResendOTP: () => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}

export const OTPVerification: React.FC<OTPVerificationProps> = ({
  email,
  isSignUp,
  onVerifyOTP,
  onResendOTP,
  onBack,
  isLoading,
  error,
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<TextInput[]>([]);
  const backspaceTimerRef = useRef<any>(null);
  const backspacePressTimeRef = useRef<number>(0);

  useEffect(() => {
    // Start countdown timer
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, 6).split('');
      const newOtp = [...otp];
      pastedCode.forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      
      // Focus on the last filled input or the next empty one
      const nextIndex = Math.min(pastedCode.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    
    // If value is empty (backspace was pressed)
    if (value === '' && otp[index] !== '') {
      // Clear current digit
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }
    
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newOtp.every(digit => digit !== '') && !isLoading) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number, event: any) => {
    if (key === 'Backspace') {
      // If current field is empty, move to previous field
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
      // If current field has value, it will be cleared by onChangeText
    }
  };

  const handleBackspaceHold = () => {
    // Clear all OTP fields
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };

  const handlePressIn = (index: number) => {
    backspacePressTimeRef.current = Date.now();
    // Start timer to detect long press (500ms)
    backspaceTimerRef.current = setTimeout(() => {
      handleBackspaceHold();
    }, 500);
  };

  const handlePressOut = () => {
    if (backspaceTimerRef.current) {
      clearTimeout(backspaceTimerRef.current);
      backspaceTimerRef.current = null;
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Kode Tidak Valid', 'Silakan masukkan kode verifikasi 6 digit');
      return;
    }

    console.log('OTPVerification: Verifying code:', otpCode);
    try {
      await onVerifyOTP(otpCode);
    } catch (error) {
      console.error('OTP verification error:', error);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    try {
      await onResendOTP();
      setResendTimer(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error('Resend OTP error:', error);
    }
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Verifikasi email Anda</Text>
        <Text style={styles.subtitle}>
          Kami mengirim kode 6 digit ke {maskedEmail}
        </Text>
      </View>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              if (ref) inputRefs.current[index] = ref;
            }}
            style={[
              styles.otpInput,
              digit && styles.otpInputFilled,
              error && styles.otpInputError,
            ]}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index, nativeEvent)}
            onTouchStart={() => handlePressIn(index)}
            onTouchEnd={handlePressOut}
            keyboardType="numeric"
            maxLength={6} // Allow paste
            selectTextOnFocus
            autoFocus={index === 0}
          />
        ))}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]}
        onPress={() => handleVerify()}
        disabled={isLoading || otp.some(digit => !digit)}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.verifyButtonText}>Verifikasi</Text>
        )}
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Tidak menerima kode? </Text>
        <TouchableOpacity
          onPress={handleResend}
          disabled={!canResend || isLoading}
        >
          <Text style={[
            styles.resendButton,
            (!canResend || isLoading) && styles.resendButtonDisabled
          ]}>
            {canResend ? 'Kirim Ulang' : `Kirim ulang dalam ${resendTimer}d`}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.changeEmailContainer}>
        <Text style={styles.changeEmailText}>Email salah? </Text>
        <TouchableOpacity
          onPress={onBack}
          disabled={isLoading}
        >
          <Text style={styles.changeEmailButton}>Ganti Email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSoft,
  },
  otpInputFilled: {
    borderColor: colors.brand,
    backgroundColor: colors.white,
  },
  otpInputError: {
    borderColor: colors.danger,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  verifyButton: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  resendButton: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '600',
  },
  resendButtonDisabled: {
    color: colors.textSecondary,
  },
  changeEmailContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  changeEmailText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  changeEmailButton: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
