/**
 * Profile Block - Main Entry Point
 * Displays loyalty dashboard on customer account profile page
 */

import {
  reactExtension,
  BlockStack,
  Banner,
  Text,
} from '@shopify/ui-extensions-react/customer-account';
import { useLoyaltyData } from './hooks/useLoyaltyData';
import { BalanceCard } from './components/profile/BalanceCard';
import { useEffect } from 'react';

export default reactExtension(
  'customer-account.profile.block.render',
  () => <LoyaltyProfileBlock />
);

function LoyaltyProfileBlock() {
  console.log('[ProfileBlock] ========== COMPONENT RENDER ==========');

  const { data, loading, error } = useLoyaltyData();

  useEffect(() => {
    console.log('[ProfileBlock] State update:', {
      loading,
      hasError: !!error,
      errorMessage: error,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : null,
      enrolled: data?.enrolled,
      timestamp: new Date().toISOString()
    });
  }, [data, loading, error]);

  // Loading state
  if (loading) {
    console.log('[ProfileBlock] Rendering: LOADING state');
    return (
      <Banner status="info">
        Loading your rewards...
      </Banner>
    );
  }

  // Error state
  if (error) {
    console.log('[ProfileBlock] Rendering: ERROR state -', error);
    return (
      <Banner status="critical">
        <BlockStack spacing="tight">
          <Text variant="headingMd">Unable to load rewards</Text>
          <Text>{error}</Text>
          <Text appearance="subdued" size="small">Check browser console for details</Text>
        </BlockStack>
      </Banner>
    );
  }

  // No data state
  if (!data) {
    console.log('[ProfileBlock] Rendering: NO DATA state');
    return (
      <Banner status="info">
        <BlockStack spacing="tight">
          <Text>No rewards data available</Text>
          <Text appearance="subdued" size="small">Check browser console for details</Text>
        </BlockStack>
      </Banner>
    );
  }

  // Not enrolled state
  if (!data.enrolled) {
    console.log('[ProfileBlock] Rendering: NOT ENROLLED state');
    return (
      <Banner status="info">
        <BlockStack spacing="tight">
          <Text variant="headingMd">Join RewardsPro</Text>
          <Text>Start earning cashback on every purchase</Text>
          {data.message && <Text appearance="subdued">{data.message}</Text>}
        </BlockStack>
      </Banner>
    );
  }

  // Success - Display balance card
  console.log('[ProfileBlock] Rendering: SUCCESS state with balance card');
  return (
    <BlockStack spacing="loose">
      <BalanceCard data={data} />
    </BlockStack>
  );
}
