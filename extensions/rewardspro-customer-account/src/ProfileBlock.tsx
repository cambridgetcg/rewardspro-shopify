/**
 * Profile Block - Main Entry Point
 * Displays loyalty dashboard on customer account profile page
 * Following Shopify customer account UX guidelines and Polaris design system
 */

import {
  reactExtension,
  BlockStack,
  Banner,
  Text,
  SkeletonText,
} from '@shopify/ui-extensions-react/customer-account';
import { useLoyaltyData } from './hooks/useLoyaltyData';
import { BalanceCard } from './components/profile/BalanceCard';
import { RewardsHistory } from './components/profile/RewardsHistory';
import { useEffect } from 'react';
import { Logger } from './utils/logger';

export default reactExtension(
  'customer-account.profile.block.render',
  () => <LoyaltyProfileBlock />
);

// Test data to verify rendering works
const TEST_DATA = {
  enrolled: true,
  balance: 25.50,
  totalEarned: 125.00,
  currency: 'USD',
  tier: {
    name: 'Gold',
    cashbackPercent: 5
  },
  nextTier: {
    name: 'Platinum',
    minSpend: 500
  },
  progressToNextTier: 65,
  recentTransactions: [
    {
      id: '1',
      date: '2025-01-10',
      amount: 10.00,
      description: 'Cashback from order #1234',
      type: 'earned'
    },
    {
      id: '2',
      date: '2025-01-05',
      amount: -5.00,
      description: 'Redeemed on order #1233',
      type: 'redeemed'
    }
  ]
};

function LoyaltyProfileBlock() {
  Logger.mount('ProfileBlock');

  const { data, loading, error } = useLoyaltyData();

  // TEMPORARY: Use test data if API fails to verify rendering works
  const displayData = data || (error ? TEST_DATA : null);
  const isUsingTestData = !data && !!error;

  useEffect(() => {
    Logger.stateChange('ProfileBlock', {
      loading,
      hasError: !!error,
      errorMessage: error,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : null,
      enrolled: data?.enrolled,
      usingTestData: isUsingTestData,
      timestamp: new Date().toISOString()
    });
  }, [data, loading, error, isUsingTestData]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      Logger.unmount('ProfileBlock');
    };
  }, []);

  // Loading state with skeleton
  if (loading) {
    Logger.render('ProfileBlock', 'LOADING');
    return (
      <BlockStack spacing="base">
        <SkeletonText />
        <SkeletonText />
        <SkeletonText />
      </BlockStack>
    );
  }

  // No data state (only if API hasn't returned and no error to fall back to test data)
  if (!displayData) {
    Logger.render('ProfileBlock', 'NO DATA');
    return (
      <Banner status="info" title="Rewards information unavailable">
        <Text>
          Unable to load your rewards data at this time. Please try again later.
        </Text>
      </Banner>
    );
  }

  // Not enrolled state - personalized CTA
  if (!displayData.enrolled) {
    Logger.render('ProfileBlock', 'NOT ENROLLED');
    return (
      <Banner status="info" title="Join our rewards program">
        <BlockStack spacing="base">
          <Text>
            Start earning cashback on every purchase! Get exclusive member benefits and rewards.
          </Text>
          {displayData.message && (
            <Text appearance="subdued" size="small">
              {displayData.message}
            </Text>
          )}
        </BlockStack>
      </Banner>
    );
  }

  // Success state - Display rewards dashboard
  // Following mobile-first responsive layout with vertical stacking
  // Cards don't add external margins - BlockStack with spacing separates them
  Logger.render('ProfileBlock', isUsingTestData ? 'SUCCESS - Using TEST DATA' : 'SUCCESS - Rewards Dashboard');
  Logger.success(isUsingTestData ? 'Displaying TEST data (API failed)' : 'Rewards data loaded successfully', {
    tierName: displayData.tier?.name,
    balance: displayData.balance,
    usingTestData: isUsingTestData
  });

  return (
    <BlockStack spacing="loose">
      {/* Show banner if using test data */}
      {isUsingTestData && (
        <Banner status="warning" title="Using test data">
          <Text>
            Unable to connect to API. Displaying sample data for testing. Error: {error}
          </Text>
        </Banner>
      )}

      {/* Store Credit and Membership Card */}
      <BalanceCard data={displayData} />

      {/* Recent Activity History */}
      <RewardsHistory data={displayData} />
    </BlockStack>
  );
}
