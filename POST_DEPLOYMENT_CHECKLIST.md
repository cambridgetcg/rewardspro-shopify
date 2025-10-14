# Post-Deployment Checklist: App Proxy Migration

**Date:** 2025-10-14
**Migration Version:** rewardspro-production-19
**Status:** ⏳ Awaiting Partner Dashboard Configuration

---

## Implementation Status

### ✅ Completed Tasks

- [x] **Backend Route Created**
  - File: `app/routes/apps.proxy.loyalty.tsx`
  - Uses: `authenticate.public.appProxy(request)`
  - Status: Deployed to production

- [x] **Frontend Updated**
  - File: `extensions/rewardspro-widget/blocks/floating-widget.liquid`
  - Changed: URL from direct API to `/apps/rewardspro/loyalty`
  - Status: Extension version `rewardspro-production-19` deployed

- [x] **Old Endpoint Deprecated**
  - File: `app/routes/api.storefront.loyalty.tsx`
  - Status: Marked as deprecated, kept for backward compatibility
  - Removal: Planned for 2-4 weeks after full migration

- [x] **Documentation Created**
  - `IMPLEMENTATION_VS_GUIDE_ANALYSIS.md` - Compliance analysis
  - `APP_PROXY_MIGRATION_PLAN.md` - Full migration plan
  - `PARTNER_DASHBOARD_APP_PROXY_SETUP.md` - Setup guide
  - `scripts/verify-app-proxy.mjs` - Testing script

- [x] **Code Committed & Deployed**
  - Git commit: "Implement app proxy for storefront widget"
  - Backend: Auto-deployed via Vercel
  - Extension: Version 19 live

---

## 🔴 Required: Partner Dashboard Configuration

**Status:** NOT YET COMPLETED
**Owner:** Requires Partner Dashboard access (cambridgetcg@gmail.com)
**Estimated Time:** 5 minutes + 2-3 minutes for DNS propagation

### Configuration Steps

1. **Access Partner Dashboard**
   - Go to: https://partners.shopify.com/
   - Navigate to: **Apps** → **Rewards Pro** → **App setup**

2. **Locate App Proxy Section**
   - Scroll down to **App proxy** section

3. **Configure Settings**
   ```
   Subpath:    rewardspro
   Proxy URL:  https://rewardspro-production.vercel.app/apps/proxy
   ```

4. **Save Configuration**
   - Click **Save** at bottom of page
   - **Wait 2-3 minutes** for DNS propagation

5. **Verify Configuration**
   - Settings should be saved and visible
   - No error messages in Partner Dashboard

### 📖 Detailed Instructions

See: `PARTNER_DASHBOARD_APP_PROXY_SETUP.md` (lines 31-88)

---

## ⏸️ Pending: Testing & Verification

**Prerequisites:**
- ✅ Backend deployed
- ✅ Extension deployed
- ⏳ Partner Dashboard configured (REQUIRED)
- ⏳ DNS propagated (wait 2-3 minutes after configuration)

### Test 1: Automated Verification

**Run the verification script:**

```bash
# Basic test (will get 400 if working, 404 if not configured)
node scripts/verify-app-proxy.mjs rewardspro-dev.myshopify.com

# Full test with customer ID
node scripts/verify-app-proxy.mjs rewardspro-dev.myshopify.com gid://shopify/Customer/8461635584296
```

**Expected Results:**

| Status Code | Meaning | Action Required |
|------------|---------|-----------------|
| **404** | App proxy not configured | Configure in Partner Dashboard |
| **403** | Configured, app not installed | Install app on dev store |
| **400** | Working! (no customer ID) | Provide customer ID for full test |
| **200** | Fully working! | ✅ Success - proceed to next test |

### Test 2: Browser Testing

**Prerequisites:**
- App installed on development store
- Customer logged into storefront
- Widget enabled in Theme Editor

**Steps:**

1. **Open Development Store**
   - URL: https://rewardspro-dev.myshopify.com
   - Log in as a customer with loyalty data

2. **Open Browser DevTools**
   - Press `F12` or `Cmd+Option+I`
   - Switch to **Network** tab
   - Filter: `loyalty`

3. **Trigger Widget**
   - Widget should auto-load on page
   - Or manually expand widget if minimized

4. **Verify Network Request**
   ```
   Request URL: /apps/rewardspro/loyalty?customerId=clx123abc
   Status: 200
   Response: JSON with loyalty data
   ```

5. **Check Request Parameters** (should be added by Shopify):
   - `shop`: store.myshopify.com
   - `path_prefix`: /apps/rewardspro
   - `timestamp`: Unix timestamp
   - `signature`: HMAC signature (long hex string)

6. **Verify Response Data**
   ```json
   {
     "balance": 1250,
     "tier": {
       "id": "...",
       "name": "Gold",
       "icon": "⭐",
       "color": "#FFD700"
     },
     "progress": { ... },
     "expiringPoints": null
   }
   ```

### Test 3: Backend Logs

**Check Vercel logs for app proxy activity:**

```bash
vercel logs rewardspro-production --follow
```

**Look for log entries:**
```
[App Proxy] Request: { shop: '...', customerId: '...', url: '...' }
[App Proxy] Success: { shop: '...', customerId: '...', balance: 1250, tier: 'Gold' }
```

**If errors:**
```
[App Proxy] Error fetching loyalty data: ...
```

### Test 4: Multiple Scenarios

Test these edge cases:

- [ ] **Guest User** (not logged in)
  - Widget should show guest message
  - No API request should be made

- [ ] **Logged-in Customer with Points**
  - Widget shows correct balance
  - Tier displayed correctly
  - Progress bar accurate

- [ ] **Logged-in Customer without Points**
  - Widget shows zero balance
  - No tier displayed
  - Progress shows 0%

- [ ] **Customer Not in Database**
  - API returns 404
  - Widget shows error state or fallback

- [ ] **Store Without App Installed**
  - API returns 403
  - Widget handles gracefully

---

## 📊 Success Criteria

### All Must Pass ✅

- [ ] Partner Dashboard app proxy configured correctly
- [ ] DNS propagated (verified via curl or script)
- [ ] Widget loads on storefront
- [ ] Network tab shows `/apps/rewardspro/loyalty` request (200 status)
- [ ] Response is valid JSON with loyalty data
- [ ] No CORS errors in browser console
- [ ] No JavaScript errors in browser console
- [ ] Backend logs show `[App Proxy]` entries
- [ ] Widget displays correct customer data
- [ ] Widget works on multiple pages
- [ ] Widget remembers minimized/expanded state
- [ ] Guest users see appropriate message

### Performance Checks

- [ ] API response time < 500ms (average)
- [ ] No N+1 query issues in logs
- [ ] Cache-Control header present (30 seconds)
- [ ] Widget loads without blocking page render

---

## 🚨 Troubleshooting

### Issue: 404 Not Found

**Symptoms:**
```
GET /apps/rewardspro/loyalty → 404
```

**Causes & Solutions:**

1. **App proxy not configured**
   - ❌ Subpath or Proxy URL not set
   - ✅ Configure in Partner Dashboard
   - ✅ Wait 2-3 minutes for DNS

2. **DNS not propagated**
   - ❌ Configuration saved but not live yet
   - ✅ Wait 2-3 more minutes
   - ✅ Clear browser cache

3. **App not installed**
   - ❌ Store doesn't have app installed
   - ✅ Install app from Admin → Apps

4. **Typo in subpath**
   - ❌ Using `rewardsPro` instead of `rewardspro`
   - ✅ Must match Partner Dashboard exactly

### Issue: 403 Forbidden

**Symptoms:**
```json
{
  "error": "App not installed",
  "message": "Please install RewardsPro from the Shopify App Store"
}
```

**Causes & Solutions:**

1. **App not installed on store**
   - ✅ Go to Admin → Apps → Install Rewards Pro

2. **Session not found**
   - ❌ App was uninstalled recently
   - ✅ Reinstall app
   - ✅ Check OAuth flow completed

### Issue: 400 Bad Request

**Symptoms:**
```json
{
  "error": "Missing required parameter: customerId"
}
```

**Causes & Solutions:**

1. **Customer metafield not set**
   - ❌ Metafield definition doesn't exist
   - ✅ Run: `POST /api/setup-customer-metafield`
   - ✅ Verify metafield exists in Admin

2. **Frontend not passing customerId**
   - ❌ Widget JavaScript not sending parameter
   - ✅ Check `floating-widget.js` is deployed
   - ✅ Verify extension version deployed

### Issue: 500 Internal Server Error

**Check backend logs immediately:**

```bash
vercel logs rewardspro-production --follow
```

**Common causes:**

1. **Database connection issue**
   - Check Prisma connection
   - Verify DATABASE_URL environment variable

2. **Prisma query error**
   - Check for null/undefined values
   - Verify shop exists in database

3. **Type conversion error**
   - Decimal to number conversion failing
   - Check Prisma schema matches database

### Issue: CORS Errors (Should NOT Happen)

**Symptoms:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**This should NOT happen with app proxy!**

**If you see CORS errors:**

1. **Widget using wrong URL**
   - ❌ Check `floating-widget.liquid` line 33
   - ✅ Should be: `/apps/rewardspro/loyalty` (relative)
   - ✅ NOT: `https://rewardspro-production.vercel.app/...`

2. **Extension not deployed**
   - ❌ Old version still active
   - ✅ Run: `npm run deploy`
   - ✅ Verify version number updated

3. **Browser cache**
   - ❌ Old JavaScript cached
   - ✅ Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - ✅ Clear site data in DevTools

---

## 📝 Monitoring

### Metrics to Watch

**First 24 Hours:**
- Request volume to `/apps/proxy/loyalty`
- Success rate (% of 200 responses)
- Average response time
- Error rate by type (404, 403, 500)

**Ongoing:**
- Widget load times
- Database query performance
- Cache hit rates
- User engagement with widget

### Set Up Alerts

**Recommended alerts:**

1. **High Error Rate**
   - Trigger: >5% of requests failing
   - Action: Check logs, database, Partner Dashboard config

2. **Slow Response Times**
   - Trigger: >2s average response time
   - Action: Optimize queries, check database load

3. **No Requests**
   - Trigger: Zero requests in 1 hour (during business hours)
   - Action: Check app proxy configuration, widget deployment

4. **Database Errors**
   - Trigger: Any Prisma connection errors
   - Action: Check DATABASE_URL, database status

---

## 🗓️ Migration Timeline

### Phase 1: Deploy (COMPLETED ✅)
- **Date:** 2025-10-14
- **Duration:** 2 hours
- Backend route created
- Frontend updated
- Documentation written
- Code deployed

### Phase 2: Configure (PENDING ⏳)
- **Date:** TBD (requires Partner Dashboard access)
- **Duration:** 5 minutes + 2-3 min propagation
- Partner Dashboard app proxy configuration
- DNS propagation wait

### Phase 3: Testing (PENDING ⏳)
- **Date:** Immediately after Phase 2
- **Duration:** 30 minutes
- Automated verification script
- Browser testing
- Edge case testing
- Performance testing

### Phase 4: Monitoring (PENDING ⏳)
- **Date:** After Phase 3 passes
- **Duration:** 1 week
- Watch for errors
- Monitor old endpoint usage
- Gather merchant feedback

### Phase 5: Cleanup (PENDING ⏳)
- **Date:** 2-4 weeks after Phase 4
- **Duration:** 30 minutes
- Remove deprecated endpoint (`api.storefront.loyalty.tsx`)
- Remove CORS helpers
- Update documentation
- Final verification

---

## 🎯 Next Immediate Action

### For User (cambridgetcg@gmail.com):

**Step 1: Configure Partner Dashboard** (5 minutes)
1. Go to https://partners.shopify.com/
2. Navigate to: Apps → Rewards Pro → App setup
3. Scroll to: App proxy section
4. Enter:
   - Subpath: `rewardspro`
   - Proxy URL: `https://rewardspro-production.vercel.app/apps/proxy`
5. Click **Save**
6. **Wait 2-3 minutes** for DNS propagation

**Step 2: Run Verification** (2 minutes)
```bash
# From project root
node scripts/verify-app-proxy.mjs rewardspro-dev.myshopify.com

# Expected: 400 or 403 (both mean it's working)
# If 404: Wait longer or check configuration
```

**Step 3: Test in Browser** (5 minutes)
1. Open dev store: https://rewardspro-dev.myshopify.com
2. Log in as customer
3. Open DevTools → Network tab
4. Load page with widget
5. Verify `/apps/rewardspro/loyalty` request succeeds (200)

**Step 4: Monitor** (ongoing)
```bash
vercel logs rewardspro-production --follow
```

---

## 📚 Reference Documentation

- **Setup Guide:** `PARTNER_DASHBOARD_APP_PROXY_SETUP.md`
- **Migration Plan:** `APP_PROXY_MIGRATION_PLAN.md`
- **Compliance Analysis:** `IMPLEMENTATION_VS_GUIDE_ANALYSIS.md`
- **Verification Script:** `scripts/verify-app-proxy.mjs`
- **Shopify Docs:** https://shopify.dev/docs/apps/online-store/app-proxies

---

## ✅ Definition of Done

This migration is considered **complete** when:

- [x] Backend route implemented
- [x] Frontend updated
- [x] Code deployed
- [ ] **Partner Dashboard configured** ← **YOU ARE HERE**
- [ ] DNS propagated
- [ ] Verification script passes
- [ ] Browser testing passes
- [ ] No errors in production for 24 hours
- [ ] All edge cases handled
- [ ] Documentation complete
- [ ] Team notified

**Current Status:** 60% complete (3/5 phases done)
**Blocking:** Partner Dashboard configuration (manual step)
**ETA to Completion:** ~10 minutes after configuration

---

**Last Updated:** 2025-10-14
**Next Review:** After Partner Dashboard configuration
