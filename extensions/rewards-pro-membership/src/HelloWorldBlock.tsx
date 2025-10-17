import { useEffect, useState } from 'react';
import {
  reactExtension,
  Banner,
  BlockStack,
  Text,
  useTranslate,
  useI18n,
  useLanguage,
  InlineStack,
  Badge,
  Spinner,
  Divider,
  View,
} from '@shopify/ui-extensions-react/customer-account';
import { useSessionToken } from './hooks/useSessionToken';
import { useApiClient } from './hooks/useApiClient';
import { useAuthenticatedCustomer } from './hooks/useAuthenticatedCustomer';
import { createApiClient } from './utils/apiClient';

export default reactExtension(
  'customer-account.profile.block.render',
  () => <HelloWorldBlock />
);

interface TierInfo {
  name: string;
  cashbackPercent: number;
  minSpend: number;
}

interface TransactionInfo {
  id: number;
  type: string;
  amount: number;
  date: string;
  description: string;
}

interface LoyaltyData {
  success: boolean;
  enrolled: boolean;
  balance: number;
  tier: TierInfo | null;
  nextTier: TierInfo | null;
  progressToNextTier: number;
  amountToNextTier: number;
  totalEarned: number;
  stats: {
    orderCount: number;
    totalSpent: number;
    netSpent: number;
    averageCashbackPerOrder: number;
    lastOrderDate: string | null;
  };
  allTiers: TierInfo[];
  recentTransactions: TransactionInfo[];
  currency: string;
  message?: string;
  canEnroll?: boolean;
}

function HelloWorldBlock() {
  const translate = useTranslate();
  const i18n = useI18n();
  const language = useLanguage();

  // Authenticated customer (simpler, direct access)
  const {
    customer,
    customerId: authCustomerId,
    isAuthenticated: authIsAuthenticated,
    purchasingCompany,
    isB2BCustomer,
    companyLocationId,
  } = useAuthenticatedCustomer();

  // Session token management (for API calls)
  const {
    sessionToken,
    customerId: tokenCustomerId,
    isAuthenticated: tokenIsAuthenticated,
    isLoading: tokenLoading,
    decodedToken
  } = useSessionToken();

  // API client
  const apiClient = useApiClient({
    enableDebugLogs: true,
  });

  // Loyalty data state
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use authenticated customer ID as primary source
  const customerId = authCustomerId || tokenCustomerId;
  const isAuthenticated = authIsAuthenticated || tokenIsAuthenticated;

  console.log('[HelloWorldBlock] Component state:', {
    authCustomerId,
    tokenCustomerId,
    customerId,
    isAuthenticated,
    authIsAuthenticated,
    tokenIsAuthenticated,
    hasSessionToken: !!sessionToken,
  });

  // Fetch loyalty data when customer is authenticated
  useEffect(() => {
    async function fetchLoyaltyData() {
      console.log('[HelloWorldBlock] fetchLoyaltyData called', {
        isAuthenticated,
        hasSessionToken: !!sessionToken,
        willFetch: isAuthenticated && !!sessionToken
      });

      if (!isAuthenticated || !sessionToken) {
        console.log('[HelloWorldBlock] Skipping fetch - not authenticated or no session token');
        return;
      }

      try {
        console.log('[HelloWorldBlock] Starting loyalty data fetch...');
        setDataLoading(true);
        setError(null);

        // Call the main loyalty endpoint (baseUrl already includes /api/customer-account/loyalty)
        console.log('[HelloWorldBlock] Calling API client...');
        const response = await apiClient.get<LoyaltyData>(
          sessionToken,
          '' // Empty string because baseUrl already has the full path
        );

        console.log('[HelloWorldBlock] API response received:', {
          success: response.success,
          hasData: !!response.data,
          error: response.error,
        });

        if (response.success && response.data) {
          console.log('[HelloWorldBlock] Setting loyalty data:', {
            enrolled: response.data.enrolled,
            balance: response.data.balance,
            tierName: response.data.tier?.name,
          });
          setLoyaltyData(response.data);
        } else {
          const errorMsg = response.error || 'Failed to fetch loyalty data';
          console.error('[HelloWorldBlock] API error:', errorMsg);
          setError(errorMsg);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[HelloWorldBlock] Exception during fetch:', errorMessage, err);
        setError(errorMessage);
      } finally {
        console.log('[HelloWorldBlock] Fetch complete, setting loading to false');
        setDataLoading(false);
      }
    }

    fetchLoyaltyData();
  }, [isAuthenticated, sessionToken, apiClient]);

  // Send heartbeat signals to confirm block is installed and rendering
  // This allows dashboard to detect actual installation vs just dismissal
  useEffect(() => {
    async function sendHeartbeat() {
      if (!isAuthenticated || !sessionToken) {
        console.log('[HelloWorldBlock] Skipping heartbeat - not authenticated');
        return;
      }

      try {
        console.log('[HelloWorldBlock] Sending heartbeat signal...');

        // Use relative URL to work in all environments (dev, staging, prod)
        // The extension will make the request from the shop's domain context
        const heartbeatApiClient = createApiClient({
          baseUrl: '/api/customer-account/heartbeat',
          timeout: 5000,
          enableDebugLogs: false,
        });

        const response = await heartbeatApiClient.post(sessionToken, '');

        if (response.success) {
          console.log('[HelloWorldBlock] Heartbeat sent successfully');
        } else {
          console.warn('[HelloWorldBlock] Heartbeat failed:', response.error);
        }
      } catch (err) {
        // Don't show error to user, just log it
        console.error('[HelloWorldBlock] Heartbeat failed:', err);
      }
    }

    // Send immediate heartbeat on mount
    sendHeartbeat();

    // Send heartbeat every 2 minutes while component is mounted
    const heartbeatInterval = setInterval(sendHeartbeat, 2 * 60 * 1000);

    // Cleanup interval on unmount
    return () => {
      console.log('[HelloWorldBlock] Cleaning up heartbeat interval');
      clearInterval(heartbeatInterval);
    };
  }, [isAuthenticated, sessionToken]);

  // Loading state
  if (tokenLoading) {
    return (
      <BlockStack spacing="base">
        <InlineStack spacing="tight" blockAlignment="center">
          <Spinner size="small" />
          <Text>Loading...</Text>
        </InlineStack>
      </BlockStack>
    );
  }

  // Loading state
  if (dataLoading) {
    return (
      <BlockStack spacing="base">
        <InlineStack spacing="tight" blockAlignment="center">
          <Spinner size="small" />
          <Text>Loading membership...</Text>
        </InlineStack>
      </BlockStack>
    );
  }

  // Error state
  if (error) {
    return (
      <Banner tone="critical" title="Error">
        {error}
      </Banner>
    );
  }

  // Not enrolled state
  if (loyaltyData && !loyaltyData.enrolled) {
    return (
      <Banner tone="info" title="Join our Membership Program">
        {loyaltyData.message || "You're not enrolled yet. Start earning rewards today!"}
      </Banner>
    );
  }

  // Enrolled state - show membership card
  if (!loyaltyData) {
    return null;
  }

  return (
    <BlockStack spacing="base">
      {/* Membership Header */}
      <Text size="large" emphasis="bold">Membership</Text>

      {/* Membership Tier Card */}
      {loyaltyData.tier && (
        <View
          border="base"
          cornerRadius="base"
          padding="base"
          background="base"
        >
          <BlockStack spacing="base">
            <BlockStack spacing="tight">
              <Text appearance="subdued">Current tier</Text>
              <InlineStack spacing="tight" blockAlignment="center">
                <Text size="large" emphasis="bold">{loyaltyData.tier.name}</Text>
                <Badge tone="success">{loyaltyData.tier.cashbackPercent}% cashback</Badge>
              </InlineStack>
            </BlockStack>

            {/* Next Tier Progress */}
            {loyaltyData.nextTier && (
              <BlockStack spacing="tight">
                <Divider />
                <Text size="medium" emphasis="bold">
                  Next: {loyaltyData.nextTier.name}
                </Text>
                <Text size="small" appearance="subdued">
                  Spend {loyaltyData.currency} {loyaltyData.amountToNextTier.toFixed(2)} more to unlock {loyaltyData.nextTier.cashbackPercent}% cashback
                </Text>
                <Text size="small" appearance="subdued">
                  {loyaltyData.progressToNextTier.toFixed(0)}% complete
                </Text>
              </BlockStack>
            )}

            {/* Stats */}
            <BlockStack spacing="tight">
              <Divider />
              <InlineStack spacing="base">
                <BlockStack spacing="extraTight">
                  <Text size="small" appearance="subdued">Total spent</Text>
                  <Text emphasis="bold">{loyaltyData.currency} {loyaltyData.stats.totalSpent.toFixed(2)}</Text>
                </BlockStack>
                <BlockStack spacing="extraTight">
                  <Text size="small" appearance="subdued">Orders</Text>
                  <Text emphasis="bold">{loyaltyData.stats.orderCount}</Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </View>
      )}

      {/* Store Credit Balance Card */}
      <View
        border="base"
        cornerRadius="base"
        padding="base"
        background="base"
      >
        <BlockStack spacing="tight">
          <Text appearance="subdued">Available store credit</Text>
          <Text size="extraLarge" emphasis="bold">
            {loyaltyData.currency} {loyaltyData.balance.toFixed(2)}
          </Text>
          {loyaltyData.totalEarned > 0 && (
            <Text size="small" appearance="subdued">
              Total earned: {loyaltyData.currency} {loyaltyData.totalEarned.toFixed(2)}
            </Text>
          )}
        </BlockStack>
      </View>
    </BlockStack>
  );
}
