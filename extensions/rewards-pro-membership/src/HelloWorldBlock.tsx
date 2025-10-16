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
} from '@shopify/ui-extensions-react/customer-account';
import { useSessionToken } from './hooks/useSessionToken';
import { useApiClient } from './hooks/useApiClient';
import { useAuthenticatedCustomer } from './hooks/useAuthenticatedCustomer';

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

  // Fetch loyalty data when customer is authenticated
  useEffect(() => {
    async function fetchLoyaltyData() {
      if (!isAuthenticated || !sessionToken) {
        return;
      }

      try {
        setDataLoading(true);
        setError(null);

        // Call the main loyalty endpoint (baseUrl already includes /api/customer-account/loyalty)
        const response = await apiClient.get<LoyaltyData>(
          sessionToken,
          '' // Empty string because baseUrl already has the full path
        );

        if (response.success && response.data) {
          setLoyaltyData(response.data);
        } else {
          setError(response.error || 'Failed to fetch loyalty data');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('[HelloWorldBlock] Error fetching loyalty data:', err);
      } finally {
        setDataLoading(false);
      }
    }

    fetchLoyaltyData();
  }, [isAuthenticated, sessionToken, apiClient]);

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
      <Banner tone="info" title="Join our Rewards Program">
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
      {/* Store Credit Card */}
      <BlockStack spacing="base">
        <Text size="large" emphasis="bold">Available Store Credit</Text>
        <BlockStack spacing="tight">
          <Text size="extraLarge" emphasis="bold">
            ${loyaltyData.balance.toFixed(2)} {loyaltyData.currency}
          </Text>
          <Text size="small" appearance="subdued">
            Earned ${loyaltyData.totalEarned.toFixed(2)} total
          </Text>
        </BlockStack>
      </BlockStack>

      <Divider />

      {/* Membership Tier Card */}
      <BlockStack spacing="base">
        <Text size="large" emphasis="bold">Membership Tier</Text>
        {loyaltyData.tier ? (
          <BlockStack spacing="base">
            {/* Current Tier */}
            <InlineStack spacing="tight" blockAlignment="center">
              <Badge tone="success">{loyaltyData.tier.name}</Badge>
              <Text emphasis="bold">{loyaltyData.tier.cashbackPercent}% Cashback</Text>
            </InlineStack>

            {/* Next Tier Progress */}
            {loyaltyData.nextTier && (
              <BlockStack spacing="tight">
                <Text size="small" emphasis="bold">
                  Progress to {loyaltyData.nextTier.name}
                </Text>
                <Text size="small" appearance="subdued">
                  Spend ${loyaltyData.amountToNextTier.toFixed(2)} more to unlock {loyaltyData.nextTier.cashbackPercent}% cashback
                </Text>
                <InlineStack spacing="tight" blockAlignment="center">
                  <Text size="small" appearance="subdued">
                    {loyaltyData.progressToNextTier.toFixed(0)}% complete
                  </Text>
                </InlineStack>
              </BlockStack>
            )}

            {/* Stats Summary */}
            <BlockStack spacing="tight">
              <Divider />
              <InlineStack spacing="base">
                <BlockStack spacing="extraTight">
                  <Text size="small" appearance="subdued">Total Spent</Text>
                  <Text emphasis="bold">${loyaltyData.stats.totalSpent.toFixed(2)}</Text>
                </BlockStack>
                <BlockStack spacing="extraTight">
                  <Text size="small" appearance="subdued">Orders</Text>
                  <Text emphasis="bold">{loyaltyData.stats.orderCount}</Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        ) : (
          <Text size="small" appearance="subdued">
            No tier assigned yet. Start shopping to earn your first tier!
          </Text>
        )}
      </BlockStack>

      {/* Recent Transactions */}
      {loyaltyData.recentTransactions.length > 0 && (
        <>
          <Divider />
          <BlockStack spacing="base">
            <Text size="large" emphasis="bold">Recent Activity</Text>
            <BlockStack spacing="base">
              {loyaltyData.recentTransactions.slice(0, 5).map((tx) => (
                <InlineStack key={tx.id} spacing="base" blockAlignment="start">
                  <Badge tone={tx.amount > 0 ? 'success' : 'attention'}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                  </Badge>
                  <BlockStack spacing="extraTight">
                    <Text size="small">{tx.description}</Text>
                    <Text size="small" appearance="subdued">
                      {new Date(tx.date).toLocaleDateString()}
                    </Text>
                  </BlockStack>
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        </>
      )}
    </BlockStack>
  );
}
