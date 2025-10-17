# Extensions Architecture

This document explains the **two different extension types** in RewardsPro and why they use **different access patterns**.

## Overview

RewardsPro has **two separate extensions** that display loyalty data:

1. **Theme App Extension** (Storefront Widget) - for public storefront pages
2. **Customer Account Extension** (Profile Block) - for customer account pages

**Important**: These extensions are **fundamentally different** and **should NOT be unified** into the same pattern!

---

## 1. Theme App Extension (Storefront Widget)

### Location
- **Directory**: `extensions/theme-app-extension-rewardspro/`
- **Files**:
  - `blocks/membership_widget.liquid`
  - `assets/membership-widget.js`
  - `assets/membership-widget.css`

### Where It Renders
- **Storefront pages** (homepage, product pages, etc.)
- **Added via**: Theme editor → App embeds
- **Visible to**: All logged-in customers on storefront

### Technical Details

**Access Method**: App Proxy
```
/apps/rewardspro/loyalty?shopifyCustomerId=123
```

**Authentication**: Session-based
- Customer is logged into storefront
- Shopify provides `{{ customer }}` Liquid object
- Uses browser cookies for session

**API Calls**: Relative URLs work!
```javascript
fetch("/apps/rewardspro/loyalty?shopifyCustomerId=123")
```

**Why relative URLs work**:
- Extension runs on shop's domain (`store.myshopify.com`)
- App proxy configured in `shopify.app.toml`:
  ```toml
  [app_proxy]
  url = "https://rewardspro-production.vercel.app/api/proxy"
  subpath = "rewardspro"
  prefix = "apps"
  ```
- Shopify proxies `/apps/rewardspro/*` → Vercel app
- Can use `fetch("/apps/rewardspro/loyalty")` directly

**Design Mode Support**: ✅ Yes
```liquid
{% if request.design_mode %}
  <!-- Show placeholder in theme editor -->
  <div>Preview: Membership Widget</div>
{% endif %}
```

**Server Endpoint**: `/app/routes/apps.proxy.loyalty.tsx`
- Validates HMAC signature from Shopify
- Extracts shop from query params
- No JWT tokens needed

---

## 2. Customer Account Extension (Profile Block)

### Location
- **Directory**: `extensions/rewards-pro-membership/`
- **Files**:
  - `src/HelloWorldBlock.tsx`
  - `src/hooks/useSessionToken.ts`
  - `src/utils/apiClient.ts`

### Where It Renders
- **Customer account pages** (profile, order status)
- **Added via**: Customer account editor
- **Visible to**: Customers viewing their own account

### Technical Details

**Access Method**: Direct API calls with JWT tokens
```
https://rewardspro-production.vercel.app/api/customer-account/loyalty
Authorization: Bearer <JWT_TOKEN>
```

**Authentication**: JWT Session Tokens
- Shopify provides session token API
- Token contains customer ID and shop domain
- Token validated server-side

**API Calls**: MUST use absolute URLs!
```typescript
fetch("https://rewardspro-production.vercel.app/api/customer-account/loyalty", {
  headers: {
    Authorization: `Bearer ${sessionToken}`
  }
})
```

**Why absolute URLs required**:
- Extension runs on `extensions.shopifycdn.com` (sandboxed)
- No access to shop domain or `window.location`
- Cannot use relative URLs - they fail to parse!
- Must explicitly call Vercel app URL

**App Domain**:
```
https://rewardspro-production.vercel.app
```
NOT the shop domain (`store.myshopify.com`)!

**Design Mode Support**: ✅ Yes (via placeholder)
```typescript
if (!isAuthenticated) {
  return <View>Membership Preview - Sign in to view</View>
}
```

**Server Endpoints**:
- `/app/routes/api.customer-account.loyalty.tsx` - Main data
- `/app/routes/api.customer-account.heartbeat.tsx` - Detection signals

**Authentication Flow**:
1. Extension calls `sessionToken.get()` → JWT string
2. JWT contains `sub` (customer GID) and `dest` (shop domain)
3. API client adds `Authorization: Bearer <JWT>`
4. Server validates with `authenticate.public.customerAccount()`
5. Server extracts customer ID from token's `sub` claim
6. Server scopes queries to shop from token's `dest` claim

---

## Key Differences

| Feature | Theme Extension | Customer Account Extension |
|---------|----------------|---------------------------|
| **Runs on** | Shop domain | `extensions.shopifycdn.com` |
| **URL type** | Relative (`/apps/rewardspro/...`) | Absolute (`https://...`) |
| **Access method** | App proxy | Direct API calls |
| **Authentication** | Session cookies | JWT tokens |
| **Validation** | HMAC signature | Session token |
| **Server route** | `apps.proxy.loyalty.tsx` | `api.customer-account.loyalty.tsx` |
| **Can use relative URLs** | ✅ Yes | ❌ No |
| **Design mode** | `request.design_mode` | `!isAuthenticated` |

---

## Why They Can't Be Unified

**Attempting to unify them breaks both!**

### Theme Extension needs:
- Relative URLs (works on shop domain)
- App proxy endpoint
- HMAC validation
- Access to `{{ customer }}` Liquid object

### Customer Account Extension needs:
- Absolute URLs (sandboxed environment)
- Direct Vercel app URL
- JWT session tokens
- No Liquid, pure React/TypeScript

**Attempting to use absolute URLs in theme extension**: Won't work with app proxy
**Attempting to use relative URLs in customer account**: Fails to parse URL
**Attempting to use JWT tokens in theme extension**: No session token API available
**Attempting to use cookies in customer account**: Sandboxed, different origin

---

## Common Mistakes

### ❌ Don't Do This

**Mistake 1**: Using relative URLs in customer account extension
```typescript
// ❌ FAILS: "Failed to parse URL from /api/customer-account/loyalty"
fetch("/api/customer-account/loyalty")
```

**Mistake 2**: Using absolute URLs in theme extension
```javascript
// ❌ FAILS: Bypasses app proxy, CORS errors
fetch("https://rewardspro-production.vercel.app/api/proxy/loyalty")
```

**Mistake 3**: Trying to use session tokens in theme extension
```javascript
// ❌ FAILS: No sessionToken API in theme extensions
const token = await sessionToken.get()
```

**Mistake 4**: Expecting cookies in customer account
```typescript
// ❌ FAILS: Different origin, no cookies
fetch(url, { credentials: 'include' })
```

### ✅ Do This Instead

**Theme Extension**:
```javascript
// ✅ Use relative URL to app proxy
fetch(`/apps/rewardspro/loyalty?shopifyCustomerId=${customerId}`)
```

**Customer Account Extension**:
```typescript
// ✅ Use absolute URL with JWT token
const token = await sessionToken.get();
fetch("https://rewardspro-production.vercel.app/api/customer-account/loyalty", {
  headers: { Authorization: `Bearer ${token}` }
})
```

---

## Testing

### Theme Extension
1. Go to **Online Store → Themes → Customize**
2. Click **App embeds** icon
3. Enable "Membership Widget"
4. Preview shows placeholder in design mode
5. Login required for real data

### Customer Account Extension
1. Go to **Settings → Customer accounts → Editor**
2. Select **Profile** page
3. Add "RewardsPro Membership" block
4. Preview shows placeholder when not logged in
5. Test with actual customer account

---

## Debugging

### Theme Extension Console Logs
```
[MembershipWidget Liquid] Template loaded
[MembershipWidget Liquid] Customer exists: {...}
[MembershipWidget Liquid] Design mode: true/false
[MembershipWidget] Starting loyalty data fetch...
```

### Customer Account Extension Console Logs
```
[useSessionToken] Session token received, length: 850
[ApiClient:req_xxx] Constructed URL: https://rewardspro-production.vercel.app/...
[ApiClient:req_xxx] Response received in 367ms
[HelloWorldBlock] API response received: { success: true, ... }
```

---

## Summary

**Two extensions, two patterns - keep them separate!**

- **Theme extension** = App proxy + relative URLs + session cookies
- **Customer account extension** = Direct API + absolute URLs + JWT tokens

They're designed for different contexts and **cannot be merged** without breaking functionality.
