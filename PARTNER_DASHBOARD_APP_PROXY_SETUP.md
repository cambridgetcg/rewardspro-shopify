# Partner Dashboard App Proxy Setup Guide

**Date:** 2025-10-14
**Purpose:** Configure Shopify App Proxy in Partner Dashboard for RewardsPro widget

---

## Overview

App Proxy allows your app to handle requests from merchant storefronts securely through Shopify's infrastructure. This setup is **required** for the RewardsPro loyalty widget to work.

**What it does:**
- Routes `/apps/rewardspro/*` requests from storefronts to your backend
- Adds HMAC signature for authentication
- Provides shop context automatically
- Eliminates CORS complexity

---

## Prerequisites

- ✅ Backend route deployed: `app/routes/apps.proxy.loyalty.tsx`
- ✅ Production URL: `https://rewardspro-production.vercel.app`
- ✅ Shopify Partner account with app access
- ✅ App must be published (at least development version)

---

## Step-by-Step Configuration

### Step 1: Access Partner Dashboard

1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Click **Apps** in the left sidebar
3. Select **Rewards Pro** from your app list
4. Navigate to **App setup** tab

### Step 2: Locate App Proxy Section

1. Scroll down to the **App proxy** section
2. You'll see two input fields:
   - **Subpath**
   - **Proxy URL**

### Step 3: Configure Subpath

**Field:** Subpath
**Value:** `rewardspro`

**What this does:**
- Creates storefront URLs like: `/apps/rewardspro/*`
- Example: `https://shop-name.myshopify.com/apps/rewardspro/loyalty`

**Rules:**
- Lowercase only
- No spaces or special characters
- Alphanumeric and hyphens only
- Cannot start or end with hyphen

### Step 4: Configure Proxy URL

**Field:** Proxy URL
**Value:** `https://rewardspro-production.vercel.app/apps/proxy`

**Important Notes:**
- Must be HTTPS (required by Shopify)
- Should point to your production backend
- Path must end with `/apps/proxy` (Remix convention)
- Shopify will append the subpath after this URL

**URL Mapping:**
```
Storefront Request:
https://shop.myshopify.com/apps/rewardspro/loyalty
                            ↓
Shopify App Proxy intercepts and forwards to:
                            ↓
https://rewardspro-production.vercel.app/apps/proxy/loyalty
                            ↓
Remix routes to: app/routes/apps.proxy.loyalty.tsx
```

### Step 5: Save Configuration

1. Click **Save** button at the bottom of the page
2. **Wait 2-3 minutes** for DNS propagation
3. Configuration is now active globally

---

## Verification

### Test 1: Direct Backend Access

**NOT expected to work** (app proxy requires Shopify signature):

```bash
curl "https://rewardspro-production.vercel.app/apps/proxy/loyalty?customerId=test123"

# Expected: 403 error or "App not installed"
# Reason: No HMAC signature from Shopify
```

### Test 2: Storefront Access (Development Store)

**Expected to work** (if app is installed):

```bash
# Replace with your development store domain
curl "https://your-dev-store.myshopify.com/apps/rewardspro/loyalty?customerId=clx123abc"

# Expected: JSON response with loyalty data or 404 if customer not found
```

### Test 3: Browser Testing

1. Install app on a development store
2. Navigate to storefront
3. Open Browser DevTools → Network tab
4. Log in as a customer
5. Enable the Rewards Widget (Theme Editor → App embeds)
6. Watch for request to `/apps/rewardspro/loyalty`
7. Verify response is JSON with loyalty data

### Test 4: Check Query Parameters

When Shopify forwards the request, it adds these parameters:

```
?customerId=clx123abc           ← From widget
&shop=store.myshopify.com       ← Added by Shopify
&path_prefix=/apps/rewardspro   ← Added by Shopify
&timestamp=1234567890           ← Added by Shopify
&signature=abc123def456...      ← HMAC signature
```

**Verify in Network tab:**
- All parameters present
- Signature is a long hex string
- Shop domain matches your store

---

## Troubleshooting

### Issue 1: 404 Not Found

**Symptoms:**
```
GET /apps/rewardspro/loyalty → 404
```

**Possible Causes:**
1. App proxy not configured in Partner Dashboard
2. DNS not propagated yet (wait 2-3 minutes)
3. Subpath misspelled
4. App not installed on the store

**Solutions:**
- Double-check Partner Dashboard configuration
- Wait a few minutes and try again
- Verify app is installed: Admin → Apps → Rewards Pro should be listed
- Check subpath matches exactly: `rewardspro` (lowercase, no spaces)

### Issue 2: 403 Forbidden / "App not installed"

**Symptoms:**
```json
{
  "error": "App not installed",
  "message": "Please install RewardsPro from the Shopify App Store"
}
```

**Possible Causes:**
1. App not installed on the store making the request
2. Session not found (app was uninstalled)

**Solutions:**
- Install app from Shopify Admin → Apps
- Reinstall if recently uninstalled
- Verify OAuth flow completed successfully

### Issue 3: 500 Internal Server Error

**Symptoms:**
```json
{
  "error": "Internal server error"
}
```

**Possible Causes:**
1. Database connection issue
2. Backend route has a bug
3. Environment variables missing

**Solutions:**
- Check Vercel logs: `vercel logs rewardspro-production`
- Verify database connection
- Check environment variables in Vercel dashboard
- Review backend code for errors

### Issue 4: CORS Errors (Should Not Occur)

**Symptoms:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**This should NOT happen with app proxy!**

**If you see CORS errors:**
1. Verify you're using `/apps/rewardspro/loyalty` (relative URL)
2. Check that Liquid template was updated correctly
3. Clear browser cache and try again
4. Ensure extension was redeployed after changes

### Issue 5: Empty Response / No Data

**Symptoms:**
- Request succeeds (200 OK)
- Response is empty or has null values

**Possible Causes:**
1. Customer metafield not set up
2. Customer ID invalid
3. No loyalty data for this customer

**Solutions:**
- Run metafield setup: `POST /api/setup-customer-metafield`
- Check customer exists in database
- Verify `pointsBalance` and `lifetimePoints` are populated
- Run: `node scripts/check-widget-status.mjs`

---

## Configuration Reference

### Current Settings

| Setting | Value |
|---------|-------|
| **App Name** | Rewards Pro |
| **Subpath** | `rewardspro` |
| **Proxy URL** | `https://rewardspro-production.vercel.app/apps/proxy` |
| **Storefront URL Format** | `/apps/rewardspro/{endpoint}` |
| **Backend Route** | `app/routes/apps.proxy.loyalty.tsx` |

### URL Mapping Examples

| Storefront URL | Backend Route File |
|----------------|-------------------|
| `/apps/rewardspro/loyalty` | `apps.proxy.loyalty.tsx` |
| `/apps/rewardspro/test` | `apps.proxy.test.tsx` (if exists) |
| `/apps/rewardspro/foo/bar` | `apps.proxy.foo.bar.tsx` (if exists) |

**Pattern:** `/apps/{SUBPATH}/{PATH}` → `apps.proxy.{PATH}.tsx`

### Shopify-Added Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `shop` | Store domain | `store.myshopify.com` |
| `path_prefix` | App proxy prefix | `/apps/rewardspro` |
| `timestamp` | Unix timestamp | `1234567890` |
| `signature` | HMAC-SHA256 signature | `abc123def...` |

**Authentication:**
- Shopify generates HMAC signature using app's secret
- `authenticate.public.appProxy()` validates signature automatically
- No manual verification needed

---

## Security Considerations

### What Shopify Handles

✅ **HMAC Signature Verification**
- Shopify signs requests with app secret
- Invalid signatures are rejected automatically
- Prevents request tampering

✅ **Shop Domain Validation**
- Shop domain is verified by Shopify
- Can't be spoofed by client
- Safe to trust `session.shop`

✅ **Rate Limiting**
- Requests count against app's rate limit
- Protected from abuse
- Throttling handled by Shopify

### What Your App Should Handle

⚠️ **Customer ID Validation**
- Verify customer belongs to shop
- Use shop-scoped database queries
- Don't trust customer ID blindly

⚠️ **Input Sanitization**
- Validate query parameters
- Sanitize before database queries
- Prevent SQL injection (Prisma handles this)

⚠️ **Error Handling**
- Don't expose sensitive error details
- Log errors securely
- Return user-friendly messages

### Best Practices

```typescript
// ✅ GOOD: Shop-scoped query
const customer = await db.customer.findFirst({
  where: {
    id: customerId,
    shop: session.shop  // ← Prevents cross-shop access
  }
});

// ❌ BAD: No shop scope
const customer = await db.customer.findUnique({
  where: { id: customerId }  // ← Could return customer from any shop!
});
```

---

## Monitoring

### Vercel Logs

**View live logs:**
```bash
vercel logs rewardspro-production --follow
```

**Look for:**
- `[App Proxy] Request:` - Incoming requests
- `[App Proxy] Success:` - Successful responses
- `[App Proxy] Error:` - Errors

**Example log entries:**
```
[App Proxy] Request: {
  shop: 'dev-store.myshopify.com',
  customerId: 'clx123abc',
  url: '/apps/proxy/loyalty?customerId=clx123abc&shop=...'
}

[App Proxy] Success: {
  shop: 'dev-store.myshopify.com',
  customerId: 'clx123abc',
  balance: 1250,
  tier: 'Gold'
}
```

### Metrics to Track

- **Request Volume:** How many requests per minute/hour
- **Success Rate:** Percentage of 200 responses
- **Error Rate:** Percentage of 404/500 errors
- **Response Time:** Average latency

### Alerts to Set Up

1. **High Error Rate:** >5% of requests failing
2. **Slow Responses:** >2s average response time
3. **Database Issues:** Connection errors
4. **App Not Installed:** Spike in 403 errors

---

## Testing Checklist

Before marking app proxy as "ready for production":

- [ ] Partner Dashboard configured correctly
- [ ] DNS propagated (waited 2-3 minutes)
- [ ] App installed on development store
- [ ] Extension deployed with updated URL
- [ ] Widget loads on storefront
- [ ] Network tab shows `/apps/rewardspro/loyalty` request
- [ ] Response is valid JSON with loyalty data
- [ ] No CORS errors in console
- [ ] Logs show `[App Proxy]` entries
- [ ] Error handling works (404, 403, 500)
- [ ] Session authentication works
- [ ] Shop-scoped queries verified

---

## Migration Checklist

When switching from direct API to app proxy:

- [x] Backend route created (`apps.proxy.loyalty.tsx`)
- [x] Frontend updated (`floating-widget.liquid`)
- [ ] Partner Dashboard configured
- [ ] DNS propagated (wait time)
- [ ] Extension deployed
- [ ] Development store tested
- [ ] Production store tested
- [ ] Old endpoint marked as deprecated
- [ ] Documentation updated
- [ ] Team notified of change

---

## Support Resources

### Shopify Documentation

- [App Proxy Overview](https://shopify.dev/docs/apps/online-store/app-proxies)
- [authenticate.public.appProxy API](https://shopify.dev/docs/api/shopify-app-remix/v2/authenticate/public/app-proxy)
- [Partner Dashboard Guide](https://help.shopify.com/en/partners/dashboard)

### Internal Documentation

- `APP_PROXY_MIGRATION_PLAN.md` - Full migration plan
- `IMPLEMENTATION_VS_GUIDE_ANALYSIS.md` - Architecture comparison
- `app/routes/apps.proxy.loyalty.tsx` - Backend implementation
- `extensions/rewardspro-widget/blocks/floating-widget.liquid` - Frontend integration

### Getting Help

1. **Check Vercel logs** for backend errors
2. **Check browser console** for frontend errors
3. **Review Partner Dashboard** configuration
4. **Test on development store** first
5. **Contact Shopify Support** for platform issues

---

## Quick Reference

**Configuration Summary:**

```
Partner Dashboard Settings:
├─ Subpath: rewardspro
└─ Proxy URL: https://rewardspro-production.vercel.app/apps/proxy

Storefront URL Format:
└─ /apps/rewardspro/{endpoint}

Backend Route Pattern:
└─ app/routes/apps.proxy.{endpoint}.tsx

Current Endpoints:
└─ /apps/rewardspro/loyalty → apps.proxy.loyalty.tsx
```

**Test Command:**
```bash
# From storefront (requires app installed)
curl "https://YOUR-STORE.myshopify.com/apps/rewardspro/loyalty?customerId=CUSTOMER_ID"
```

**Verify Deployment:**
```bash
# Check backend is deployed
vercel ls rewardspro-production

# Check extension is deployed
shopify app versions list --limit 1
```

---

**Last Updated:** 2025-10-14
**Configuration Status:** Ready for setup
**Tested On:** Development store pending configuration
