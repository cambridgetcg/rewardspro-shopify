/**
 * Rewards History Component
 * Displays transaction history using accessible table patterns
 * Following Shopify DataTable best practices for accessibility
 */

import { useState } from 'react';
import {
  Card,
  BlockStack,
  Text,
  Grid,
  GridItem,
  Button,
  InlineStack,
} from '@shopify/ui-extensions-react/customer-account';
import { formatCurrency } from '../../utils/formatCurrency';
import type { LoyaltyData } from '../../types/loyalty';

interface RewardsHistoryProps {
  data: LoyaltyData;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  date: string;
  description: string;
}

export function RewardsHistory({ data }: RewardsHistoryProps) {
  const { recentTransactions = [], currency = 'USD' } = data;
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  if (!recentTransactions || recentTransactions.length === 0) {
    return (
      <Card padding>
        <BlockStack spacing="base">
          <Text variant="headingMd" as="h2">
            Recent activity
          </Text>
          <Text appearance="subdued">
            No rewards activity yet. Start shopping to earn cashback!
          </Text>
        </BlockStack>
      </Card>
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil(recentTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = recentTransactions.slice(startIndex, endIndex);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get transaction type label
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'CASHBACK_EARNED':
        return 'Earned';
      case 'ORDER_PAYMENT':
        return 'Redeemed';
      case 'REFUND_CREDIT':
        return 'Refunded';
      case 'MANUAL_ADJUSTMENT':
        return 'Adjustment';
      default:
        return type;
    }
  };

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <Card padding>
      <BlockStack spacing="base">
        {/* Section Title - Semantic heading */}
        <Text variant="headingMd" as="h2">
          Recent activity
        </Text>

        {/* Transaction List */}
        <BlockStack spacing="base">
          {currentTransactions.map((transaction: Transaction) => (
            <Grid
              key={transaction.id}
              columns={['fill', 'auto']}
              spacing="base"
            >
              {/* Left: Date and Description */}
              <GridItem>
                <BlockStack spacing="extraTight">
                  <Text>{transaction.description}</Text>
                  <Text appearance="subdued" size="small">
                    {formatDate(transaction.date)} · {getTypeLabel(transaction.type)}
                  </Text>
                </BlockStack>
              </GridItem>

              {/* Right: Amount */}
              <GridItem>
                <Text
                  variant="bodyLg"
                  appearance={transaction.amount > 0 ? 'success' : 'subdued'}
                >
                  {transaction.amount > 0 ? '+' : ''}
                  {formatCurrency(Math.abs(transaction.amount), currency)}
                </Text>
              </GridItem>
            </Grid>
          ))}
        </BlockStack>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <InlineStack spacing="base" blockAlignment="center" inlineAlignment="center">
            <Button
              onPress={handlePrevious}
              disabled={currentPage === 1}
              kind="secondary"
            >
              Previous
            </Button>
            <Text appearance="subdued" size="small">
              Page {currentPage} of {totalPages}
            </Text>
            <Button
              onPress={handleNext}
              disabled={currentPage === totalPages}
              kind="secondary"
            >
              Next
            </Button>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}
