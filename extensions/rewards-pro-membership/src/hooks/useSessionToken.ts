import { useEffect, useState } from 'react';
import { useApi } from '@shopify/ui-extensions-react/customer-account';
import { decodeSessionToken, type DecodedSessionToken } from '../utils/sessionToken';

/**
 * Hook to manage session tokens with automatic refresh
 */
export function useSessionToken() {
  const { sessionToken } = useApi();
  const [decodedToken, setDecodedToken] = useState<DecodedSessionToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAndDecodeToken() {
      try {
        setIsLoading(true);
        setError(null);

        const token = await sessionToken.get();
        const decoded = decodeSessionToken(token);

        if (isMounted) {
          setDecodedToken(decoded);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to get session token';
          setError(errorMessage);
          console.error('[useSessionToken] Error:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchAndDecodeToken();

    // Refresh token periodically (every 4 minutes, tokens expire in 5 minutes)
    const refreshInterval = setInterval(fetchAndDecodeToken, 4 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [sessionToken]);

  return {
    sessionToken,
    decodedToken,
    customerId: decodedToken?.customerId,
    isAuthenticated: !!decodedToken?.customerId,
    isLoading,
    error,
  };
}
