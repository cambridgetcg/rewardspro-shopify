/**
 * Balance Card Component
 * Displays current store credit balance and tier information
 */

import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
} from '@shopify/ui-extensions-react/customer-account';
import { formatCurrency } from '../../utils/formatCurrency';
import type { LoyaltyData } from '../../types/loyalty';

interface BalanceCardProps {
  data: LoyaltyData;
}

export function BalanceCard({ data }: BalanceCardProps) {
  const { balance = 0, tier, totalEarned = 0, currency = 'USD' } = data;

  // Determine tier badge tone based on tier name
  const getTierTone = (tierName: string): 'success' | 'info' | 'warning' | 'critical' => {
    const name = tierName.toLowerCase();
    if (name.includes('platinum') || name.includes('diamond')) return 'success';
    if (name.includes('gold')) return 'warning';
    if (name.includes('silver')) return 'info';
    return 'info'; // default
  };

  return (
    <Card>
      <BlockStack spacing="loose">
        {/* Header */}
        <InlineStack spacing="loose" blockAlignment="center">
          <Text variant="headingMd">
            Rewards Balance
          </Text>
          {tier && (
            <Badge tone={getTierTone(tier.name)}>
              {tier.name}
            </Badge>
          )}
        </InlineStack>

        {/* Balance Amount - Hero Section */}
        <BlockStack spacing="tight">
          <Text variant="heading2xl">
            {formatCurrency(balance, currency)}
          </Text>
          <Text appearance="subdued" size="small">
            Available to use
          </Text>
        </BlockStack>

        {/* Tier Info */}
        {tier && (
          <BlockStack spacing="tight">
            <Text>
              Earning {tier.cashbackPercent}% cashback on purchases
            </Text>
          </BlockStack>
        )}

        {/* Lifetime Earned */}
        {totalEarned > 0 && (
          <Text appearance="subdued" size="small">
            Total earned: {formatCurrency(totalEarned, currency)}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}
