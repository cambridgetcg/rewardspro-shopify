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
} from '@shopify/ui-extensions-react/customer-account';
import { useSessionToken } from './hooks/useSessionToken';
import { useApiClient } from './hooks/useApiClient';

export default reactExtension(
  'customer-account.profile.block.render',
  () => <HelloWorldBlock />
);

interface LoyaltyData {
  points: number;
  tier: string;
}

function HelloWorldBlock() {
  const translate = useTranslate();
  const i18n = useI18n();
  const language = useLanguage();

  // Session token management
  const {
    sessionToken,
    customerId,
    isAuthenticated,
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

  // Fetch loyalty data when customer is authenticated
  useEffect(() => {
    async function fetchLoyaltyData() {
      if (!isAuthenticated || !sessionToken) {
        return;
      }

      try {
        setDataLoading(true);
        setError(null);

        // Example API call - adjust endpoint as needed
        const response = await apiClient.get<LoyaltyData>(
          sessionToken,
          '/points'
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

  return (
    <BlockStack spacing="base">
      <Banner title={translate('banner.title')}>
        {translate('banner.message')}
      </Banner>

      {/* Authentication Status */}
      <InlineStack spacing="tight" blockAlignment="center">
        <Text>Status:</Text>
        <Badge tone={isAuthenticated ? 'success' : 'critical'}>
          {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
        </Badge>
      </InlineStack>

      {/* Customer Information */}
      {isAuthenticated && customerId && (
        <BlockStack spacing="tight">
          <Text emphasis="bold">Customer ID:</Text>
          <Text size="small" appearance="subdued">{customerId}</Text>
        </BlockStack>
      )}

      {/* Token Information (for debugging) */}
      {decodedToken && (
        <BlockStack spacing="tight">
          <Text size="small" appearance="subdued">
            Token expires in: {Math.floor((decodedToken.claims.exp * 1000 - Date.now()) / 1000)}s
          </Text>
        </BlockStack>
      )}

      {/* Loyalty Data */}
      {dataLoading && (
        <InlineStack spacing="tight" blockAlignment="center">
          <Spinner size="small" />
          <Text>Loading loyalty data...</Text>
        </InlineStack>
      )}

      {error && (
        <Banner tone="critical" title="Error">
          {error}
        </Banner>
      )}

      {loyaltyData && (
        <BlockStack spacing="tight">
          <Text emphasis="bold">Loyalty Points: {loyaltyData.points}</Text>
          <Text>Tier: {loyaltyData.tier}</Text>
        </BlockStack>
      )}

      {/* Localization Info */}
      <Text>
        {translate('extensionLocation')}
      </Text>
      <Text size="small" appearance="subdued">
        {translate('currentLocale', {
          locale: language.isoCode,
          date: i18n.formatDate(new Date(), {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        })}
      </Text>
    </BlockStack>
  );
}
