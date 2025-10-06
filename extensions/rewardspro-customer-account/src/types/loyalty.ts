/**
 * TypeScript types for RewardsPro loyalty data
 */

export interface LoyaltyData {
  success: boolean;
  enrolled: boolean;
  balance?: number;
  tier?: TierInfo;
  totalEarned?: number;
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
