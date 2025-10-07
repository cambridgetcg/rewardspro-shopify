/**
 * TypeScript types for RewardsPro loyalty data
 */

export interface LoyaltyData {
  success: boolean;
  enrolled: boolean;
  balance?: number;
  tier?: TierInfo;
  nextTier?: TierInfo;
  progressToNextTier?: number;
  amountToNextTier?: number;
  totalEarned?: number;
  stats?: CustomerStats;
  allTiers?: TierInfo[];
  recentTransactions?: Transaction[];
  currency?: string;
  message?: string;
  canEnroll?: boolean;
}

export interface TierInfo {
  name: string;
  cashbackPercent: number;
  minSpend: number;
}

export interface CustomerStats {
  orderCount: number;
  totalSpent: number;
  netSpent: number;
  averageCashbackPerOrder: number;
  lastOrderDate: string | null;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
}

export type TransactionType =
  | 'CASHBACK_EARNED'
  | 'ORDER_PAYMENT'
  | 'REFUND_CREDIT'
  | 'REFUND_CLAWBACK'
  | 'MANUAL_ADJUSTMENT'
  | 'SHOPIFY_SYNC';
