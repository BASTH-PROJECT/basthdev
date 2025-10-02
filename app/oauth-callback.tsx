import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/(protected)');
    }, 0);

    return () => clearTimeout(timeout);
  }, [router]);

  return null;
}
