/**
 * Order Status Block - Shows points earned for completed order
 *
 * Uses useOrder() to access order context and displays personalized
 * points earned message based on actual order data.
 */

import { useState, useEffect } from 'react';
import {
  BlockStack,
  reactExtension,
  TextBlock,
  Banner,
  useApi,
  InlineStack,
  Icon,
  SkeletonText
} from "@shopify/ui-extensions-react/customer-account";
import { getApiUrl, isDebugEnabled } from './config';

const API_URL = getApiUrl();
const DEBUG_LOGS = isDebugEnabled();

export default reactExtension(
  "customer-account.order-status.block.render",
  () => <OrderRewardsBanner />
);

interface OrderPointsData {
  orderId: string;
  pointsEarned: number;
  cashbackPercent: number;
  orderTotal: number;
}

function OrderRewardsBanner() {
  const { i18n, sessionToken, extension } = useApi();
  const [pointsData, setPointsData] = useState<OrderPointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get order from extension context
  const order = extension.target === 'customer-account.order-status.block.render'
    ? (extension as any).order
    : null;

  useEffect(() => {
    if (!order || !order.id) {
      if (DEBUG_LOGS) {
        console.log('[OrderStatus] No order context available');
      }
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchOrderPoints() {
      if (DEBUG_LOGS) {
        console.log('[OrderStatus] Fetching points for order:', order.id);
      }

      try {
        setLoading(true);
        setError(null);

        // Get fresh session token
        const token = await sessionToken.get();

        // Call backend API to get points earned for this order
        const response = await fetch(`${API_URL}/order-points?orderId=${encodeURIComponent(order.id)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (isMounted) {
          if (DEBUG_LOGS) {
            console.log('[OrderStatus] Points data received:', data);
          }
          setPointsData(data);
        }
      } catch (err) {
        if (DEBUG_LOGS) {
          console.error('[OrderStatus] Error fetching order points:', err);
        }

        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load points');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchOrderPoints();

    return () => {
      isMounted = false;
    };
  }, [order?.id, sessionToken]);

  // Loading state
  if (loading) {
    return (
      <Banner>
        <BlockStack spacing="tight">
          <SkeletonText />
        </BlockStack>
      </Banner>
    );
  }

  // Error state - show generic message
  if (error) {
    if (DEBUG_LOGS) {
      console.warn('[OrderStatus] Showing fallback message due to error:', error);
    }

    return (
      <Banner>
        <BlockStack inlineAlignment="center">
          <TextBlock>
            {i18n.translate("earnPoints")}
          </TextBlock>
        </BlockStack>
      </Banner>
    );
  }

  // No order context - show generic message
  if (!order) {
    return (
      <Banner>
        <BlockStack inlineAlignment="center">
          <TextBlock>
            {i18n.translate("earnPoints")}
          </TextBlock>
        </BlockStack>
      </Banner>
    );
  }

  // Success state - show personalized points earned
  if (pointsData && pointsData.pointsEarned > 0) {
    return (
      <Banner status="success">
        <BlockStack spacing="base">
          <InlineStack spacing="tight" blockAlignment="center">
            <Icon source="star" />
            <TextBlock emphasis="bold">
              You earned {pointsData.pointsEarned} points!
            </TextBlock>
          </InlineStack>
          <TextBlock appearance="subdued" size="small">
            {pointsData.cashbackPercent}% cashback on your ${pointsData.orderTotal.toFixed(2)} order
          </TextBlock>
          <TextBlock size="small">
            Your points will be available once your order is fulfilled.
            Check your rewards dashboard for more details.
          </TextBlock>
        </BlockStack>
      </Banner>
    );
  }

  // No points earned (might be $0 order or points disabled)
  return (
    <Banner>
      <BlockStack inlineAlignment="center">
        <TextBlock>
          {i18n.translate("earnPoints")}
        </TextBlock>
      </BlockStack>
    </Banner>
  );
}
