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

export default reactExtension(
  'customer-account.profile.block.render',
  () => <LoyaltyProfileBlock />
);

function LoyaltyProfileBlock() {
  const { data, loading, error } = useLoyaltyData();

  // Loading state
  if (loading) {
    return (
      <Banner status="info">
        Loading your rewards...
      </Banner>
    );
  }

  // Error state
  if (error) {
    return (
      <Banner status="critical">
        <BlockStack spacing="tight">
          <Text variant="headingMd">Unable to load rewards</Text>
          <Text>{error}</Text>
        </BlockStack>
      </Banner>
    );
  }

  // No data state
  if (!data) {
    return (
      <Banner status="info">
        No rewards data available
      </Banner>
    );
  }

  // Not enrolled state
  if (!data.enrolled) {
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
  return (
    <BlockStack spacing="loose">
      <BalanceCard data={data} />
    </BlockStack>
  );
}
