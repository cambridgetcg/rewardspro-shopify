/**
 * Hook to fetch and manage loyalty data from backend API
 */

import { useState, useEffect } from 'react';
import { useApi } from '@shopify/ui-extensions-react/customer-account';
import type { LoyaltyData } from '../types/loyalty';

// Production URL for customer account API
const API_URL = 'https://rewardspro-production.vercel.app/api/customer-account/loyalty';

export function useLoyaltyData() {
  const { sessionToken } = useApi();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchLoyaltyData() {
      const requestId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`[${requestId}] ========== FRONTEND REQUEST START ==========`);
      console.log(`[${requestId}] API URL:`, API_URL);

      try {
        setLoading(true);
        setError(null);

        // Get fresh session token from Shopify
        console.log(`[${requestId}] Step 1: Getting session token...`);
        let token;
        try {
          token = await sessionToken.get();
          console.log(`[${requestId}] Session token received:`, token ? `${token.substring(0, 20)}...` : 'null');
        } catch (tokenError) {
          console.error(`[${requestId}] Session token error:`, tokenError);
          throw new Error(`Failed to get session token: ${tokenError}`);
        }

        // Call backend API with session token
        console.log(`[${requestId}] Step 2: Calling backend API...`);
        console.log(`[${requestId}] Request headers:`, {
          Authorization: token ? `Bearer ${token.substring(0, 20)}...` : 'missing',
          'Content-Type': 'application/json'
        });

        let response;
        try {
          response = await fetch(API_URL, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          console.log(`[${requestId}] Response received:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          });
        } catch (fetchError) {
          console.error(`[${requestId}] Fetch error:`, fetchError);
          throw new Error(`Network request failed: ${fetchError}`);
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[${requestId}] API error response:`, errorText);
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        console.log(`[${requestId}] Step 3: Parsing response...`);
        let json;
        try {
          json = await response.json();
          console.log(`[${requestId}] Parsed JSON:`, json);
        } catch (parseError) {
          console.error(`[${requestId}] JSON parse error:`, parseError);
          throw new Error(`Failed to parse response: ${parseError}`);
        }

        if (json.error) {
          console.error(`[${requestId}] API returned error:`, json);
          throw new Error(json.message || json.error);
        }

        // Only update state if component is still mounted
        if (isMounted) {
          console.log(`[${requestId}] Step 4: Updating state with data`);
          setData(json);
          setError(null);
          console.log(`[${requestId}] ========== FRONTEND REQUEST SUCCESS ==========`);
        }
      } catch (err) {
        console.error(`[${requestId}] ========== FRONTEND REQUEST ERROR ==========`);
        console.error(`[${requestId}] Error type:`, err?.constructor?.name);
        console.error(`[${requestId}] Error message:`, err instanceof Error ? err.message : String(err));
        console.error(`[${requestId}] Error stack:`, err instanceof Error ? err.stack : 'N/A');
        console.error(`[${requestId}] Full error:`, err);

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
