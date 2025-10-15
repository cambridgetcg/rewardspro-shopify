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

interface LoyaltyData {
  points: number;
  tier: string;
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
      {isAuthenticated && (
        <BlockStack spacing="tight">
          <Text emphasis="bold">Customer Information:</Text>
          {customerId && (
            <Text size="small" appearance="subdued">ID: {customerId}</Text>
          )}
          {customer?.id && (
            <Text size="small" appearance="subdued">GID: {customer.id}</Text>
          )}
        </BlockStack>
      )}

      {/* B2B Customer Information */}
      {isB2BCustomer && (
        <BlockStack spacing="tight">
          <InlineStack spacing="tight" blockAlignment="center">
            <Text emphasis="bold">B2B Customer</Text>
            <Badge tone="info">Business</Badge>
          </InlineStack>
          {purchasingCompany?.company?.id && (
            <Text size="small" appearance="subdued">
              Company: {purchasingCompany.company.id}
            </Text>
          )}
          {companyLocationId && (
            <Text size="small" appearance="subdued">
              Location: {companyLocationId}
            </Text>
          )}
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
