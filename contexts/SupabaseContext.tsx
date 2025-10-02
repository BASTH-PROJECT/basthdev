import React, { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { createClerkSupabaseClient } from '@/lib/supabase';

interface SupabaseContextType {
  supabase: SupabaseClient | null;
  isReady: boolean;
  refreshToken: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

interface SupabaseProviderProps {
  children: ReactNode;
}

export const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ children }) => {
  const { getToken, isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  // Create Supabase client with Clerk authentication
  const supabase = useMemo(() => {
    if (!authLoaded || !isSignedIn) {
      return null;
    }

    console.log('[SUPABASE-CONTEXT] Creating authenticated Supabase client for user:', user?.id);
    
    return createClerkSupabaseClient(async () => {
      try {
        // Get the Clerk session token with the 'supabase' template
        // NOTE: You need to create this template in your Clerk Dashboard
        const token = await getToken({ template: 'supabase' });
        
        if (!token) {
          console.warn('[SUPABASE-CONTEXT] No token received from Clerk');
        }
        
        return token;
      } catch (error) {
        console.error('[SUPABASE-CONTEXT] Error getting Clerk token:', error);
        return null;
      }
    });
  }, [authLoaded, isSignedIn, getToken, user?.id]);

  // Function to manually refresh the token
  const refreshToken = async () => {
    try {
      console.log('[SUPABASE-CONTEXT] Manually refreshing Clerk session token');
      await getToken({ template: 'supabase' });
    } catch (error) {
      console.error('[SUPABASE-CONTEXT] Error refreshing token:', error);
      throw error;
    }
  };

  const isReady = authLoaded && isSignedIn && supabase !== null;

  useEffect(() => {
    console.log('[SUPABASE-CONTEXT] State:', {
      authLoaded,
      isSignedIn,
      hasSupabase: supabase !== null,
      isReady,
      userId: user?.id,
    });
  }, [authLoaded, isSignedIn, supabase, isReady, user?.id]);

  const value: SupabaseContextType = {
    supabase,
    isReady,
    refreshToken,
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = (): SupabaseContextType => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
