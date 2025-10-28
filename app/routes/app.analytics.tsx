import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useNavigate, useSearchParams, useFetcher } from "@remix-run/react";
import { useState, useCallback, useMemo } from "react";
import {
  Page,
  Layout,
  Card,
  Grid,
  Text,
  Badge,
  Button,
  Select,
  Tabs,
  BlockStack,
  InlineStack,
  Banner,
  Box,
  Divider,
  DataTable,
  ProgressBar,
  EmptyState,
  SkeletonBodyText,
  SkeletonDisplayText,
  ButtonGroup,
  TextField,
  FormLayout,
} from "@shopify/polaris";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
import {
  MetricCard,
  StatsOverview,
  EnhancedDataTable,
  LoadingSkeleton,
  ActionBanner,
} from "../components/DesignSystem";
import {
  ChartVerticalIcon,
  PersonIcon,
  CashDollarIcon,
  RewardIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "~/utils/polaris-icons";
import { TierBadge, TierIndicator, TierProgress } from "../components/TierBadge";
import { getTierStyle, sortTiersByPriority, formatTierName } from "../utils/tier-styles";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { formatCurrency } from "../utils/currency";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface AnalyticsData {
  // Overview metrics - NEW STRUCTURE
  monthlyOrderFrequency: number; // Orders per customer per month
  revenuePerOrder: number; // Average revenue per order
  grossProfitPerCustomerPerMonth: number; // Monthly gross profit per customer

  // Tier analytics - SIMPLIFIED
  tierPerformance: {
    id: string;
    name: string;
    members: number;
    cashbackPercent: number;
    monthlyOrderFrequency: number;
    revenuePerOrder: number;
    grossProfitPerCustomerPerMonth: number;
  }[];

  // Monthly time-series data for charts (last 12 months)
  monthlyTierTrends: {
    month: string; // e.g., "Jan 2025"
    tiers: {
      tierName: string;
      orderFrequency: number;
      revenuePerOrder: number;
      grossProfit: number;
    }[];
  }[];

  // Placeholder for future implementation
  trends: {
    revenue: TrendData[];
    members: TrendData[];
    orders: TrendData[];
    credit: TrendData[];
  };

  insights: {
    opportunities: Insight[];
    warnings: Insight[];
    successes: Insight[];
  };

  financial: {
    directRevenue: number;
    creditIssued: number;
    creditRedeemed: number;
    netValue: number;
    roi: number;
    costBreakdown: {
      creditCost: number;
      operationalCost: number;
    };
  };
  
  // Customer segments
  segments: {
    vip: { count: number; revenue: number; avgCredit: number; };
    atRisk: { count: number; revenue: number; churnRisk: number; };
    new: { count: number; revenue: number; activationRate: number; };
    dormant: { count: number; lastRevenue: number; daysSinceLastOrder: number; };
  };
  
  // Comparison data
  comparison: {
    period: 'week' | 'month' | 'quarter' | 'year';
    current: number;
    previous: number;
    change: number;
  };
  
  shopSettings: {
    storeCurrency: string;
    currencyDisplayType: string;
    averageProfitMargin: string | null;
    averageCogsPercent: string | null;
    averageShippingCost: string | null;
    averageOrderValue: string | null;
    targetRoiPercent: string | null;
    metricsLastUpdated: string | null;
  } | null;
}

interface TrendData {
  date: string;
  value: number;
  label?: string;
}

interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'success' | 'info';
  title: string;
  description: string;
  metric?: string;
  priority: 'high' | 'medium' | 'low';
  action?: string;
  impact?: string;
}

// ============================================
// LOADER - Fetch and calculate analytics
// ============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const shop = session.shop;

  try {
    // Fetch minimal data for UI structure
    const [shopSettings, tiers] = await Promise.all([
      db.shopSettings.findUnique({ where: { shop } }),
      db.tier.findMany({
        where: { shop },
        orderBy: { minSpend: 'asc' },
      }),
    ]);

    // PLACEHOLDER DATA - Will be replaced with real data fetching later
    // Realistic data for a medium-sized shop with ~1000 members
    const analyticsData: AnalyticsData = {
      // Overview metrics with placeholder values (weighted average across all tiers)
      monthlyOrderFrequency: 2.83, // Average orders per customer per month
      revenuePerOrder: 142.75, // Average revenue per order
      grossProfitPerCustomerPerMonth: 121.48, // Monthly gross profit per customer

      // Tier performance with realistic mock data (current month)
      // Distribution: ~1000 members across tiers (more in lower tiers, fewer in higher)
      // Metrics show progression: higher tiers order more frequently with higher AOV
      tierPerformance: tiers.map((tier, index) => {
        // Realistic member distribution (decreases as tiers get higher)
        const memberCounts = [453, 312, 178, 57]; // Total: 1000 members
        // Realistic order frequency (increases with tier) - CURRENT month values
        const orderFrequencies = [1.47, 2.64, 3.89, 5.28];
        // Realistic revenue per order (increases with tier) - CURRENT month values
        const revenuePerOrders = [87.23, 118.45, 176.82, 263.17];
        // Realistic monthly gross profit per customer - CURRENT month values
        const grossProfits = [38.47, 93.82, 206.34, 417.19];

        return {
          id: tier.id,
          name: tier.name,
          members: memberCounts[index] || 50,
          cashbackPercent: tier.cashbackPercent,
          monthlyOrderFrequency: orderFrequencies[index] || 2.0,
          revenuePerOrder: revenuePerOrders[index] || 100,
          grossProfitPerCustomerPerMonth: grossProfits[index] || 60,
        };
      }),

      // Generate 12 months of historical data for time-series charts
      monthlyTierTrends: (() => {
        const months = [];
        const now = new Date();

        // Generate last 12 months
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthName = date.toLocaleDateString('en-US', { month: 'short' }); // Use 3-letter month names per Polaris guidelines

          // Base values for each tier (12 months ago)
          const baseOrderFreqs = [1.12, 2.08, 3.21, 4.67];
          const baseRevenues = [79.45, 105.23, 151.34, 228.91];
          const baseGrossProfits = [26.78, 65.71, 145.92, 320.84];

          // Current values (from tierPerformance above)
          const currentOrderFreqs = [1.47, 2.64, 3.89, 5.28];
          const currentRevenues = [87.23, 118.45, 176.82, 263.17];
          const currentGrossProfits = [38.47, 93.82, 206.34, 417.19];

          months.push({
            month: monthName,
            tiers: tiers.map((tier, index) => {
              // Calculate growth progress (0 to 1) from oldest to newest
              const progress = (11 - i) / 11;

              // Interpolate between base and current values with some randomness
              const randomFactor = 0.95 + (Math.random() * 0.1); // ±5% variance

              const orderFreq = baseOrderFreqs[index] +
                (currentOrderFreqs[index] - baseOrderFreqs[index]) * progress * randomFactor;

              const revenue = baseRevenues[index] +
                (currentRevenues[index] - baseRevenues[index]) * progress * randomFactor;

              const grossProfit = baseGrossProfits[index] +
                (currentGrossProfits[index] - baseGrossProfits[index]) * progress * randomFactor;

              return {
                tierName: tier.name,
                orderFrequency: Math.round(orderFreq * 100) / 100,
                revenuePerOrder: Math.round(revenue * 100) / 100,
                grossProfit: Math.round(grossProfit * 100) / 100,
              };
            }),
          });
        }

        return months;
      })(),

      // Placeholder trend data (empty for now)
      trends: {
        revenue: [],
        members: [],
        orders: [],
        credit: [],
      },

      // Placeholder insights
      insights: {
        opportunities: [],
        warnings: [],
        successes: [],
      },

      // Placeholder financial data
      financial: {
        directRevenue: 0,
        creditIssued: 0,
        creditRedeemed: 0,
        netValue: 0,
        roi: 0,
        costBreakdown: {
          creditCost: 0,
          operationalCost: 0,
        },
      },

      // Placeholder segments
      segments: {
        vip: { count: 0, revenue: 0, avgCredit: 0 },
        atRisk: { count: 0, revenue: 0, churnRisk: 0 },
        new: { count: 0, revenue: 0, activationRate: 0 },
        dormant: { count: 0, lastRevenue: 0, daysSinceLastOrder: 0 },
      },

      // Placeholder comparison
      comparison: {
        period: 'month' as const,
        current: 0,
        previous: 0,
        change: 0,
      },

      shopSettings: shopSettings ? {
        storeCurrency: shopSettings.storeCurrency,
        currencyDisplayType: shopSettings.currencyDisplayType,
        averageProfitMargin: shopSettings.averageProfitMargin?.toString() || null,
        averageCogsPercent: shopSettings.averageCogsPercent?.toString() || null,
        averageShippingCost: shopSettings.averageShippingCost?.toString() || null,
        averageOrderValue: shopSettings.averageOrderValue?.toString() || null,
        targetRoiPercent: shopSettings.targetRoiPercent?.toString() || null,
        metricsLastUpdated: shopSettings.metricsLastUpdated?.toISOString() || null,
      } : null,
    };

    return json(analyticsData);
  } catch (error) {
    console.error("Analytics loader error:", error);
    throw new Response("Failed to load analytics", { status: 500 });
  }
};

// ============================================
// ACTION - Handle form submissions
// ============================================

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "save-metrics") {
    const parseDecimal = (value: string | null) => {
      if (!value || value.trim() === "") return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    await db.shopSettings.update({
      where: { shop },
      data: {
        averageProfitMargin: parseDecimal(formData.get("averageProfitMargin") as string),
        averageCogsPercent: parseDecimal(formData.get("averageCogsPercent") as string),
        averageShippingCost: parseDecimal(formData.get("averageShippingCost") as string),
        averageOrderValue: parseDecimal(formData.get("averageOrderValue") as string),
        targetRoiPercent: parseDecimal(formData.get("targetRoiPercent") as string),
        metricsLastUpdated: new Date(),
      },
    });

    return json({ success: true, message: "Business metrics updated successfully" });
  }

  return json({ success: false, message: "Invalid action" });
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Chart.js Configuration for Shopify Analytics Style
const getShopifyChartOptions = (yAxisConfig?: {
  max?: number;
  callback?: (value: any) => string;
}): ChartOptions<'line'> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false, // We'll use custom legend
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      cornerRadius: 4,
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: {
        display: false, // No vertical grid lines
      },
      ticks: {
        color: '#8c9196',
        font: {
          size: 12,
        },
      },
      border: {
        display: false,
      },
    },
    y: {
      beginAtZero: true,
      max: yAxisConfig?.max,
      grid: {
        color: '#e3e5e7',
        lineWidth: 0.5,
      },
      ticks: {
        color: '#8c9196',
        font: {
          size: 12,
        },
        callback: yAxisConfig?.callback || ((value) => value.toString()),
      },
      border: {
        display: false,
      },
    },
  },
  elements: {
    line: {
      tension: 0.1, // Slight curve for smoother lines
      borderWidth: 2,
    },
    point: {
      radius: 0, // No points by default
      hitRadius: 8, // Larger hit area for hover
      hoverRadius: 4, // Show point on hover
    },
  },
  interaction: {
    mode: 'index',
    intersect: false,
  },
});

const getShopifyBarChartOptions = (isHorizontal = false): ChartOptions<'bar'> => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: isHorizontal ? 'y' : 'x',
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      cornerRadius: 4,
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: {
        display: !isHorizontal,
        color: '#e3e5e7',
        lineWidth: 0.5,
      },
      ticks: {
        color: '#8c9196',
        font: {
          size: 12,
        },
      },
      border: {
        display: false,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        display: isHorizontal,
        color: '#e3e5e7',
        lineWidth: 0.5,
      },
      ticks: {
        color: '#8c9196',
        font: {
          size: 12,
        },
      },
      border: {
        display: false,
      },
    },
  },
});

function generateTrendData(customers: any[], transactions: any[]): AnalyticsData['trends'] {
  // Legacy function - keeping for backward compatibility
  // Generate mock trend data for last 30 days
  const days = 30;
  const trends = {
    revenue: [] as TrendData[],
    members: [] as TrendData[],
    orders: [] as TrendData[],
    credit: [] as TrendData[],
  };

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Mock data with some randomness
    trends.revenue.push({
      date: dateStr,
      value: 1000 + Math.random() * 500 + (30 - i) * 20,
    });

    trends.members.push({
      date: dateStr,
      value: Math.max(0, customers.length - i + Math.floor(Math.random() * 5)),
    });

    trends.orders.push({
      date: dateStr,
      value: Math.floor(10 + Math.random() * 20),
    });

    trends.credit.push({
      date: dateStr,
      value: 500 + Math.random() * 200,
    });
  }

  return trends;
}

function generateTrendDataFromOrders(
  orders: any[],
  customers: any[],
  transactions: any[],
  startDate: Date | null
): AnalyticsData['trends'] {
  // Generate trend data from actual orders
  const trends = {
    revenue: [] as TrendData[],
    members: [] as TrendData[],
    orders: [] as TrendData[],
    credit: [] as TrendData[],
  };

  // Determine the trend period (last 30 days for display, regardless of filter)
  const trendDays = 30;
  const now = new Date();

  // Group orders and transactions by date
  const ordersByDate = new Map<string, any[]>();
  const transactionsByDate = new Map<string, any[]>();
  const customersByDate = new Map<string, Set<string>>();

  orders.forEach(order => {
    const dateStr = new Date(order.shopifyCreatedAt).toISOString().split('T')[0];
    if (!ordersByDate.has(dateStr)) {
      ordersByDate.set(dateStr, []);
    }
    ordersByDate.get(dateStr)!.push(order);

    // Track unique customers per day
    if (!customersByDate.has(dateStr)) {
      customersByDate.set(dateStr, new Set());
    }
    customersByDate.get(dateStr)!.add(order.customerId);
  });

  transactions.forEach(transaction => {
    const dateStr = new Date(transaction.createdAt).toISOString().split('T')[0];
    if (!transactionsByDate.has(dateStr)) {
      transactionsByDate.set(dateStr, []);
    }
    transactionsByDate.get(dateStr)!.push(transaction);
  });

  // Generate data for each day
  for (let i = trendDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayOrders = ordersByDate.get(dateStr) || [];
    const dayTransactions = transactionsByDate.get(dateStr) || [];
    const dayCustomers = customersByDate.get(dateStr) || new Set();

    // Calculate daily revenue from orders
    const dayRevenue = dayOrders.reduce((sum, order) =>
      sum + parseFloat(order.netAmount?.toString() || '0'), 0
    );

    // Calculate daily credit issued
    const dayCreditIssued = dayTransactions
      .filter(t => t.type === 'CASHBACK_EARNED' || t.type === 'MANUAL_ADJUSTMENT')
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount?.toString() || '0')), 0);

    trends.revenue.push({
      date: dateStr,
      value: Math.round(dayRevenue * 100) / 100,
    });

    trends.members.push({
      date: dateStr,
      value: dayCustomers.size,
    });

    trends.orders.push({
      date: dateStr,
      value: dayOrders.length,
    });

    trends.credit.push({
      date: dateStr,
      value: Math.round(dayCreditIssued * 100) / 100,
    });
  }

  return trends;
}

function calculateTierPerformance(
  tiers: any[],
  customers: any[],
  transactions: any[]
): AnalyticsData['tierPerformance'] {
  // Legacy function - keeping for backward compatibility
  return tiers.map((tier, index) => {
    const tierCustomers = customers.filter(c => c.currentTierId === tier.id);
    const tierTransactions = transactions.filter(t =>
      tierCustomers.some(c => c.id === t.customerId)
    );

    const cashbackEarned = tierTransactions
      .filter(t => t.type === 'CASHBACK_EARNED')
      .reduce((sum, t) => sum + Math.abs(t.amount ? parseFloat(t.amount.toString()) : 0), 0);

    const estimatedRevenue = tier.cashbackPercent > 0
      ? (cashbackEarned / (tier.cashbackPercent / 100))
      : 0;

    const creditRedeemed = tierTransactions
      .filter(t => t.type === 'ORDER_PAYMENT')
      .reduce((sum, t) => sum + Math.abs(t.amount ? parseFloat(t.amount.toString()) : 0), 0);

    const revenue = Math.round((estimatedRevenue + creditRedeemed) * 100) / 100;

    const creditBalance = Math.round(tierCustomers.reduce((sum, c) =>
      sum + (c.storeCredit ? parseFloat(c.storeCredit.toString()) : 0), 0
    ) * 100) / 100;

    const avgSpend = tierCustomers.length > 0 ? Math.round((revenue / tierCustomers.length) * 100) / 100 : 0;

    return {
      id: tier.id,
      name: tier.name,
      members: tierCustomers.length,
      revenue,
      avgSpend,
      retention: 75 + Math.random() * 20, // Mock retention rate
      creditBalance,
      cashbackPercent: tier.cashbackPercent,
      upgradeRate: index < tiers.length - 1 ? 15 + Math.random() * 10 : undefined,
    };
  });
}

function calculateTierPerformanceFromOrders(
  tiers: any[],
  orders: any[],
  customers: any[],
  transactions: any[]
): AnalyticsData['tierPerformance'] {
  return tiers.map((tier, index) => {
    const tierCustomers = customers.filter(c => c.currentTierId === tier.id);
    const tierCustomerIds = new Set(tierCustomers.map(c => c.id));

    // Get orders from tier customers
    const tierOrders = orders.filter(order => tierCustomerIds.has(order.customerId));

    // Calculate actual revenue from orders
    const revenue = tierOrders.reduce((sum, order) =>
      sum + parseFloat(order.netAmount?.toString() || '0'), 0
    );

    // Calculate cashback from orders
    const cashbackEarned = tierOrders.reduce((sum, order) =>
      sum + parseFloat(order.cashbackAmount?.toString() || '0'), 0
    );

    // Get credit balance for tier customers
    const creditBalance = tierCustomers.reduce((sum, c) =>
      sum + (c.storeCredit ? parseFloat(c.storeCredit.toString()) : 0), 0
    );

    // Calculate average spend per customer
    const avgSpend = tierCustomers.length > 0 ? revenue / tierCustomers.length : 0;

    // Calculate retention rate based on recent orders
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeInLast30Days = tierOrders.filter(order =>
      new Date(order.shopifyCreatedAt) >= thirtyDaysAgo
    ).length;
    const retention = tierCustomers.length > 0
      ? (activeInLast30Days / tierCustomers.length) * 100
      : 0;

    // Calculate upgrade potential (customers close to next tier)
    let upgradeRate: number | undefined;
    if (index < tiers.length - 1) {
      const nextTier = tiers[index + 1];
      // This would need customer lifetime spending data
      // For now, use a placeholder
      upgradeRate = 15 + Math.random() * 10;
    }

    return {
      id: tier.id,
      name: tier.name,
      members: tierCustomers.length,
      revenue: Math.round(revenue * 100) / 100,
      avgSpend: Math.round(avgSpend * 100) / 100,
      retention: Math.round(retention * 100) / 100,
      creditBalance: Math.round(creditBalance * 100) / 100,
      cashbackPercent: tier.cashbackPercent,
      upgradeRate,
    };
  });
}

function generateInsights(
  customers: any[],
  tiers: any[],
  creditUtilization: number,
  conversionRate: number,
  tierPerformance: any[]
): AnalyticsData['insights'] {
  const insights = {
    opportunities: [] as Insight[],
    warnings: [] as Insight[],
    successes: [] as Insight[],
  };
  
  // Check for opportunities
  const customersNearUpgrade = customers.filter(c => {
    if (!c.currentTier) return false;
    const nextTier = tiers.find(t => t.minSpend > c.currentTier.minSpend);
    // Since we don't have lifetimeSpend, we can't calculate near upgrades accurately
    // This would need to be calculated from order history
    return false;
  }).length;
  
  if (customersNearUpgrade > 0) {
    insights.opportunities.push({
      id: 'near-upgrade',
      type: 'opportunity',
      title: 'Customers Near Tier Upgrade',
      description: `${customersNearUpgrade} customers are within $100 of reaching the next tier`,
      metric: `${customersNearUpgrade} customers`,
      priority: 'high',
      action: 'Send targeted campaign',
      impact: 'Potential 15% increase in engagement',
    });
  }
  
  // Check for warnings
  if (creditUtilization < 30) {
    insights.warnings.push({
      id: 'low-utilization',
      type: 'warning',
      title: 'Low Credit Utilization',
      description: 'Customers are not using their earned credits effectively',
      metric: `${creditUtilization.toFixed(0)}% utilization`,
      priority: 'medium',
      action: 'Create credit expiry or bonus events',
      impact: 'Could increase revenue by 20%',
    });
  }
  
  const noTierCustomers = customers.filter(c => !c.currentTierId).length;
  if (noTierCustomers > customers.length * 0.3) {
    insights.warnings.push({
      id: 'many-no-tier',
      type: 'warning',
      title: 'Many Customers Without Tiers',
      description: `${((noTierCustomers / customers.length) * 100).toFixed(0)}% of customers aren't in a loyalty tier`,
      metric: `${noTierCustomers} customers`,
      priority: 'high',
      action: 'Review tier requirements',
      impact: 'Missing engagement opportunity',
    });
  }
  
  // Check for successes
  if (conversionRate > 50) {
    insights.successes.push({
      id: 'high-conversion',
      type: 'success',
      title: 'High Loyalty Conversion',
      description: 'More than half of your customers are actively engaged',
      metric: `${conversionRate.toFixed(0)}% conversion`,
      priority: 'low',
      action: 'Maintain current strategy',
    });
  }
  
  const topTier = tierPerformance[tierPerformance.length - 1];
  if (topTier && topTier.retention > 90) {
    insights.successes.push({
      id: 'high-retention',
      type: 'success',
      title: 'Excellent Top Tier Retention',
      description: `${topTier.name} tier has ${topTier.retention.toFixed(0)}% retention rate`,
      metric: `${topTier.retention.toFixed(0)}% retention`,
      priority: 'low',
      action: 'Consider exclusive perks',
    });
  }
  
  return insights;
}

function calculateCustomerSegments(customers: any[], transactions: any[]): AnalyticsData['segments'] {
  // Legacy function - keeping for backward compatibility
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

  // VIP customers (top 10% by credit balance)
  const sortedByCredit = [...customers].sort((a, b) => {
    const aCredit = a.storeCredit ? parseFloat(a.storeCredit.toString()) : 0;
    const bCredit = b.storeCredit ? parseFloat(b.storeCredit.toString()) : 0;
    return bCredit - aCredit;
  });
  const vipCount = Math.ceil(customers.length * 0.1);
  const vipCustomers = sortedByCredit.slice(0, vipCount);

  // At-risk customers (no activity in 30-60 days)
  const atRiskCustomers = customers.filter(c => {
    const lastTransaction = transactions
      .filter(t => t.customerId === c.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    return lastTransaction &&
           new Date(lastTransaction.createdAt).getTime() < thirtyDaysAgo &&
           new Date(lastTransaction.createdAt).getTime() > sixtyDaysAgo;
  });

  // New customers (joined in last 30 days)
  const newCustomers = customers.filter(c =>
    new Date(c.createdAt).getTime() > thirtyDaysAgo
  );

  // Dormant customers (no activity in 60+ days)
  const dormantCustomers = customers.filter(c => {
    const lastTransaction = transactions
      .filter(t => t.customerId === c.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    return !lastTransaction || new Date(lastTransaction.createdAt).getTime() < sixtyDaysAgo;
  });

  return {
    vip: {
      count: vipCustomers.length,
      revenue: vipCustomers.length * 500, // Mock revenue
      avgCredit: vipCustomers.reduce((sum, c) => sum + (c.storeCredit ? parseFloat(c.storeCredit.toString()) : 0), 0) / Math.max(1, vipCustomers.length),
    },
    atRisk: {
      count: atRiskCustomers.length,
      revenue: atRiskCustomers.length * 200,
      churnRisk: 35,
    },
    new: {
      count: newCustomers.length,
      revenue: newCustomers.length * 150,
      activationRate: 62,
    },
    dormant: {
      count: dormantCustomers.length,
      lastRevenue: dormantCustomers.length * 100,
      daysSinceLastOrder: 75,
    },
  };
}

function calculateCustomerSegmentsFromOrders(
  customers: any[],
  orders: any[],
  customerSpendingMap: Map<string, { totalSpent: number, orderCount: number, lastOrderDate: Date | null }>
): AnalyticsData['segments'] {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

  // VIP customers (top 10% by total spending)
  const customersWithSpending = customers.map(c => ({
    customer: c,
    spending: customerSpendingMap.get(c.id)?.totalSpent || 0,
    orderCount: customerSpendingMap.get(c.id)?.orderCount || 0,
    lastOrderDate: customerSpendingMap.get(c.id)?.lastOrderDate || null
  }));

  const sortedBySpending = [...customersWithSpending].sort((a, b) => b.spending - a.spending);
  const vipCount = Math.ceil(customers.length * 0.1);
  const vipCustomers = sortedBySpending.slice(0, vipCount);

  // Calculate VIP metrics
  const vipRevenue = vipCustomers.reduce((sum, vc) => sum + vc.spending, 0);
  const vipAvgCredit = vipCustomers.reduce((sum, vc) =>
    sum + (vc.customer.storeCredit ? parseFloat(vc.customer.storeCredit.toString()) : 0), 0
  ) / Math.max(1, vipCustomers.length);

  // At-risk customers (no orders in 30-60 days)
  const atRiskCustomers = customersWithSpending.filter(c => {
    if (!c.lastOrderDate) return false;
    const lastOrderTime = c.lastOrderDate.getTime();
    return lastOrderTime < thirtyDaysAgo && lastOrderTime > sixtyDaysAgo;
  });

  const atRiskRevenue = atRiskCustomers.reduce((sum, c) => sum + c.spending, 0);

  // New customers (joined in last 30 days)
  const newCustomers = customers.filter(c =>
    new Date(c.createdAt).getTime() > thirtyDaysAgo
  );

  // Calculate new customer activation rate
  const newCustomersWithOrders = newCustomers.filter(c =>
    customerSpendingMap.has(c.id) && customerSpendingMap.get(c.id)!.orderCount > 0
  );
  const activationRate = newCustomers.length > 0
    ? (newCustomersWithOrders.length / newCustomers.length) * 100
    : 0;

  const newCustomerRevenue = newCustomers.reduce((sum, c) =>
    sum + (customerSpendingMap.get(c.id)?.totalSpent || 0), 0
  );

  // Dormant customers (no orders in 60+ days or never ordered)
  const dormantCustomers = customersWithSpending.filter(c => {
    if (!c.lastOrderDate) return true; // Never ordered
    return c.lastOrderDate.getTime() < sixtyDaysAgo;
  });

  const dormantRevenue = dormantCustomers.reduce((sum, c) => sum + c.spending, 0);

  // Calculate average days since last order for dormant customers
  const dormantWithOrders = dormantCustomers.filter(c => c.lastOrderDate);
  const avgDaysSinceLastOrder = dormantWithOrders.length > 0
    ? dormantWithOrders.reduce((sum, c) => {
        const days = Math.floor((now - c.lastOrderDate!.getTime()) / (24 * 60 * 60 * 1000));
        return sum + days;
      }, 0) / dormantWithOrders.length
    : 0;

  // Calculate churn risk for at-risk segment
  const churnRisk = atRiskCustomers.length > 0 && customersWithSpending.length > 0
    ? (atRiskCustomers.length / customersWithSpending.filter(c => c.orderCount > 0).length) * 100
    : 0;

  return {
    vip: {
      count: vipCustomers.length,
      revenue: Math.round(vipRevenue * 100) / 100,
      avgCredit: Math.round(vipAvgCredit * 100) / 100,
    },
    atRisk: {
      count: atRiskCustomers.length,
      revenue: Math.round(atRiskRevenue * 100) / 100,
      churnRisk: Math.round(churnRisk * 100) / 100,
    },
    new: {
      count: newCustomers.length,
      revenue: Math.round(newCustomerRevenue * 100) / 100,
      activationRate: Math.round(activationRate * 100) / 100,
    },
    dormant: {
      count: dormantCustomers.length,
      lastRevenue: Math.round(dormantRevenue * 100) / 100,
      daysSinceLastOrder: Math.round(avgDaysSinceLastOrder),
    },
  };
}

// ============================================
// COMPONENTS
// ============================================

function AnalyticsMetricCard({ 
  title, 
  value, 
  change, 
  trend, 
  loading, 
  delay = 0 
}: {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  delay?: number;
}) {
  if (loading) {
    return <LoadingSkeleton type="card" lines={3} />;
  }

  const getTrendIcon = () => {
    if (trend === 'up') return ArrowUpIcon;
    if (trend === 'down') return ArrowDownIcon;
    return ChartVerticalIcon;
  };

  const getTone = () => {
    if (trend === 'up') return 'success';
    if (trend === 'down') return 'critical';
    return 'default';
  };

  return (
    <MetricCard
      title={title}
      value={value.toString()}
      change={change}
      icon={getTrendIcon()}
      tone={getTone() as any}
    />
  );
}


function InsightCard({ insight }: { insight: Insight }) {

  const getTone = () => {
    switch (insight.type) {
      case 'opportunity': return 'magic';
      case 'warning': return 'warning';
      case 'success': return 'success';
      default: return 'info';
    }
  };

  return (
    <Box 
      padding="400" 
      background={`bg-surface-${getTone()}-subdued` as any}
      borderInlineStartWidth="025"
      borderColor={`border-${getTone()}` as any}
      borderRadius="200"
    >
      <BlockStack gap="300">
        <InlineStack align="space-between">
          <Text variant="headingSm" as="h4">
            {insight.title}
          </Text>
          {insight.priority && (
            <Badge tone="critical">
              {`${insight.priority} priority`}
            </Badge>
          )}
        </InlineStack>
        
        <Text variant="bodyMd" as="p">
          {insight.description}
        </Text>
        
        {insight.metric && (
          <Text variant="headingLg" as="p" tone={getTone() as any}>
            {insight.metric}
          </Text>
        )}
        
        {insight.action && (
          <InlineStack gap="200">
            <Button size="slim" tone={getTone() as any}>
              {insight.action}
            </Button>
            {insight.impact && (
              <Text variant="bodySm" tone="subdued" as="span">
                {insight.impact}
              </Text>
            )}
          </InlineStack>
        )}
      </BlockStack>
    </Box>
  );
}

// ============================================
// MARGIN RECALIBRATION FORM COMPONENT
// ============================================

interface MarginRecalibrationFormProps {
  initialValues: {
    averageProfitMargin: string;
    averageCogsPercent: string;
    averageShippingCost: string;
    averageOrderValue: string;
    targetRoiPercent: string;
  };
}

function MarginRecalibrationForm({ initialValues }: MarginRecalibrationFormProps) {
  const fetcher = useFetcher();

  const [formValues, setFormValues] = useState(initialValues);

  const handleChange = useCallback((field: string) => (value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "save-metrics");
    formData.append("averageProfitMargin", formValues.averageProfitMargin);
    formData.append("averageCogsPercent", formValues.averageCogsPercent);
    formData.append("averageShippingCost", formValues.averageShippingCost);
    formData.append("averageOrderValue", formValues.averageOrderValue);
    formData.append("targetRoiPercent", formValues.targetRoiPercent);

    fetcher.submit(formData, { method: "post" });
  }, [formValues, fetcher]);

  const isSaving = fetcher.state === "submitting";
  const showSuccess = fetcher.data?.success && fetcher.state === "idle";

  return (
    <BlockStack gap="400">
      {showSuccess && (
        <Banner tone="success" onDismiss={() => {}}>
          Business metrics updated successfully
        </Banner>
      )}

      <FormLayout>
        <FormLayout.Group>
          <TextField
            label="Average Profit Margin (%)"
            type="number"
            value={formValues.averageProfitMargin}
            onChange={handleChange('averageProfitMargin')}
            helpText="e.g., 45 for 45% profit margin"
            autoComplete="off"
            min="0"
            max="100"
            step="0.01"
          />
          <TextField
            label="Average COGS Percent (%)"
            type="number"
            value={formValues.averageCogsPercent}
            onChange={handleChange('averageCogsPercent')}
            helpText="e.g., 55 for 55% of revenue"
            autoComplete="off"
            min="0"
            max="100"
            step="0.01"
          />
        </FormLayout.Group>

        <FormLayout.Group>
          <TextField
            label="Average Shipping Cost"
            type="number"
            value={formValues.averageShippingCost}
            onChange={handleChange('averageShippingCost')}
            helpText="Average cost per order in your currency"
            autoComplete="off"
            min="0"
            step="0.01"
          />
          <TextField
            label="Average Order Value"
            type="number"
            value={formValues.averageOrderValue}
            onChange={handleChange('averageOrderValue')}
            helpText="Historical average order value"
            autoComplete="off"
            min="0"
            step="0.01"
          />
        </FormLayout.Group>

        <TextField
          label="Target ROI Percent (%)"
          type="number"
          value={formValues.targetRoiPercent}
          onChange={handleChange('targetRoiPercent')}
          helpText="e.g., 300 for 3x return on investment"
          autoComplete="off"
          min="0"
          step="0.01"
        />
      </FormLayout>

      <InlineStack align="end">
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={isSaving}
        >
          Save Business Metrics
        </Button>
      </InlineStack>
    </BlockStack>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedDateRange, setSelectedDateRange] = useState(
    searchParams.get('range') || '30days'
  );
  
  const isLoading = navigation.state === "loading";
  
  // Format currency helper
  const formatAmount = useCallback((amount: number) => {
    return formatCurrency(amount, data.shopSettings as any);
  }, [data.shopSettings]);
  
  // Handle date range selection
  const handleDateRangeSelect = useCallback((range: string) => {
    setSelectedDateRange(range);

    // Navigate with the new date range parameter
    navigate(`?range=${range}`);
  }, [navigate]);
  
  // Get date range display text
  const getDateRangeText = useCallback(() => {
    const now = new Date();
    switch (selectedDateRange) {
      case 'today':
        return `Today (${now.toLocaleDateString()})`;
      case '7days':
        const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return `Last 7 Days (${week.toLocaleDateString()} - ${now.toLocaleDateString()})`;
      case '30days':
        const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return `Last 30 Days (${month.toLocaleDateString()} - ${now.toLocaleDateString()})`;
      case 'quarter':
        const quarter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return `Last Quarter (${quarter.toLocaleDateString()} - ${now.toLocaleDateString()})`;
      case 'year':
        const year = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return `Last Year (${year.toLocaleDateString()} - ${now.toLocaleDateString()})`;
      case 'all':
        return 'All Time';
      default:
        return 'Last 30 Days';
    }
  }, [selectedDateRange]);

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'charts', content: 'Charts' },
    { id: 'financial', content: 'Financial' },
  ];

  return (
    <Page
      title="Analytics"
      subtitle="Track your loyalty program performance"
    >
      <Layout>
        {/* Tabbed Content */}
        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              {/* Overview Tab */}
              {selectedTab === 0 && (
                <Box padding="400">
                  <BlockStack gap="500">
                    {/* Store Performance */}
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h2">
                        Store Performance
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Overall financial metrics for your store this month
                      </Text>

                      {/* Financial Metrics Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '16px'
                      }}>
                        {/* Monthly Revenue */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="200">
                              <Text variant="bodySm" tone="subdued" as="p">
                                Monthly Revenue
                              </Text>
                              <Text variant="headingLg" as="h3">
                                {formatAmount(48750.00)}
                              </Text>
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone="success">+12.5%</Badge>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  vs last month
                                </Text>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </Card>

                        {/* Total Orders */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="200">
                              <Text variant="bodySm" tone="subdued" as="p">
                                Total Orders
                              </Text>
                              <Text variant="headingLg" as="h3">
                                342
                              </Text>
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone="success">+8.3%</Badge>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  vs last month
                                </Text>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </Card>

                        {/* Average Order Value */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="200">
                              <Text variant="bodySm" tone="subdued" as="p">
                                Average Order Value
                              </Text>
                              <Text variant="headingLg" as="h3">
                                {formatAmount(142.54)}
                              </Text>
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone="success">+3.8%</Badge>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  vs last month
                                </Text>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </Card>

                        {/* Gross Profit */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="200">
                              <Text variant="bodySm" tone="subdued" as="p">
                                Gross Profit
                              </Text>
                              <Text variant="headingLg" as="h3">
                                {formatAmount(21937.50)}
                              </Text>
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone="info">45.0%</Badge>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  margin
                                </Text>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </Card>

                        {/* Active Customers */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="200">
                              <Text variant="bodySm" tone="subdued" as="p">
                                Active Customers
                              </Text>
                              <Text variant="headingLg" as="h3">
                                856
                              </Text>
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone="success">+15.2%</Badge>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  vs last month
                                </Text>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </Card>

                        {/* Conversion Rate */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="200">
                              <Text variant="bodySm" tone="subdued" as="p">
                                Conversion Rate
                              </Text>
                              <Text variant="headingLg" as="h3">
                                3.24%
                              </Text>
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone="warning">-0.3%</Badge>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  vs last month
                                </Text>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </Card>
                      </div>
                    </BlockStack>

                    <Divider />

                    {/* Tier Performance */}
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h2">
                        Tier Performance
                      </Text>
                      {data.tierPerformance.length > 0 ? (
                        <DataTable
                          columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric']}
                          headings={[
                            'Tier',
                            'Members',
                            'Monthly Order Frequency',
                            'Revenue/Order',
                            'Monthly Gross Profit/Customer',
                          ]}
                          rows={sortTiersByPriority(data.tierPerformance).map(tier => [
                            <TierBadge
                              tierName={tier.name}
                              size="small"
                              showIcon={true}
                              cashbackPercent={tier.cashbackPercent}
                            />,
                            tier.members,
                            tier.monthlyOrderFrequency.toFixed(2),
                            formatAmount(tier.revenuePerOrder),
                            formatAmount(tier.grossProfitPerCustomerPerMonth),
                          ])}
                        />
                      ) : (
                        <EmptyState
                          heading="No tier data yet"
                          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                        >
                          <p>Tier performance will appear here once you have data.</p>
                        </EmptyState>
                      )}
                    </BlockStack>

                    <Divider />

                    {/* Program Impact */}
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h2">
                        Program Impact
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Track reward redemption and sales influenced by your loyalty program
                      </Text>

                      {/* Metrics Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '16px',
                        marginBottom: '20px'
                      }}>
                        {/* Reward Usage Rate */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="200">
                              <Text variant="bodySm" tone="subdued" as="p">
                                Current Reward Usage Rate
                              </Text>
                              <Text variant="headingLg" as="h3">
                                77.3%
                              </Text>
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone="success">+6.8%</Badge>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  vs last month
                                </Text>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </Card>

                        {/* Total Influenced Sales */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="200">
                              <Text variant="bodySm" tone="subdued" as="p">
                                Total Influenced Sales
                              </Text>
                              <Text variant="headingLg" as="h3">
                                {formatAmount(585420)}
                              </Text>
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone="info">Cumulative</Badge>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  since launch
                                </Text>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </Card>
                      </div>

                      {/* Historical Data Charts */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
                        gap: '24px',
                        marginTop: '16px'
                      }}>
                        {/* Reward Usage Rate Chart */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="300">
                              <BlockStack gap="100">
                                <Text variant="headingSm" as="h3">
                                  Reward Usage Rate Over Time
                                </Text>
                                <Text variant="bodySm" tone="subdued" as="p">
                                  Monthly redemption rate
                                </Text>
                              </BlockStack>
                              <div style={{ height: '250px' }}>
                                <Line
                                  data={{
                                    labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
                                    datasets: [{
                                      label: 'Usage Rate',
                                      data: [65.2, 72.4, 68.1, 75.3, 71.7, 78.5, 74.2, 69.8, 73.1, 76.4, 70.5, 77.3],
                                      borderColor: '#8B5CF6',
                                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                      fill: true,
                                      tension: 0.4,
                                    }],
                                  }}
                                  options={getShopifyChartOptions({
                                    max: 100,
                                    callback: (value) => `${value}%`,
                                  })}
                                />
                              </div>
                            </BlockStack>
                          </Box>
                        </Card>

                        {/* Influenced Sales Chart */}
                        <Card>
                          <Box padding="400">
                            <BlockStack gap="300">
                              <BlockStack gap="100">
                                <Text variant="headingSm" as="h3">
                                  Influenced Sales Over Time
                                </Text>
                                <Text variant="bodySm" tone="subdued" as="p">
                                  Cumulative revenue from program
                                </Text>
                              </BlockStack>
                              <div style={{ height: '250px' }}>
                                <Line
                                  data={{
                                    labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
                                    datasets: [{
                                      label: 'Cumulative Sales',
                                      data: [25340, 68020, 124920, 194770, 272000, 354560, 421900, 474790, 511910, 538250, 558100, 585420],
                                      borderColor: '#22c55e',
                                      backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                      fill: true,
                                      tension: 0.1,
                                    }],
                                  }}
                                  options={getShopifyChartOptions({
                                    callback: (value) => formatAmount(Number(value)),
                                  })}
                                />
                              </div>
                            </BlockStack>
                          </Box>
                        </Card>
                      </div>

                      <Text variant="bodySm" tone="subdued" as="p">
                        Reward usage rate shows the percentage of earned rewards that customers have redeemed.
                        Influenced sales include all orders from customers who are active loyalty program participants.
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Box>
              )}

              {/* Charts Tab */}
              {selectedTab === 1 && (
                <Box padding="400">
                  <BlockStack gap="600">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h2">
                        Tier Performance Over Time
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Track how each tier's metrics evolve month-over-month (last 6 months)
                      </Text>
                    </BlockStack>

                    {/* Style A: Line Chart - Order Frequency Over Time */}
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="400">
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="headingSm" as="h3">Style A: Monthly Order Frequency Trend</Text>
                              <Badge tone="info">Line Chart</Badge>
                            </InlineStack>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Track order frequency changes per tier over the last 12 months
                            </Text>
                          </BlockStack>

                          {/* Chart.js Line Chart */}
                          <div style={{ height: '300px', padding: '20px 0' }}>
                            <Line
                              data={{
                                labels: data.monthlyTierTrends.map(m => m.month),
                                datasets: data.tierPerformance.map((tier, tierIndex) => {
                                  const colors = ['#5C6AC4', '#006FBB', '#00848E', '#47C1BF'];
                                  const color = colors[tierIndex] || '#5C6AC4';

                                  return {
                                    label: tier.name,
                                    data: data.monthlyTierTrends.map(month => {
                                      const tierData = month.tiers.find(t => t.tierName === tier.name);
                                      return tierData?.orderFrequency || 0;
                                    }),
                                    borderColor: color,
                                    backgroundColor: color,
                                    tension: 0.1,
                                  };
                                }),
                              }}
                              options={getShopifyChartOptions({ max: 6 })}
                            />
                          </div>

                          {/* Legend */}
                          <InlineStack gap="400" blockAlign="center" wrap={true}>
                            {data.tierPerformance.map((tier, index) => {
                              // Shopify Polaris color palette (matches chart lines)
                              const colors = ['#5C6AC4', '#006FBB', '#00848E', '#47C1BF'];
                              return (
                                <InlineStack key={tier.id} gap="200" blockAlign="center">
                                  <div style={{
                                    width: '20px',
                                    height: '3px',
                                    backgroundColor: colors[index] || '#5C6AC4',
                                    borderRadius: '2px'
                                  }} />
                                  <TierBadge
                                    tierName={tier.name}
                                    size="small"
                                    showIcon={false}
                                    cashbackPercent={tier.cashbackPercent}
                                  />
                                </InlineStack>
                              );
                            })}
                          </InlineStack>
                        </BlockStack>
                      </Box>
                    </Card>

                    {/* Style B: Vertical Bar Chart - Current Month Tier Comparison */}
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="400">
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="headingSm" as="h3">Style B: Current Month Tier Comparison</Text>
                              <Badge tone="success">Vertical Bars</Badge>
                            </InlineStack>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Compare order frequency across tiers for the current month
                            </Text>
                          </BlockStack>

                          {/* Chart.js Bar Chart */}
                          <div style={{ height: '300px', padding: '20px 0' }}>
                            <Bar
                              data={{
                                labels: sortTiersByPriority(data.tierPerformance).map(tier => tier.name),
                                datasets: [{
                                  label: 'Order Frequency',
                                  data: sortTiersByPriority(data.tierPerformance).map(tier => tier.monthlyOrderFrequency),
                                  backgroundColor: '#5C6AC4',
                                  borderRadius: 4,
                                  barPercentage: 0.6,
                                }],
                              }}
                              options={getShopifyBarChartOptions(false)}
                            />
                          </div>

                          {/* Chart footer */}
                          <InlineStack align="space-between">
                            <Text variant="bodySm" tone="subdued" as="span">
                              Monthly Order Frequency (orders/customer/month)
                            </Text>
                            <Text variant="bodySm" tone="subdued" as="span">
                              Current month
                            </Text>
                          </InlineStack>
                        </BlockStack>
                      </Box>
                    </Card>

                    {/* Style C: Horizontal Bar Chart - Monthly Growth */}
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="400">
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="headingSm" as="h3">Style C: Revenue Per Order by Tier</Text>
                              <Badge tone="info">Horizontal Bars</Badge>
                            </InlineStack>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Current month revenue per order across all tiers
                            </Text>
                          </BlockStack>

                          {/* Chart.js Horizontal Bar Chart */}
                          <div style={{ height: '300px', padding: '20px 0' }}>
                            <Bar
                              data={{
                                labels: sortTiersByPriority(data.tierPerformance).map(tier => tier.name),
                                datasets: [{
                                  label: 'Revenue Per Order',
                                  data: sortTiersByPriority(data.tierPerformance).map(tier => tier.revenuePerOrder),
                                  backgroundColor: '#5C6AC4',
                                  borderRadius: 4,
                                  barPercentage: 0.6,
                                }],
                              }}
                              options={getShopifyBarChartOptions(true)}
                            />
                          </div>

                          <Text variant="bodySm" tone="subdued" as="p">
                            Revenue per order (current month average)
                          </Text>
                        </BlockStack>
                      </Box>
                    </Card>

                    {/* Reward Usage Rate Over Time */}
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="400">
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="headingSm" as="h3">Reward Usage Rate Over Time</Text>
                              <Badge tone="info">Monthly Trends</Badge>
                            </InlineStack>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Track monthly reward redemption rate over the last 12 months
                            </Text>
                          </BlockStack>

                          {/* Chart.js Area Chart */}
                          <div style={{ height: '300px', padding: '20px 0' }}>
                            <Line
                              data={{
                                labels: data.monthlyTierTrends.map(m => m.month),
                                datasets: [{
                                  label: 'Reward Usage Rate',
                                  data: [65.2, 72.4, 68.1, 75.3, 71.7, 78.5, 74.2, 69.8, 73.1, 76.4, 70.5, 77.3],
                                  borderColor: '#8B5CF6',
                                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                  fill: true,
                                  tension: 0.4,
                                }],
                              }}
                              options={getShopifyChartOptions({
                                max: 100,
                                callback: (value) => `${value}%`,
                              })}
                            />
                          </div>

                          <Text variant="bodySm" tone="subdued" as="p">
                            Cumulative percentage of rewards redeemed by customers since program launch
                          </Text>
                        </BlockStack>
                      </Box>
                    </Card>

                    {/* Sales Influenced by Rewards Pro Over Time */}
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="400">
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="headingSm" as="h3">Sales Influenced by Rewards Pro Over Time</Text>
                              <Badge tone="success">Cumulative Chart</Badge>
                            </InlineStack>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Track cumulative revenue influenced by your loyalty program over the last 12 months
                            </Text>
                          </BlockStack>

                          {/* Chart.js Area Chart */}
                          <div style={{ height: '300px', padding: '20px 0' }}>
                            <Line
                              data={{
                                labels: data.monthlyTierTrends.map(m => m.month),
                                datasets: [{
                                  label: 'Sales Influenced',
                                  data: [25000, 68000, 125000, 195000, 272000, 355000, 422000, 475000, 512000, 538000, 558000, 585000],
                                  borderColor: '#22c55e',
                                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                  fill: true,
                                  tension: 0.1,
                                }],
                              }}
                              options={getShopifyChartOptions({
                                max: 600000,
                                callback: (value) => `$${(Number(value) / 1000).toFixed(0)}k`,
                              })}
                            />
                          </div>

                          <Text variant="bodySm" tone="subdued" as="p">
                            Cumulative revenue from orders influenced by loyalty program participation
                          </Text>
                        </BlockStack>
                      </Box>
                    </Card>

                  </BlockStack>
                </Box>
              )}

              {/* Financial Tab */}
              {selectedTab === 2 && (
                <Box padding="400">
                  <BlockStack gap="500">
                    {/* Margin Recalibration Module */}
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="400">
                          <BlockStack gap="200">
                            <Text variant="headingMd" as="h2">
                              Business Metrics Configuration
                            </Text>
                            <Text variant="bodyMd" tone="subdued" as="p">
                              Configure your store's financial metrics to enable accurate ROI calculations and profit analysis
                            </Text>
                            {data.shopSettings?.metricsLastUpdated && (
                              <Text variant="bodySm" tone="subdued" as="p">
                                Last updated: {new Date(data.shopSettings.metricsLastUpdated).toLocaleDateString()}
                              </Text>
                            )}
                          </BlockStack>

                          <Divider />

                          <MarginRecalibrationForm
                            initialValues={{
                              averageProfitMargin: data.shopSettings?.averageProfitMargin || '',
                              averageCogsPercent: data.shopSettings?.averageCogsPercent || '',
                              averageShippingCost: data.shopSettings?.averageShippingCost || '',
                              averageOrderValue: data.shopSettings?.averageOrderValue || '',
                              targetRoiPercent: data.shopSettings?.targetRoiPercent || '',
                            }}
                          />
                        </BlockStack>
                      </Box>
                    </Card>

                    {/* Help Card */}
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="300">
                          <Text variant="headingSm" as="h3">
                            How to Use These Metrics
                          </Text>
                          <BlockStack gap="200">
                            <Text variant="bodySm" as="p" tone="subdued">
                              <strong>Average Profit Margin:</strong> Your typical profit margin as a percentage (e.g., 45 for 45%)
                            </Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              <strong>Average COGS Percent:</strong> Cost of goods sold as a percentage of revenue (e.g., 55 for 55%)
                            </Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              <strong>Average Shipping Cost:</strong> Typical shipping cost per order in your store currency
                            </Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              <strong>Average Order Value:</strong> Historical average order value for baseline calculations
                            </Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              <strong>Target ROI Percent:</strong> Your target return on investment for the loyalty program (e.g., 300 for 3x)
                            </Text>
                          </BlockStack>
                        </BlockStack>
                      </Box>
                    </Card>
                  </BlockStack>
                </Box>
              )}
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </Page>
  );
}
