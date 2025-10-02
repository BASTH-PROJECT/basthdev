import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-expo';

// Supabase configuration - fallback to hardcoded values if env vars not available
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://enztgtaljsyxdjjuaqtm.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuenRndGFsanN5eGRqanVhcXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODQxOTIsImV4cCI6MjA3NDY2MDE5Mn0.EVnhlotOzJCWgcqEi0is5U2ppfvjwFi6_OYv8E-6Cts";

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] Missing configuration:', { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseAnonKey 
  });
  throw new Error('Supabase configuration is missing');
}

console.log('[SUPABASE] Configuration loaded:', {
  url: supabaseUrl,
  keyLength: supabaseAnonKey.length,
  keyPrefix: supabaseAnonKey.substring(0, 20) + '...'
});

/**
 * Create a Supabase client with Clerk authentication
 * This client will automatically use the Clerk session token for all requests
 */
export function createClerkSupabaseClient(getToken: (options?: { template?: string }) => Promise<string | null>): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      // Custom fetch to inject Clerk JWT token
      fetch: async (url, options = {}) => {
        const clerkToken = await getToken({ template: 'supabase' });
        
        const headers = new Headers(options?.headers);
        headers.set('Authorization', `Bearer ${clerkToken}`);
        
        return fetch(url, {
          ...options,
          headers,
        });
      },
    },
  });
}

/**
 * Hook to get an authenticated Supabase client
 * This ensures the client always uses the current Clerk session token
 */
export function useSupabaseClient() {
  const { getToken } = useAuth();
  
  // Create client with token getter function
  const supabase = createClerkSupabaseClient(getToken);
  
  return supabase;
}
