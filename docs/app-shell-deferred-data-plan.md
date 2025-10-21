# App Shell + Deferred Data Implementation Plan

## Executive Summary

**Goal**: Dramatically improve Time-to-First-Byte (TTFB) by shipping a cacheable app shell immediately while deferring heavy Prisma/Admin API queries to stream after initial paint.

**Current State**:
- ✅ `app/routes/app.customers.tsx` - Already implements deferred loading pattern
- ❌ `app/routes/app._index.tsx` - Blocks on 10+ heavy queries before HTML
- ❌ `app/routes/app.settings.tsx` - Blocks on order counting and multiple DB queries
- ❌ `app/routes/app.orders.tsx` - Blocks on order fetching and processing
- ❌ `app/routes/app.analytics.tsx` - Blocks on analytics aggregations

**Success Metrics**:
- TTFB < 300ms (currently 1-3s on dashboard)
- First Contentful Paint < 1s
- Skeleton visible within 500ms

---

## Phase 1: Create Reusable App Shell Component

### 1.1 Create Base Shell Component

**File**: `app/components/AppShell.tsx`

```typescript
import {
  Page,
  Layout,
  Card,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  BlockStack,
} from "@shopify/polaris";

interface AppShellProps {
  title: string;
  subtitle?: string;
  primaryAction?: {
    content: string;
    loading?: boolean;
  };
  secondaryActions?: Array<{ content: string }>;
  children: React.ReactNode;
  showSkeleton?: boolean;
}

export function AppShell({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  children,
  showSkeleton = false,
}: AppShellProps) {
  if (showSkeleton) {
    return (
      <SkeletonPage
        title={title}
        subtitle={subtitle}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonBodyText lines={3} />
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={5} />
            </Card>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page
      title={title}
      subtitle={subtitle}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      {children}
    </Page>
  );
}
```

**Benefits**:
- Instant cacheable HTML response
- Consistent skeleton patterns
- Easy to extend per-route

### 1.2 Create Specialized Skeleton Components

**File**: `app/components/Skeletons/DashboardSkeleton.tsx`

```typescript
import { Layout, Card, BlockStack, SkeletonBodyText, SkeletonDisplayText } from "@shopify/polaris";

export function DashboardSkeleton() {
  return (
    <Layout>
      {/* Current Plan Card Skeleton */}
      <Layout.Section>
        <Card>
          <BlockStack gap="400">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={3} />
          </BlockStack>
        </Card>
      </Layout.Section>

      {/* Main Content Skeleton */}
      <Layout.Section>
        <BlockStack gap="500">
          {/* Stats Cards Skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <BlockStack gap="200">
                  <SkeletonBodyText lines={1} />
                  <SkeletonDisplayText size="small" />
                </BlockStack>
              </Card>
            ))}
          </div>

          {/* Tabs Skeleton */}
          <Card>
            <BlockStack gap="400">
              <SkeletonBodyText lines={1} />
              <SkeletonBodyText lines={10} />
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );
}
```

**Additional Skeletons**:
- `SettingsSkeleton.tsx` - Tabs + form fields
- `OrdersSkeleton.tsx` - Table skeleton
- `AnalyticsSkeleton.tsx` - Charts + metrics

---

## Phase 2: Refactor Dashboard (app._index.tsx)

### 2.1 Identify Heavy vs Light Queries

**Light (Sync - Return Immediately)**:
```typescript
// Shell data - under 50ms
const shellData = {
  shop: session.shop,
  shopSettings: {
    storeCurrency: settings.storeCurrency,
    currencyDisplayType: settings.currencyDisplayType,
  },
  // Widget dismissal flags (from settings query)
  widgetDismissed: settings.widgetSetupDismissed || false,
  customerAccountBlockDismissed: settings.customerAccountBlockDismissed || false,
};
```

**Heavy (Deferred - Stream After Paint)**:
```typescript
// Dashboard data - 500-2000ms
const dashboardDataPromise = fetchDashboardData(shop, admin, billing);

async function fetchDashboardData(shop, admin, billing) {
  return {
    metrics: await calculateMetrics(shop),
    tierDistribution: await calculateTierDistribution(shop),
    recentTransactions: await fetchRecentTransactions(shop),
    topCustomers: await fetchTopCustomers(shop),
    currentPlan: await getCurrentPlan(shop),
    monthlyOrderUsage: await getMonthlyOrderUsage(shop),
    activeSubscription: await checkSubscription(billing),
    // Widget detection (GraphQL theme query - slow)
    hasWidget: await detectWidget(admin, shop),
    hasCustomerAccountBlock: await detectCustomerAccountBlock(shop),
  };
}
```

### 2.2 Update Loader to Use defer()

**Before**:
```typescript
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  // ... 500-2000ms of queries ...
  return json({ ...allData }); // Blocks until everything loads
};
```

**After**:
```typescript
import { defer } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);

  // Fast shell data (sync)
  const shellData = await getShellData(session.shop);

  // Slow dashboard data (deferred)
  const dashboardDataPromise = fetchDashboardData(session.shop, admin, billing);

  // Return immediately with shell + promise
  return defer({
    ...shellData,
    dashboardData: dashboardDataPromise, // Streams in
  });
};
```

### 2.3 Update Component to Use Suspense

**Before**:
```typescript
export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  return (
    <Page title="Dashboard">
      <CurrentPlanCard currentPlan={data.currentPlan} />
      {/* ... all content renders after data loads ... */}
    </Page>
  );
}
```

**After**:
```typescript
import { Suspense } from "react";
import { Await } from "@remix-run/react";
import { DashboardSkeleton } from "~/components/Skeletons/DashboardSkeleton";

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page title="Dashboard">
      {/* Shell renders immediately */}
      <Suspense fallback={<DashboardSkeleton />}>
        <Await resolve={data.dashboardData}>
          {(dashboardData) => (
            <>
              <CurrentPlanCard currentPlan={dashboardData.currentPlan} />
              <StatsOverview metrics={dashboardData.metrics} />
              {/* ... rest of content ... */}
            </>
          )}
        </Await>
      </Suspense>
    </Page>
  );
}
```

### 2.4 Break Into Granular Suspense Boundaries (Optional Optimization)

For even faster perceived performance:

```typescript
return defer({
  shellData,
  // Separate promises for different sections
  planData: fetchPlanData(shop, billing), // 200ms
  metricsData: fetchMetrics(shop),        // 500ms
  transactionsData: fetchTransactions(shop), // 300ms
});

// Component
<Layout>
  {/* Fastest data shows first */}
  <Suspense fallback={<PlanSkeleton />}>
    <Await resolve={data.planData}>
      {(planData) => <CurrentPlanCard {...planData} />}
    </Await>
  </Suspense>

  {/* Metrics appear next */}
  <Suspense fallback={<MetricsSkeleton />}>
    <Await resolve={data.metricsData}>
      {(metrics) => <StatsOverview {...metrics} />}
    </Await>
  </Suspense>

  {/* Transactions last */}
  <Suspense fallback={<TransactionsSkeleton />}>
    <Await resolve={data.transactionsData}>
      {(txs) => <TransactionTable {...txs} />}
    </Await>
  </Suspense>
</Layout>
```

**Benefits**:
- Progressive enhancement (fast sections show first)
- Perceived performance improvement
- Better UX than all-or-nothing

---

## Phase 3: Refactor Settings Page (app.settings.tsx)

### 3.1 Heavy Queries Analysis

**Current Blocking Queries**:
```typescript
// app.settings.tsx loader - lines 500-700
const [
  settings,
  activeSubscription,
  monthlyOrderUsage,
  orderStats,         // ← HEAVY: countOrdersWithFallback() can take 1-2s
] = await Promise.all([...]);
```

### 3.2 Defer Strategy

**Light (Sync)**:
- shopSettings (needed for form defaults)
- shopifyTimezone (readonly display)
- Basic subscription status

**Heavy (Deferred)**:
- `orderStats` via `countOrdersWithFallback()`
- `monthlyOrderUsage` calculations
- Tier recalculation status

**Implementation**:
```typescript
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await db.shopSettings.findUnique({ where: { shop: session.shop } });

  const statsPromise = async () => {
    const [orderStats, monthlyOrderUsage] = await Promise.all([
      countOrdersWithFallback(session.shop, year, month),
      getOrCreateMonthlyCount(session.shop, year, month),
    ]);
    return { orderStats, monthlyOrderUsage };
  };

  return defer({
    settings,
    shopifyTimezone: session.timezone,
    stats: statsPromise(), // Deferred
  });
};
```

---

## Phase 4: Refactor Orders Page (app.orders.tsx)

### 4.1 Current Heavy Queries

```typescript
// Fetches ALL orders with includes
const orders = await db.orderLog.findMany({
  where: { shop },
  include: {
    customer: true,
    tier: true,
  },
  orderBy: { createdAt: 'desc' },
  take: 100,
});
```

### 4.2 Defer Strategy

**Light (Sync)**:
- Shop settings (currency)
- Tier list (for filters)

**Heavy (Deferred)**:
- Orders query with N+1 customer/tier lookups
- Stats calculations

---

## Phase 5: Implementation Checklist

### Routes Priority Order

1. ✅ **app.customers.tsx** - Already done (reference implementation)
2. 🔴 **app._index.tsx** - Highest impact (dashboard = most visited)
3. 🟡 **app.settings.tsx** - Medium impact (order counting is slow)
4. 🟡 **app.orders.tsx** - Medium impact (large datasets)
5. 🟢 **app.analytics.tsx** - Lower priority (already slow queries)

### Step-by-Step Implementation

#### For Each Route:

**Step 1: Create Skeleton Component**
- [ ] Create `app/components/Skeletons/[Route]Skeleton.tsx`
- [ ] Match layout structure of actual page
- [ ] Test visual appearance

**Step 2: Refactor Loader**
- [ ] Import `defer` from `@remix-run/node`
- [ ] Identify light vs heavy queries
- [ ] Extract heavy queries into separate async function
- [ ] Return `defer({ shellData, heavyData: promise })`
- [ ] Test loader doesn't throw errors

**Step 3: Update Component**
- [ ] Import `Suspense`, `Await` from react/remix
- [ ] Wrap deferred content in `<Suspense fallback={<Skeleton />}>`
- [ ] Use `<Await resolve={data.heavyData}>` pattern
- [ ] Test loading states work correctly

**Step 4: Verify & Optimize**
- [ ] Check Network tab: HTML arrives in <300ms
- [ ] Check skeleton appears immediately
- [ ] Check content streams in after
- [ ] Check no JavaScript errors
- [ ] Check error boundaries handle failures

---

## Phase 6: Testing Strategy

### Manual Testing

1. **Throttle Network** (Chrome DevTools → Network → Slow 3G)
   - Verify skeleton shows immediately
   - Verify content streams in progressively
   - Verify no layout shift

2. **Disable JavaScript**
   - Verify skeleton still renders
   - Verify error message shows for deferred content

3. **Simulate Errors**
   - Add `throw new Error("test")` in deferred function
   - Verify error boundary catches it
   - Verify page doesn't crash

### Automated Testing

```typescript
// tests/app-shell.test.ts
import { createRemixStub } from "@remix-run/testing";
import { render, screen, waitFor } from "@testing-library/react";

describe("Dashboard App Shell", () => {
  it("shows skeleton immediately", async () => {
    const RemixStub = createRemixStub([
      {
        path: "/app",
        Component: Dashboard,
        loader: () => defer({
          shellData: { shop: "test" },
          dashboardData: new Promise(() => {}), // Never resolves
        }),
      },
    ]);

    render(<RemixStub />);

    // Skeleton should be visible immediately
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("streams content when data resolves", async () => {
    const RemixStub = createRemixStub([
      {
        path: "/app",
        Component: Dashboard,
        loader: () => defer({
          shellData: { shop: "test" },
          dashboardData: Promise.resolve({ metrics: { totalCustomers: 100 } }),
        }),
      },
    ]);

    render(<RemixStub />);

    // Wait for content to stream in
    await waitFor(() => {
      expect(screen.getByText("100")).toBeInTheDocument();
    });
  });
});
```

---

## Phase 7: Performance Benchmarks

### Before (Current State)

| Route | TTFB | FCP | Queries | Blocking Time |
|-------|------|-----|---------|---------------|
| `/app` (Dashboard) | 1,800ms | 2,100ms | 15+ | All queries |
| `/app/settings` | 1,200ms | 1,500ms | 8+ | Order counting |
| `/app/orders` | 900ms | 1,200ms | 5+ | Order fetch |

### After (Target State)

| Route | TTFB | FCP | Queries | Blocking Time |
|-------|------|-----|---------|---------------|
| `/app` (Dashboard) | 250ms | 600ms | 15+ | Shell only |
| `/app/settings` | 200ms | 500ms | 8+ | Settings only |
| `/app/orders` | 180ms | 450ms | 5+ | Tier list only |

**Expected Improvements**:
- 85% reduction in TTFB
- 70% reduction in FCP
- Instant skeleton visibility
- Progressive content loading

---

## Phase 8: Potential Pitfalls & Solutions

### Pitfall 1: Deferred Data Errors Break Page

**Problem**: If deferred promise rejects, entire page crashes

**Solution**: Wrap in error boundary
```typescript
<Suspense fallback={<Skeleton />}>
  <Await resolve={data.heavy} errorElement={<ErrorState />}>
    {(data) => <Content {...data} />}
  </Await>
</Suspense>
```

### Pitfall 2: SEO/Crawlers Don't Wait for Deferred Content

**Problem**: Search engines may not see content

**Solution**:
- Ensure critical content (shop name, nav) is in shell
- Use `<meta>` tags in shell
- Analytics data doesn't need to be crawled

### Pitfall 3: Layout Shift When Content Loads

**Problem**: Skeleton → content causes jarring jumps

**Solution**:
- Match skeleton dimensions to real content
- Use CSS `min-height` reservations
- Test on real data

### Pitfall 4: Double Data Fetching

**Problem**: Shell + deferred both query same data

**Solution**:
- Carefully separate light vs heavy
- Share common queries (e.g., shopSettings)
- Cache in memory if needed

---

## Phase 9: Rollout Plan

### Week 1: Foundation
- [ ] Create `AppShell` component
- [ ] Create skeleton library
- [ ] Document patterns

### Week 2: Dashboard (Highest Impact)
- [ ] Refactor `app._index.tsx`
- [ ] Create `DashboardSkeleton`
- [ ] Test & deploy
- [ ] Monitor metrics

### Week 3: Settings & Orders
- [ ] Refactor `app.settings.tsx`
- [ ] Refactor `app.orders.tsx`
- [ ] Create respective skeletons
- [ ] Deploy

### Week 4: Polish & Optimize
- [ ] Add granular suspense boundaries
- [ ] Optimize query performance
- [ ] Document learnings
- [ ] Share with team

---

## References

- ✅ **Working Example**: `app/routes/app.customers.tsx` (lines 351, 2043-2059)
  - Already uses `defer()`, `Suspense`, `Await`
  - Has `CustomersTableSkeleton` component
  - Separates shell (tiers, settings) from heavy (customers, stats)

- 📖 **Remix Docs**: https://remix.run/docs/en/main/guides/streaming
- 📖 **Polaris Skeletons**: https://polaris.shopify.com/components/feedback-indicators/skeleton-page

---

## Success Criteria

✅ **Technical**:
- TTFB < 300ms on all routes
- Skeleton visible < 500ms
- Zero blocking queries in initial response
- Error boundaries handle failures gracefully

✅ **UX**:
- No blank white screen
- Smooth progressive loading
- No jarring layout shifts
- Fast perceived performance

✅ **Business**:
- Reduced bounce rate from slow loads
- Better merchant satisfaction scores
- Improved app performance rankings

---

## Next Steps

1. Review this plan with team
2. Get approval for phased rollout
3. Start with Phase 1 (AppShell component)
4. Use `app.customers.tsx` as reference
5. Deploy dashboard first (highest impact)

---

**Created**: 2025-10-21
**Status**: 📋 Planning
**Estimated Effort**: 2-3 weeks
**Expected Impact**: 70-85% TTFB reduction
