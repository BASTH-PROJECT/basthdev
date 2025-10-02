import { useState } from 'react';
import { useSignIn, useSignUp, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export interface EmailAuthState {
  isLoading: boolean;
  error: string | null;
  pendingVerification: boolean;
  isSignUp: boolean;
  email: string;
  userName: string;
}

export interface UseEmailAuthReturn {
  state: EmailAuthState;
  signInWithEmail: (email: string) => Promise<void>;
  signUpWithEmail: (email: string, userName: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  resendOTP: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
  setUserName: (name: string) => void;
}

export const useEmailAuth = (): UseEmailAuthReturn => {
  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { signUp, setActive: setActiveSignUp } = useSignUp();
  const { user: clerkUser } = useUser();
  const router = useRouter();

  const [state, setState] = useState<EmailAuthState>({
    isLoading: false,
    error: null,
    pendingVerification: false,
    isSignUp: false,
    email: '',
    userName: '',
  });

  const updateState = (updates: Partial<EmailAuthState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const clearError = () => {
    updateState({ error: null });
  };

  const reset = () => {
    setState({
      isLoading: false,
      error: null,
      pendingVerification: false,
      isSignUp: false,
      email: '',
      userName: '',
    });
  };

  const setUserName = (name: string) => {
    updateState({ userName: name });
  };

  const signInWithEmail = async (email: string) => {
    if (!signIn) {
      updateState({ error: 'Sign in not available' });
      return;
    }

    updateState({ isLoading: true, error: null, email });

    try {
      // Start the sign-in process using the email method
      const signInAttempt = await signIn.create({
        identifier: email,
      });

      // Send the user an email with the verification code
      const emailFactor = signInAttempt.supportedFirstFactors?.find(
        (factor) => factor.strategy === 'email_code'
      );
      
      if (!emailFactor?.emailAddressId) {
        updateState({
          isLoading: false,
          error: 'Email verification not supported',
        });
        return;
      }

      await signInAttempt.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: emailFactor.emailAddressId,
      });

      updateState({
        isLoading: false,
        pendingVerification: true,
        isSignUp: false,
      });
    } catch (error: any) {
      console.error('Sign in with email error:', error);
      updateState({
        isLoading: false,
        error: error.errors?.[0]?.message || error.message || 'Sign in failed',
      });
    }
  };

  const signUpWithEmail = async (email: string, userName: string) => {
    if (!signUp) {
      updateState({ error: 'Sign up not available' });
      return;
    }

    updateState({ isLoading: true, error: null, email, userName });

    try {
      // Start the sign-up process using the email only
      // Note: firstName will be set after verification if needed
      await signUp.create({
        emailAddress: email,
      });

      // Send the user an email with the verification code
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      updateState({
        isLoading: false,
        pendingVerification: true,
        isSignUp: true,
      });
    } catch (error: any) {
      console.error('Sign up with email error:', error);
      updateState({
        isLoading: false,
        error: error.errors?.[0]?.message || error.message || 'Sign up failed',
      });
    }
  };

  const verifyOTP = async (code: string) => {
    updateState({ isLoading: true, error: null });

    try {
      if (state.isSignUp) {
        // Handle sign up verification
        if (!signUp) {
          updateState({ error: 'Sign up not available', isLoading: false });
          return;
        }

        console.log('Attempting sign up verification with code:', code);
        const completeSignUp = await signUp.attemptEmailAddressVerification({
          code,
        });

        console.log('Sign up verification result:', completeSignUp.status);

        if (completeSignUp.status === 'complete') {
          console.log('Sign up complete, setting active session');
          if (setActiveSignUp && completeSignUp.createdSessionId) {
            await setActiveSignUp({ session: completeSignUp.createdSessionId });
            console.log('Active session set successfully');
            
            // Wait a bit longer for the session to be fully processed
            updateState({ isLoading: false, pendingVerification: false });
            setTimeout(() => {
              console.log('Redirecting to protected screen after sign up');
              router.replace('/(protected)');
            }, 500);
          } else {
            console.error('No session ID or setActive function available');
            updateState({
              isLoading: false,
              error: 'Session activation failed',
            });
          }
        } else if (completeSignUp.status === 'missing_requirements') {
          console.log('Sign up has missing requirements, attempting to complete...');
          console.log('Missing requirements:', completeSignUp.missingFields);
          
          try {
            const missingFields = completeSignUp.missingFields || [];
            
            if (missingFields.includes('password')) {
              // Generate a random password since we want passwordless auth
              const randomPassword = Math.random().toString(36).slice(-12) + 'A1!';
              console.log('Setting random password for passwordless auth');
              
              // Only set password, NOT firstName (Clerk doesn't accept it in signUp.update)
              const updatedSignUp = await signUp.update({
                password: randomPassword,
              });
              
              console.log('Updated sign up status after password:', updatedSignUp.status);
              
              if (updatedSignUp.status === 'complete') {
                if (setActiveSignUp && updatedSignUp.createdSessionId) {
                  await setActiveSignUp({ session: updatedSignUp.createdSessionId });
                  console.log('Active session set after completing requirements');
                  
                  // Store the userName in AsyncStorage to be picked up by UserContext
                  if (state.userName && state.userName.trim()) {
                    try {
                      console.log('Storing userName for UserContext:', state.userName);
                      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                      await AsyncStorage.setItem('pending_user_name', state.userName.trim());
                      console.log('UserName stored, will be set in UserContext');
                    } catch (storageError) {
                      console.log('Could not store userName:', storageError);
                    }
                  }
                  
                  updateState({ isLoading: false, pendingVerification: false });
                  setTimeout(() => {
                    console.log('Redirecting to protected screen after completing requirements');
                    router.replace('/(protected)');
                  }, 800);
                } else {
                  updateState({
                    isLoading: false,
                    error: 'Session activation failed after completing requirements',
                  });
                }
              } else {
                // Still missing other requirements
                const remainingFields = updatedSignUp.missingFields || [];
                updateState({
                  isLoading: false,
                  error: `Please complete your profile. Missing: ${remainingFields.join(', ')}`,
                });
              }
            } else {
              // Handle other missing fields
              updateState({
                isLoading: false,
                error: `Please complete your profile. Missing: ${missingFields.join(', ')}`,
              });
            }
          } catch (updateError: any) {
            console.error('Error completing sign up requirements:', updateError);
            updateState({
              isLoading: false,
              error: 'Failed to complete profile. Please try again.',
            });
          }
        } else {
          console.log('Sign up status:', completeSignUp.status);
          updateState({
            isLoading: false,
            error: `Verification incomplete. Status: ${completeSignUp.status}`,
          });
        }
      } else {
        // Handle sign in verification
        if (!signIn) {
          updateState({ error: 'Sign in not available', isLoading: false });
          return;
        }

        console.log('Attempting sign in verification with code:', code);
        const completeSignIn = await signIn.attemptFirstFactor({
          strategy: 'email_code',
          code,
        });

        console.log('Sign in verification result:', completeSignIn.status);

        if (completeSignIn.status === 'complete') {
          console.log('Sign in complete, setting active session');
          if (setActiveSignIn && completeSignIn.createdSessionId) {
            await setActiveSignIn({ session: completeSignIn.createdSessionId });
            console.log('Active session set successfully');
            
            // Wait a bit longer for the session to be fully processed
            updateState({ isLoading: false, pendingVerification: false });
            setTimeout(() => {
              console.log('Redirecting to protected screen after sign in');
              router.replace('/(protected)');
            }, 500);
          } else {
            console.error('No session ID or setActive function available');
            updateState({
              isLoading: false,
              error: 'Session activation failed',
            });
          }
        } else if (completeSignIn.status === 'needs_second_factor') {
          updateState({
            isLoading: false,
            error: 'Two-factor authentication required',
          });
        } else {
          console.log('Sign in status:', completeSignIn.status);
          updateState({
            isLoading: false,
            error: `Verification incomplete. Status: ${completeSignIn.status}`,
          });
        }
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      console.error('Error details:', error.errors);
      
      // Handle specific Clerk errors
      if (error.errors && error.errors.length > 0) {
        const clerkError = error.errors[0];
        if (clerkError.code === 'form_code_incorrect') {
          updateState({
            isLoading: false,
            error: 'Invalid verification code. Please try again.',
          });
        } else if (clerkError.code === 'verification_expired') {
          updateState({
            isLoading: false,
            error: 'Verification code expired. Please request a new one.',
          });
        } else {
          updateState({
            isLoading: false,
            error: clerkError.message || 'Verification failed',
          });
        }
      } else {
        updateState({
          isLoading: false,
          error: error.message || 'Verification failed',
        });
      }
    }
  };

  const resendOTP = async () => {
    updateState({ isLoading: true, error: null });

    try {
      if (state.isSignUp) {
        // Resend sign up OTP
        if (!signUp) {
          updateState({ error: 'Sign up not available', isLoading: false });
          return;
        }

        await signUp.prepareEmailAddressVerification({
          strategy: 'email_code',
        });
      } else {
        // Resend sign in OTP
        if (!signIn) {
          updateState({ error: 'Sign in not available', isLoading: false });
          return;
        }

        const emailFactor = signIn.supportedFirstFactors?.find(
          (factor) => factor.strategy === 'email_code'
        );
        
        if (!emailFactor?.emailAddressId) {
          updateState({ error: 'Email verification not supported', isLoading: false });
          return;
        }

        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailFactor.emailAddressId,
        });
      }

      updateState({ isLoading: false });
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      updateState({
        isLoading: false,
        error: error.errors?.[0]?.message || error.message || 'Failed to resend code',
      });
    }
  };

  return {
    state,
    signInWithEmail,
    signUpWithEmail,
    verifyOTP,
    resendOTP,
    clearError,
    reset,
    setUserName,
  };
};
