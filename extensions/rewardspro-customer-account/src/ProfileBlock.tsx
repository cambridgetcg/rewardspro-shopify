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

function LoyaltyProfileBlock() {
  Logger.mount('ProfileBlock');

  const { data, loading, error } = useLoyaltyData();

  useEffect(() => {
    Logger.stateChange('ProfileBlock', {
      loading,
      hasError: !!error,
      errorMessage: error,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : null,
      enrolled: data?.enrolled,
      timestamp: new Date().toISOString()
    });
  }, [data, loading, error]);

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

  // Error state - accessible error banner
  if (error) {
    Logger.render('ProfileBlock', `ERROR - ${error}`);
    return (
      <Banner status="critical" title="Unable to load rewards">
        <BlockStack spacing="tight">
          <Text>
            We're having trouble loading your rewards information. Please try refreshing the page.
          </Text>
          <Text appearance="subdued" size="small">
            Error: {error}
          </Text>
        </BlockStack>
      </Banner>
    );
  }

  // No data state
  if (!data) {
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
  if (!data.enrolled) {
    Logger.render('ProfileBlock', 'NOT ENROLLED');
    return (
      <Banner status="info" title="Join our rewards program">
        <BlockStack spacing="base">
          <Text>
            Start earning cashback on every purchase! Get exclusive member benefits and rewards.
          </Text>
          {data.message && (
            <Text appearance="subdued" size="small">
              {data.message}
            </Text>
          )}
        </BlockStack>
      </Banner>
    );
  }

  // Success state - Display rewards dashboard
  // Following mobile-first responsive layout with vertical stacking
  // Cards don't add external margins - BlockStack with spacing separates them
  Logger.render('ProfileBlock', 'SUCCESS - Rewards Dashboard');
  Logger.success('Rewards data loaded successfully', {
    tierName: data.memberData?.tierName,
    storeCredit: data.memberData?.storeCredit
  });

  return (
    <BlockStack spacing="loose">
      {/* Store Credit and Membership Card */}
      <BalanceCard data={data} />

      {/* Recent Activity History */}
      <RewardsHistory data={data} />
    </BlockStack>
  );
}
