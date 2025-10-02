import { useAuth, useUser as useClerkUser } from '@clerk/clerk-expo';
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions
} from '@supabase/supabase-js';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { DatabaseService } from '../services/database';
import type { Database } from '../services/sync';

// Supabase configuration
const SUPABASE_URL = "https://enztgtaljsyxdjjuaqtm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuenRndGFsanN5eGRqanVhcXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODQxOTIsImV4cCI6MjA3NDY2MDE5Mn0.EVnhlotOzJCWgcqEi0is5U2ppfvjwFi6_OYv8E-6Cts";

export interface User {
  id: string;
  email: string;
  name?: string; // Make name optional since it's derived from Clerk user data
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => Promise<void>;
  updateUserName: (name: string) => Promise<void>;
  isLoading: boolean;
  supabase: SupabaseClient<Database>;
  isSupabaseReady: boolean;
  refreshSupabaseToken: () => Promise<SupabaseClient<Database> | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

// Create a Supabase client with the JWT from Clerk
const createSupabaseClient = (token?: string) => {
  const stack = new Error().stack;
  console.log('[SUPABASE] Creating Supabase client with token:', token ? 'yes' : 'no');
  if (!token) {
    console.log('[SUPABASE] Called from:', stack?.split('\n')[2])  // Show caller
  }
  
  // Create headers with token if provided
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options: SupabaseClientOptions<'public'> = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      }
    },
    global: {
      headers: headers
    }
  };

  // Create the client - no session setup needed, JWT in headers is sufficient
  const client = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    options
  );

  return client;
};
export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useClerkUser();
  const { getToken } = useAuth();
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  // Initialize with a client without token - will be replaced when user authenticates
  const [supabase, setSupabase] = useState<SupabaseClient<Database>>(() => createSupabaseClient());
  const [tokenRefreshInterval, setTokenRefreshInterval] = useState<number | null>(null);
  const prevClerkUserId = useRef<string | undefined>(undefined);

  // Function to refresh the Supabase client with a new token
  const refreshSupabaseClient = useCallback(async () => {
    if (!isClerkLoaded) {
      console.log('[SUPABASE] Clerk not loaded yet');
      setIsSupabaseReady(false);
      return null;
    }

    if (!clerkUser) {
      console.log('[SUPABASE] No Clerk user, using anonymous client');
      setIsSupabaseReady(false);
      return createSupabaseClient();
    }

    try {
      console.log('[SUPABASE] Refreshing token...');
      const token = await getToken({ template: 'supabase' });
      
      if (!token) {
        console.error('[SUPABASE] No auth token available from Clerk');
        setIsSupabaseReady(false);
        return null;
      }

      console.log('[SUPABASE] Creating new Supabase client with fresh token');
      const client = createSupabaseClient(token);
      return client;
    } catch (error) {
      console.error('[SUPABASE] Error refreshing Supabase client:', error);
      return null;
    }
  }, [isClerkLoaded, clerkUser, getToken]);

  // Initialize Supabase with Clerk auth
  useEffect(() => {
    let isMounted = true;
    let interval: number | null = null;

    const initializeAuth = async () => {
      if (!isClerkLoaded) {
        console.log('[SUPABASE] Clerk not yet loaded, waiting...');
        return;
      }

      // Skip if we've already processed this user
      if (clerkUser && clerkUser.id === prevClerkUserId.current) {
        console.log('[SUPABASE] Already processed this user:', clerkUser.id);
        return;
      }
      
      // Update the previous user ID
      prevClerkUserId.current = clerkUser?.id;

      if (!clerkUser) {
        console.log('[SUPABASE] No Clerk user, resetting to anonymous client');
        if (isMounted) {
          setIsSupabaseReady(false);
          setUserState(null);
          setSupabase(createSupabaseClient());
        }
        return;
      }

      try {
        console.log('[SUPABASE] Initializing with Clerk user:', clerkUser.id);
        
        // Get the JWT from Clerk
        const token = await getToken({ template: 'supabase' });
        
        if (!token) {
          console.error('[SUPABASE] No auth token available from Clerk');
          if (isMounted) {
            setIsSupabaseReady(false);
          }
          return;
        }

        console.log('[SUPABASE] Creating Supabase client with token');
        
        // Create a new client with the token
        const client = createSupabaseClient(token);
        
        if (!isMounted) return;
        
        // Set the client and mark as ready
        if (client) {
          setSupabase(client);
          setIsSupabaseReady(true);
        } else {
          console.error('[SUPABASE] Failed to create Supabase client');
          setIsSupabaseReady(false);
        }
        
        // Check for pending user name from sign-up
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const pendingName = await AsyncStorage.getItem('pending_user_name');
          
          if (pendingName && (!clerkUser.firstName || clerkUser.firstName === 'User')) {
            console.log('[USER] Found pending name, updating Clerk user:', pendingName);
            try {
              await clerkUser.update({
                firstName: pendingName,
              });
              console.log('[USER] Clerk user firstName updated successfully');
              await AsyncStorage.removeItem('pending_user_name');
            } catch (updateError) {
              console.log('[USER] Could not update Clerk firstName:', updateError);
            }
          }
        } catch (storageError) {
          console.log('[USER] Could not check pending name:', storageError);
        }
        
        // Set up user data
        const userData: User = {
          id: clerkUser.id,
          name: clerkUser.fullName || clerkUser.firstName || 'User',
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
        };
        
        if (!user || user.id !== userData.id) {
          console.log('[SUPABASE] Setting up new user data');
          await setUser(userData);
        }
        
        // Clear any existing interval
        if (interval) {
          clearInterval(interval);
        }
        
        // Set up token refresh interval (every 30 minutes)
        console.log('[SUPABASE] Setting up token refresh interval');
        const newInterval = setInterval(async () => {
          console.log('[SUPABASE] Refreshing Supabase token...');
          const newToken = await getToken({ template: 'supabase' });
          if (newToken && isMounted) {
            console.log('[SUPABASE] Updating Supabase client with new token');
            const refreshedClient = createSupabaseClient(newToken);
            setSupabase(refreshedClient);
          }
        }, 30 * 60 * 1000); // 30 minutes
        
        interval = Number(newInterval);
        setTokenRefreshInterval(newInterval);
        
      } catch (error) {
        console.error('[SUPABASE] Error initializing Supabase auth:', error);
        if (isMounted) {
          setIsSupabaseReady(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();
    
    // Clean up on unmount
    return () => {
      console.log('[SUPABASE] Cleaning up...');
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isClerkLoaded, clerkUser?.id, user?.id, isSupabaseReady]);


  const setUser = async (newUser: User | null) => {
    console.log('[USER] setUser called with:', newUser ? `user ${newUser.id}` : 'null');
    try {
      setUserState(newUser);
      
      if (newUser) {
        console.log('[USER] Initializing database for user:', newUser.id);
        // Initialize database for the new user
        await DatabaseService.getInstance().openUserDB(newUser.id);
        console.log('[USER] Database initialized successfully');
      } else {
        console.log('[USER] Closing database on logout');
        // Close database on logout
        await DatabaseService.getInstance().closeDatabase();
      }
    } catch (error) {
      console.error('[USER] Error setting user:', error);
    } finally {
      if (isLoading) {
        setIsLoading(false);
      }
    }
  };

  const updateUserName = async (name: string) => {
    console.log('[USER] updateUserName called with:', name);
    if (!user) {
      throw new Error('[USER] No user to update');
    }
    
    const updatedUser: User = { 
      ...user, 
      name 
    };
    await setUser(updatedUser);
  };

  // Method to manually refresh the Supabase token
  const refreshSupabaseToken = useCallback(async () => {
    if (!clerkUser) {
      console.log('[SUPABASE] No user to refresh token for');
      return null;
    }

    try {
      console.log('[SUPABASE] Manually refreshing token...');
      const newToken = await getToken({ template: 'supabase' });
      
      if (newToken) {
        console.log('[SUPABASE] Token refreshed, updating Supabase client');
        const refreshedClient = createSupabaseClient(newToken);
        setSupabase(refreshedClient);
        return refreshedClient;
      } else {
        console.error('[SUPABASE] Failed to get new token');
        return null;
      }
    } catch (error) {
      console.error('[SUPABASE] Error refreshing token:', error);
      return null;
    }
  }, [clerkUser, getToken]);

  const value: UserContextType = useMemo(() => ({
    user,
    setUser,
    updateUserName,
    isLoading,
    supabase, // Always use the current supabase state, don't create fallback
    isSupabaseReady,
    refreshSupabaseToken,
  }), [user, setUser, updateUserName, isLoading, isSupabaseReady, supabase, refreshSupabaseToken]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('[USER] useUser must be used within a UserProvider');
  }
  
  // Only log state changes, not on every render
  const prevStateRef = useRef<{
    userId?: string;
    isLoading: boolean;
    isSupabaseReady: boolean;
    hasSupabase: boolean;
  } | null>(null);

  useEffect(() => {
    const currentState = {
      userId: context.user?.id,
      isLoading: context.isLoading,
      isSupabaseReady: context.isSupabaseReady,
      hasSupabase: !!context.supabase
    };

    // Only log if state has changed
    if (
      !prevStateRef.current ||
      prevStateRef.current.userId !== currentState.userId ||
      prevStateRef.current.isLoading !== currentState.isLoading ||
      prevStateRef.current.isSupabaseReady !== currentState.isSupabaseReady ||
      prevStateRef.current.hasSupabase !== currentState.hasSupabase
    ) {
      console.log('[USER] useUser state updated:', {
        user: context.user ? `User ${context.user.id}` : 'No user',
        isLoading: context.isLoading,
        isSupabaseReady: context.isSupabaseReady,
        hasSupabase: !!context.supabase
      });
      prevStateRef.current = currentState;
    }
  }, [context.user?.id, context.isLoading, context.isSupabaseReady, context.supabase]);
  
  return context;
};
