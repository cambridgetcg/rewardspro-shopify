/**
 * Tier Benefits Breakdown Component
 * Shows current tier perks and motivates progression to next tier
 * Following Shopify customer account UI extension best practices
 */

import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Divider,
} from '@shopify/ui-extensions-react/customer-account';
import { formatCurrency } from '../../utils/formatCurrency';
import type { LoyaltyData } from '../../types/loyalty';

interface TierBenefitsProps {
  data: LoyaltyData;
}

export function TierBenefits({ data }: TierBenefitsProps) {
  const { tier, nextTier, amountToNextTier, totalEarned, currency = 'USD' } = data;

  // Don't render if no tier data
  if (!tier) return null;

  // Determine badge tone based on tier name
  const getTierTone = (tierName: string): 'success' | 'info' | 'warning' | 'critical' => {
    const name = tierName.toLowerCase();
    if (name.includes('diamond') || name.includes('platinum')) return 'success';
    if (name.includes('gold')) return 'warning';
    if (name.includes('silver')) return 'info';
    return 'info';
  };

  return (
    <Card padding>
      <BlockStack spacing="base">
        {/* Card Title */}
        <Text variant="headingMd" as="h2">
          Tier benefits
        </Text>

        {/* Current Tier Section */}
        <BlockStack spacing="tight">
          <InlineStack spacing="tight" blockAlignment="center">
            <Text variant="headingSm" as="h3">
              Current tier
            </Text>
            <Badge tone={getTierTone(tier.name)}>
              {tier.name}
            </Badge>
          </InlineStack>
          <Text appearance="subdued" size="small">
            Member since you joined
          </Text>
        </BlockStack>

        <Divider />

        {/* Current Benefits List */}
        <BlockStack spacing="tight">
          <Text variant="headingSm" as="h3">
            Your benefits
          </Text>

          <BlockStack spacing="extraTight">
            {/* Cashback Rate */}
            <InlineStack spacing="tight" blockAlignment="start">
              <Text>•</Text>
              <Text>
                <Text emphasis="bold">{tier.cashbackPercent}% cashback</Text> on all purchases
              </Text>
            </InlineStack>

            {/* Total Earned */}
            {totalEarned !== undefined && totalEarned > 0 && (
              <InlineStack spacing="tight" blockAlignment="start">
                <Text>•</Text>
                <Text>
                  {formatCurrency(totalEarned, currency)} earned to date
                </Text>
              </InlineStack>
            )}

            {/* Minimum Spend Info (if not the base tier) */}
            {tier.minSpend > 0 && (
              <InlineStack spacing="tight" blockAlignment="start">
                <Text>•</Text>
                <Text appearance="subdued" size="small">
                  Qualified with {formatCurrency(tier.minSpend, currency)} in purchases
                </Text>
              </InlineStack>
            )}
          </BlockStack>
        </BlockStack>

        {/* Next Tier Section (if exists) */}
        {nextTier && (
          <>
            <Divider />

            <BlockStack spacing="tight">
              <InlineStack spacing="tight" blockAlignment="center">
                <Text variant="headingSm" as="h3">
                  Next level
                </Text>
                <Badge tone={getTierTone(nextTier.name)}>
                  {nextTier.name}
                </Badge>
              </InlineStack>

              {/* What they'll unlock */}
              <BlockStack spacing="extraTight">
                <InlineStack spacing="tight" blockAlignment="start">
                  <Text>•</Text>
                  <Text>
                    Unlock <Text emphasis="bold">{nextTier.cashbackPercent}% cashback</Text>
                    {' '}(+{nextTier.cashbackPercent - tier.cashbackPercent}% increase)
                  </Text>
                </InlineStack>
              </BlockStack>

              {/* Progress Message */}
              {amountToNextTier !== undefined && (
                <Text appearance="subdued">
                  Spend {formatCurrency(amountToNextTier, currency)} more to reach {nextTier.name}
                </Text>
              )}
            </BlockStack>
          </>
        )}

        {/* Max Tier Reached */}
        {!nextTier && (
          <>
            <Divider />
            <BlockStack spacing="tight">
              <InlineStack spacing="tight" blockAlignment="center">
                <Text variant="headingSm" as="h3">
                  VIP Status
                </Text>
                <Badge tone="success">
                  Maximum tier
                </Badge>
              </InlineStack>
              <Text appearance="subdued">
                You've reached the highest tier! Enjoy maximum cashback rewards on every purchase.
              </Text>
            </BlockStack>
          </>
        )}
      </BlockStack>
    </Card>
  );
}
