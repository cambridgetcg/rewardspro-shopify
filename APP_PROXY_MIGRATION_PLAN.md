# App Proxy Migration Plan

**Date:** 2025-10-14
**Purpose:** Migrate from direct API calls to Shopify App Proxy for storefront widget communication
**Priority:** CRITICAL (Required for App Store compliance)

---

## Executive Summary

**Current Architecture:**
```
Storefront Widget → Direct HTTPS → https://rewardspro-production.vercel.app/api/storefront/loyalty
                      (CORS required)
```

**Target Architecture:**
```
Storefront Widget → App Proxy → Shopify → Backend Handler → Database
                    /apps/rewardspro/loyalty  (No CORS needed)
```

**Benefits:**
- ✅ Shopify App Store compliance
- ✅ Built-in HMAC signature verification
- ✅ No CORS complexity
- ✅ Shop context automatically provided
- ✅ Better security posture

**Estimated Effort:** 2-4 hours
**Risk Level:** Low (backward compatible during transition)

---

## Phase 1: Backend Route Setup

### Step 1.1: Create App Proxy Route Handler

**File:** `app/routes/apps.proxy.loyalty.tsx` (NEW)

```typescript
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * App Proxy Handler for Storefront Loyalty Widget
 *
 * Path: /apps/proxy/loyalty (maps to /apps/rewardspro/loyalty on storefront)
 *
 * This replaces the direct API endpoint /api/storefront/loyalty
 * Benefits:
 * - Built-in Shopify authentication via app proxy
 * - HMAC signature verification automatic
 * - Shop context provided by Shopify
 * - No CORS needed (same-origin request)
 */

interface LoyaltyData {
  balance: number;
  tier: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  progress: {
    current: number;
    next: number;
    percentage: number;
  } | null;
  expiringPoints: {
    amount: number;
    date: string;
  } | null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Authenticate via app proxy
  // Returns session if shop has app installed, undefined otherwise
  const { session, liquid } = await authenticate.public.appProxy(request);

  // If no session, shop hasn't installed the app
  if (!session) {
    return json(
      {
        error: "App not installed",
        message: "Please install RewardsPro from the Shopify App Store"
      },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const customerIdFromMetafield = url.searchParams.get("customerId");

  // Validate required parameters
  if (!customerIdFromMetafield) {
    return json(
      { error: "Missing required parameter: customerId" },
      { status: 400 }
    );
  }

  // Shop domain is automatically available from session
  const shop = session.shop;

  try {
    // Find customer by internal ID (from metafield value) and shop
    const customer = await db.customer.findFirst({
      where: {
        id: customerIdFromMetafield,
        shop: shop // Shop-scoped for security
      },
      select: {
        id: true,
        email: true,
        pointsBalance: true,
        lifetimePoints: true,
        currentTierId: true,
        currentTier: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
            minSpend: true,
            threshold: true
          }
        }
      }
    });

    if (!customer) {
      return json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Convert Decimal to number
    const pointsBalance = typeof customer.pointsBalance === 'object' && 'toNumber' in customer.pointsBalance
      ? (customer.pointsBalance as any).toNumber()
      : Number(customer.pointsBalance);

    const lifetimePoints = typeof customer.lifetimePoints === 'object' && 'toNumber' in customer.lifetimePoints
      ? (customer.lifetimePoints as any).toNumber()
      : Number(customer.lifetimePoints);

    // Get next tier for progress calculation
    const currentTierThreshold = customer.currentTier
      ? (customer.currentTier.threshold || customer.currentTier.minSpend)
      : 0;

    const nextTier = await db.tier.findFirst({
      where: {
        shop: shop,
        minSpend: {
          gt: currentTierThreshold
        }
      },
      orderBy: {
        minSpend: "asc"
      },
      select: {
        id: true,
        name: true,
        minSpend: true,
        threshold: true
      }
    });

    // Calculate expiring points (points expiring in next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringPointsData = await db.storeCreditLedger.aggregate({
      where: {
        customerId: customer.id,
        shop: shop,
        amount: {
          gt: 0
        },
        expiresAt: {
          lte: thirtyDaysFromNow,
          gt: new Date()
        }
      },
      _sum: {
        amount: true
      }
    });

    // Get earliest expiration date
    const earliestExpiration = await db.storeCreditLedger.findFirst({
      where: {
        customerId: customer.id,
        shop: shop,
        amount: {
          gt: 0
        },
        expiresAt: {
          lte: thirtyDaysFromNow,
          gt: new Date()
        }
      },
      orderBy: {
        expiresAt: "asc"
      },
      select: {
        expiresAt: true
      }
    });

    // Convert expiring points sum
    const expiringSum = expiringPointsData._sum.amount
      ? (typeof expiringPointsData._sum.amount === 'object' && 'toNumber' in expiringPointsData._sum.amount
          ? (expiringPointsData._sum.amount as any).toNumber()
          : Number(expiringPointsData._sum.amount))
      : 0;

    // Build response
    const loyaltyData: LoyaltyData = {
      balance: pointsBalance,
      tier: customer.currentTier ? {
        id: customer.currentTier.id,
        name: customer.currentTier.name,
        icon: customer.currentTier.icon || "⭐",
        color: customer.currentTier.color || "#FFD700"
      } : null,
      progress: nextTier ? {
        current: lifetimePoints,
        next: nextTier.threshold || nextTier.minSpend,
        percentage: Math.min(100, Math.round((lifetimePoints / (nextTier.threshold || nextTier.minSpend)) * 100))
      } : null,
      expiringPoints: expiringSum > 0 && earliestExpiration ? {
        amount: expiringSum,
        date: earliestExpiration.expiresAt!.toISOString()
      } : null
    };

    // Return JSON response
    // No CORS headers needed - same-origin via proxy
    return json(loyaltyData, {
      headers: {
        "Cache-Control": "private, max-age=30", // 30 second cache
      }
    });

  } catch (error) {
    console.error("Error fetching loyalty data:", error);
    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Key Changes from Current `/api/storefront/loyalty`:**
1. ✅ Uses `authenticate.public.appProxy(request)` instead of manual CORS
2. ✅ Shop domain from `session.shop` (automatic, secure)
3. ✅ No CORS headers needed
4. ✅ Built-in HMAC verification by Shopify
5. ✅ Handles "app not installed" case gracefully

---

## Phase 2: Shopify Partner Dashboard Configuration

### Step 2.1: Configure App Proxy Settings

**Location:** [Shopify Partner Dashboard](https://partners.shopify.com/) → Your App → App setup → App proxy

**Settings to Configure:**

| Field | Value | Notes |
|-------|-------|-------|
| **Subpath** | `rewardspro` | Creates `/apps/rewardspro/*` URLs |
| **Proxy URL** | `https://rewardspro-production.vercel.app/apps/proxy` | Your backend base URL + `/apps/proxy` |

**What This Does:**

```
Merchant Storefront Request:
https://shop-name.myshopify.com/apps/rewardspro/loyalty?customerId=123
                                      ↓ (Shopify intercepts)
                                      ↓ (Adds HMAC signature)
                                      ↓ (Forwards to)
https://rewardspro-production.vercel.app/apps/proxy/loyalty?customerId=123
                                      ↓ (Your Remix app)
                                      ↓ (Route: apps.proxy.loyalty.tsx)
                                      ↓ (Returns JSON)
                                      ↓ (Shopify forwards back)
Customer receives response
```

**Important Notes:**
- Subpath `rewardspro` → Storefront URLs are `/apps/rewardspro/*`
- Proxy URL must be HTTPS
- Shopify adds query parameters: `shop`, `path_prefix`, `timestamp`, `signature`
- All requests include HMAC signature in `signature` parameter

### Step 2.2: Verify Proxy Configuration

**Test URL Format:**
```
https://YOUR-DEV-STORE.myshopify.com/apps/rewardspro/loyalty?customerId=clx123abc
```

**Expected Query Parameters (added by Shopify):**
```
?customerId=clx123abc
&shop=your-dev-store.myshopify.com
&path_prefix=/apps/rewardspro
&timestamp=1234567890
&signature=abc123def456...
```

**Verification Steps:**
1. Save proxy configuration in Partner Dashboard
2. Wait 2-3 minutes for propagation
3. Test URL in browser (on a store with app installed)
4. Check Network tab for response

---

## Phase 3: Frontend Updates

### Step 3.1: Update Liquid Template

**File:** `extensions/rewardspro-widget/blocks/floating-widget.liquid`

**BEFORE:**
```liquid
{% comment %}
  Lines 29-33: Direct API URL
{% endcomment %}
urls: {
  account: '{{ routes.account_url }}',
  login: '{{ routes.account_login_url }}',
  register: '{{ routes.account_register_url }}',
  membershipApi: '{{ block.settings.api_url | default: "https://rewardspro-production.vercel.app" }}/api/storefront/loyalty'
},
```

**AFTER:**
```liquid
{% comment %}
  Lines 29-33: App Proxy URL

  Note: The subpath 'rewardspro' comes from Partner Dashboard configuration
  Format: /apps/{SUBPATH}/{ENDPOINT}
{% endcomment %}
urls: {
  account: '{{ routes.account_url }}',
  login: '{{ routes.account_login_url }}',
  register: '{{ routes.account_register_url }}',
  membershipApi: '/apps/rewardspro/loyalty'
},
```

**Key Changes:**
- ✅ Relative URL (same-origin)
- ✅ No HTTPS domain needed
- ✅ No `api_url` setting needed (can remove from schema)
- ✅ Works automatically on any shop domain

### Step 3.2: Update Schema (Optional Cleanup)

**File:** `extensions/rewardspro-widget/blocks/floating-widget.liquid`

**Lines 96-102 - REMOVE (optional):**
```liquid
{
  "type": "text",
  "id": "api_url",
  "label": "App API URL",
  "info": "Your RewardsPro app URL (leave blank to use default production URL)",
  "placeholder": "https://rewardspro-production.vercel.app"
},
```

**Reason:** No longer needed since proxy URL is configured in Partner Dashboard

### Step 3.3: Update JavaScript (No Changes Needed)

**File:** `extensions/rewardspro-widget/assets/floating-widget.js`

**Lines 491-493: Already compatible!**
```javascript
const apiUrl = new URL(this.config.urls?.membershipApi);
apiUrl.searchParams.set('customerId', this.config.customerId);
apiUrl.searchParams.set('shop', this.config.shop?.domain);
```

**Why No Changes:**
- `new URL('/apps/rewardspro/loyalty')` works with relative URLs
- Shop parameter still passed (though Shopify also adds it automatically)
- Customer ID parameter unchanged

---

## Phase 4: Testing & Validation

### Step 4.1: Development Store Testing

**Prerequisites:**
1. App installed on development store
2. App proxy configured in Partner Dashboard (allow 2-3 minutes for propagation)
3. Extension deployed with updated Liquid template

**Test Steps:**

1. **Verify Proxy Route Accessible:**
   ```bash
   # Replace with your dev store domain
   curl "https://your-dev-store.myshopify.com/apps/rewardspro/loyalty?customerId=test123"
   ```

   **Expected:** Should forward to your backend and return JSON or error

2. **Test Widget on Storefront:**
   - Navigate to storefront
   - Open browser DevTools → Network tab
   - Log in as customer
   - Observe widget load
   - Check request to `/apps/rewardspro/loyalty`

3. **Verify Request Parameters:**
   ```
   Request URL should include:
   - customerId=clx... (from widget)
   - shop=your-store.myshopify.com (added by Shopify)
   - path_prefix=/apps/rewardspro (added by Shopify)
   - timestamp=... (added by Shopify)
   - signature=... (HMAC, added by Shopify)
   ```

4. **Test Authentication:**
   - Logged-in customer: Should show loyalty data
   - Guest: Should show sign-in prompt
   - Invalid customer ID: Should return 404

### Step 4.2: Backend Verification

**Check Logs:**
```bash
# Vercel logs
vercel logs rewardspro-production --follow

# Should see:
# - Incoming requests to /apps/proxy/loyalty
# - Session shop domain
# - Customer queries
# - Response data
```

**Verify Session Object:**
```typescript
// Add temporary logging in apps.proxy.loyalty.tsx
console.log('App Proxy Request:', {
  shop: session?.shop,
  hasSession: !!session,
  customerId: customerIdFromMetafield,
  url: request.url
});
```

### Step 4.3: Error Handling Tests

| Test Case | Expected Behavior |
|-----------|-------------------|
| App not installed on shop | 403 error: "App not installed" |
| Missing customerId param | 400 error: "Missing required parameter" |
| Invalid customerId | 404 error: "Customer not found" |
| Database error | 500 error: "Internal server error" |
| Valid request | 200 with loyalty data JSON |

---

## Phase 5: Cleanup & Documentation

### Step 5.1: Keep Old Endpoint Temporarily

**File:** `app/routes/api.storefront.loyalty.tsx`

**Add Deprecation Notice:**
```typescript
/**
 * DEPRECATED: Direct API endpoint for storefront loyalty widget
 *
 * ⚠️ This endpoint is deprecated and will be removed in a future version.
 * New implementations should use the app proxy route: /apps/proxy/loyalty
 *
 * Kept for backward compatibility with existing installations.
 * Will be removed after all merchants have updated to app proxy version.
 *
 * Migration: Update Liquid template to use /apps/rewardspro/loyalty
 */
```

**Why Keep It:**
- Merchants may have cached widget versions
- Gradual migration period
- Fallback if proxy has issues

**Removal Timeline:**
- Keep for 2-4 weeks after app proxy deployment
- Monitor access logs
- Remove when usage drops to zero

### Step 5.2: Update Documentation

**Files to Update:**

1. **`WIDGET_SETUP_GUIDE.md`:**
   ```markdown
   ## API Communication

   The widget uses Shopify's App Proxy to securely communicate with the backend:

   - **Storefront URL:** `/apps/rewardspro/loyalty`
   - **Backend Handler:** `app/routes/apps.proxy.loyalty.tsx`
   - **Authentication:** Automatic via Shopify app proxy
   - **CORS:** Not needed (same-origin request)
   ```

2. **`IMPLEMENTATION_VS_GUIDE_ANALYSIS.md`:**
   ```markdown
   ### 3. ✅ App Proxy Usage

   **Status:** COMPLIANT (as of 2025-10-14)

   - Uses `/apps/rewardspro/loyalty` app proxy URL
   - Backend handler: `app/routes/apps.proxy.loyalty.tsx`
   - HMAC verification automatic
   - No CORS complexity
   ```

3. **`FINAL_BLOCKING_FIXES.md`:**
   ```markdown
   ## Completed Migration: App Proxy (2025-10-14)

   Migrated from direct API calls to Shopify app proxy:
   - Frontend: `/apps/rewardspro/loyalty`
   - Backend: `app/routes/apps.proxy.loyalty.tsx`
   - Partner Dashboard: Proxy configured
   - Status: ✅ Fully compliant with Shopify requirements
   ```

---

## Phase 6: Deployment

### Step 6.1: Backend Deployment

**Order of Operations:**

1. **Deploy New Route:**
   ```bash
   # Ensure apps.proxy.loyalty.tsx is in codebase
   git add app/routes/apps.proxy.loyalty.tsx
   git commit -m "Add app proxy route for storefront widget"
   git push

   # Deploy to Vercel
   vercel --prod
   ```

2. **Verify Backend Deployment:**
   ```bash
   curl "https://rewardspro-production.vercel.app/apps/proxy/loyalty?customerId=test"
   # Should return error (expected - no HMAC signature)
   ```

### Step 6.2: Configure Partner Dashboard

**Steps:**
1. Log into [Shopify Partners](https://partners.shopify.com/)
2. Select "Rewards Pro" app
3. Navigate to "App setup"
4. Scroll to "App proxy" section
5. Fill in:
   - Subpath: `rewardspro`
   - Proxy URL: `https://rewardspro-production.vercel.app/apps/proxy`
6. Click "Save"
7. **Wait 2-3 minutes** for DNS propagation

### Step 6.3: Extension Deployment

```bash
# Deploy updated extension with new API URL
npx shopify app deploy --force

# Should show:
# ✅ rewardspro-widget bundled successfully
# ✅ Version: rewardspro-production-19
# ✅ Released to users
```

### Step 6.4: Post-Deployment Verification

**Checklist:**
- [ ] Backend route accessible (test via direct curl with HMAC)
- [ ] Partner Dashboard shows proxy configured
- [ ] Extension deployed (check version number)
- [ ] Test on development store
- [ ] Widget loads without errors
- [ ] Network tab shows `/apps/rewardspro/loyalty` requests
- [ ] Loyalty data displays correctly
- [ ] No CORS errors in console

---

## Rollback Plan

### If Issues Occur:

**Option A: Revert Frontend Only**
```bash
# Revert Liquid template to use direct API
git revert <commit-hash>
npx shopify app deploy --force
```

**Option B: Add Fallback Logic**
```javascript
// In floating-widget.js
async loadData() {
  let apiUrl;

  try {
    // Try app proxy first
    apiUrl = new URL('/apps/rewardspro/loyalty', window.location.origin);
    const response = await fetch(apiUrl.toString() + '?' + params);

    if (!response.ok && response.status === 404) {
      // Fallback to direct API
      console.warn('[RewardsPro] App proxy not available, falling back to direct API');
      apiUrl = new URL(this.config.urls?.membershipApi);
    }
  } catch (error) {
    // Fallback to direct API
    apiUrl = new URL(this.config.urls?.membershipApi);
  }

  // ... rest of fetch logic
}
```

**Option C: Keep Both Routes Active**
- Leave direct API endpoint functional
- Monitor which route gets more traffic
- Gradual migration over time

---

## Success Criteria

### Functional Requirements:
- ✅ Widget loads loyalty data via app proxy
- ✅ No CORS errors in console
- ✅ Authentication works (session-based)
- ✅ Shop context automatically provided
- ✅ Error handling works (404, 403, 500)

### Performance Requirements:
- ✅ Response time < 1 second (similar to direct API)
- ✅ No additional latency from proxy
- ✅ Caching still works (30-second TTL)

### Security Requirements:
- ✅ HMAC signature validated by Shopify
- ✅ Shop-scoped queries prevent cross-store access
- ✅ Session verification prevents unauthorized access
- ✅ No CORS complexity

### Compliance Requirements:
- ✅ Follows Shopify's app proxy requirements
- ✅ Uses `authenticate.public.appProxy()` API
- ✅ Ready for App Store review
- ✅ Documentation updated

---

## Timeline

### Estimated Effort:

| Phase | Task | Time | Complexity |
|-------|------|------|------------|
| 1 | Create backend route | 30 min | Low |
| 2 | Configure Partner Dashboard | 10 min | Low |
| 3 | Update frontend Liquid | 15 min | Low |
| 4 | Testing | 60 min | Medium |
| 5 | Documentation | 30 min | Low |
| 6 | Deployment | 30 min | Low |

**Total: 2.5-3 hours**

### Timeline:

```
Day 1:
- ✅ Create backend route (Phase 1)
- ✅ Configure Partner Dashboard (Phase 2)
- ✅ Update frontend (Phase 3)
- ✅ Initial testing (Phase 4.1-4.2)

Day 2:
- ✅ Thorough testing (Phase 4.3)
- ✅ Documentation updates (Phase 5)
- ✅ Production deployment (Phase 6)
- ✅ Post-deployment monitoring

Week 1-2:
- Monitor app proxy usage
- Keep direct API as fallback
- Collect feedback

Week 2-4:
- Remove direct API endpoint
- Update all documentation references
- Close migration project
```

---

## FAQs

### Q1: Will this break existing installations?

**A:** No, if deployed correctly:
1. Backend route is additive (new file)
2. Partner Dashboard config is non-breaking
3. Frontend update is the only change that affects users
4. Can keep direct API endpoint as fallback

### Q2: What if a merchant hasn't updated their extension?

**A:** They'll continue using the direct API endpoint:
- Old extension → Direct API (still works)
- New extension → App proxy (preferred)
- Gradual migration over time

### Q3: How do I test locally?

**A:** Local development with app proxy:
```bash
# Start Remix dev server
npm run dev

# Use ngrok or Cloudflare Tunnel for HTTPS
ngrok http 3000

# Update Partner Dashboard proxy URL to ngrok URL
# Test on development store
```

### Q4: What about rate limiting?

**A:** App proxy requests count against:
- App's rate limit (not merchant's)
- Same as direct API
- Shopify handles throttling

### Q5: Can I use GraphQL with app proxy?

**A:** Yes! The `admin` and `storefront` objects are available:
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, storefront } = await authenticate.public.appProxy(request);

  if (admin) {
    const response = await admin.graphql(`query { ... }`);
    // Use Admin API
  }

  if (storefront) {
    const response = await storefront.graphql(`query { ... }`);
    // Use Storefront API
  }
}
```

---

## Next Steps

1. **Review This Plan** - Confirm approach and timeline
2. **Create Backend Route** - Implement `apps.proxy.loyalty.tsx`
3. **Configure Partner Dashboard** - Set up proxy settings
4. **Test on Dev Store** - Verify functionality
5. **Deploy to Production** - Follow deployment checklist
6. **Monitor & Iterate** - Watch logs and metrics

---

**Last Updated:** 2025-10-14
**Status:** Ready for implementation
**Approved By:** Pending review
