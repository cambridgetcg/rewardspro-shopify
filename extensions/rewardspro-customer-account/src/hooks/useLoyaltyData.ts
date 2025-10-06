/**
 * Hook to fetch and manage loyalty data from backend API
 */

import { useState, useEffect } from 'react';
import { useApi } from '@shopify/ui-extensions-react/customer-account';
import type { LoyaltyData } from '../types/loyalty';

const API_URL = 'https://rewardspro-production.vercel.app/api/customer-account/loyalty';

export function useLoyaltyData() {
  const { sessionToken } = useApi();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchLoyaltyData() {
      try {
        setLoading(true);
        setError(null);

        // Get fresh session token from Shopify
        const token = await sessionToken.get();

        // Call backend API with session token
        const response = await fetch(API_URL, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const json = await response.json();

        if (json.error) {
          throw new Error(json.message || json.error);
        }

        // Only update state if component is still mounted
        if (isMounted) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        console.error('[useLoyaltyData] Error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load rewards data');
          setData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchLoyaltyData();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [sessionToken]);

  return { data, loading, error };
}
