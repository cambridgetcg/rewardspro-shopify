# RewardsPro Storefront Widget

A Shopify theme app extension that displays customer loyalty information on the storefront.

## Overview

The RewardsPro Widget allows customers to view their loyalty program status directly on your storefront, including:
- Current points balance
- Tier membership (if applicable)
- Progress to next tier
- Expiring points warnings
- Quick access to full rewards page

## Features

### Three Widget Variants

1. **Full Card** - Rich card display with all information
2. **Compact Badge** - Minimal inline badge showing points
3. **Inline Bar** - Horizontal bar with tier and progress

### Smart Features

- ✅ Real-time data loading with 30-second caching
- ✅ Background data refresh for better UX
- ✅ Responsive design for mobile and desktop
- ✅ Graceful error handling with fallback UI
- ✅ Automatic retry on network errors
- ✅ Theme editor preview support
- ✅ Accessibility compliant (WCAG 2.1)
- ✅ Localization ready

## Files Structure

```
extensions/rewardspro-widget/
├── shopify.extension.toml          # Extension configuration
├── blocks/
│   ├── loyalty-card.liquid         # Main widget block
│   └── star_rating.liquid          # (existing demo block)
├── assets/
│   ├── loyalty-widget.js           # Widget JavaScript logic
│   ├── loyalty-widget.css          # Widget styles
│   └── (other assets)
├── locales/
│   └── en.default.json             # English translations
└── snippets/
    └── stars.liquid                # (existing snippet)
```

## Installation & Setup

### Step 1: Deploy the Extension

```bash
cd extensions/rewardspro-widget
shopify app deploy
```

### Step 2: Set Up Customer Metafield

The widget requires a custom metafield on customers to store the RewardsPro customer ID.

**Option A: Automatic Setup (Recommended)**

Make a POST request to the setup endpoint from your app's admin:

```bash
curl -X POST https://your-app.shopify.com/api/setup-customer-metafield \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Option B: Manual Setup via Shopify Admin**

1. Go to **Settings > Custom data > Customers**
2. Add a metafield definition:
   - **Namespace:** `rewardspro`
   - **Key:** `customer_id`
   - **Type:** Single line text
   - **Access:** Storefront read access

### Step 3: Populate Customer Metafields

For existing customers, the metafield needs to be populated. The setup endpoint (Step 2) automatically does this. For new customers, the metafield will be set automatically when they're synced to RewardsPro.

### Step 4: Add Widget to Theme

1. Go to **Online Store > Themes > Customize**
2. Navigate to a page (e.g., Account page, Product page)
3. Click **Add section** or **Add block**
4. Find **Apps > Loyalty Card** under available blocks
5. Configure the widget settings:
   - **Widget Style:** Full Card, Compact, or Inline
   - **Show Progress:** Toggle tier progress display
   - **Show Expiring:** Toggle expiring points warning
   - **CTA Text:** Button text (default: "View Rewards")
   - **CTA URL:** Button destination (default: `/account`)
   - **Primary Color:** Brand color for buttons/accents
   - **Background Color:** Widget background color

## API Endpoint

### GET `/api/storefront/loyalty`

Fetches loyalty data for a customer.

**Query Parameters:**
- `customerId` (required) - Customer's metafield ID (from `customer.metafield.rewardspro.customer_id.value`)
- `shop` (required) - Shop domain (from `shop.permanent_domain`)

**Example Request:**
```javascript
fetch('/api/storefront/loyalty?customerId=abc123&shop=example.myshopify.com')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:**
```json
{
  "balance": 1500,
  "tier": {
    "id": "tier_123",
    "name": "Gold",
    "icon": "⭐",
    "color": "#FFD700"
  },
  "progress": {
    "current": 1500,
    "next": 2000,
    "percentage": 75
  },
  "expiringPoints": {
    "amount": 200,
    "date": "2025-11-15T00:00:00.000Z"
  }
}
```

## Configuration Options

### Block Settings (Liquid)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `variant` | select | `card` | Widget style: `card`, `compact`, or `inline` |
| `show_progress` | checkbox | `true` | Show tier progress bar |
| `show_expiring` | checkbox | `true` | Show expiring points warning |
| `cta_text` | text | `View Rewards` | Call-to-action button text |
| `cta_url` | url | `/account` | Call-to-action button URL |
| `show_login_prompt` | checkbox | `true` | Show login prompt for guests |
| `primary_color` | color | `#4F46E5` | Primary accent color |
| `background_color` | color | `#F9FAFB` | Widget background color |

## Customization

### CSS Variables

You can override widget styles using CSS custom properties:

```css
.rewardspro-loyalty-widget {
  --rewardspro-primary-color: #4F46E5;
  --rewardspro-background-color: #F9FAFB;
}
```

### JavaScript Events

The widget doesn't emit custom events yet, but you can listen for DOM changes:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const widget = document.querySelector('.rewardspro-loyalty-widget');
  const observer = new MutationObserver(() => {
    console.log('Widget updated');
  });
  observer.observe(widget, { childList: true, subtree: true });
});
```

## Troubleshooting

### Widget Shows "Loading..." Forever

**Causes:**
1. Customer metafield not set
2. Network error fetching data
3. Shop not found in database

**Solutions:**
- Check browser console for errors
- Verify metafield exists: `{{ customer.metafield.rewardspro.customer_id }}`
- Run setup endpoint to populate metafields
- Check API endpoint is accessible: `/api/storefront/loyalty`

### Widget Shows Error Message

**Causes:**
1. Invalid customer ID or shop domain
2. Customer not synced to RewardsPro
3. Database connection issue

**Solutions:**
- Verify customer exists in RewardsPro database
- Check server logs for detailed error messages
- Manually sync customer from admin panel

### Widget Doesn't Display for Logged-In Customer

**Causes:**
1. Theme doesn't have `{{ customer }}` object available
2. Liquid condition preventing render
3. CSS hiding the widget

**Solutions:**
- Check theme template includes customer object
- Verify widget block is added to customer-accessible pages
- Inspect element to check for CSS display: none

### Styling Conflicts with Theme

**Causes:**
1. Theme CSS overriding widget styles
2. Conflicting class names

**Solutions:**
- All widget classes are prefixed with `.rewardspro-`
- Use more specific CSS selectors
- Add `!important` to critical widget styles (use sparingly)

## Performance

### Caching Strategy

- **Client-side cache:** 30 seconds in localStorage
- **Server-side cache:** 30 seconds via Cache-Control header
- **Background refresh:** Widget fetches fresh data in background after showing cached data

### Network Optimization

- **Lazy loading:** Widget script loads with `defer` attribute
- **Minimal payload:** API returns only essential data (~1KB)
- **CDN support:** Static assets served via Shopify CDN
- **HTTP/2:** Multiplexed requests for faster loading

### Best Practices

1. **Placement:** Add widget to account pages, not every page
2. **Above the fold:** Avoid placing widget where it blocks important content
3. **Conditional rendering:** Only show for logged-in customers
4. **Fallback content:** Always provide login prompt for guests

## Security

### Authentication

- Uses customer metafield ID + shop domain verification
- No session tokens required (not available on storefront)
- Shop-scoped database queries prevent cross-shop access

### CORS Protection

- Restricts API access to `*.myshopify.com` domains
- Validates origin header on every request
- Rejects requests from unknown domains

### Data Privacy

- Only exposes customer's own loyalty data
- No sensitive information (email, phone) returned to frontend
- Complies with Shopify's data protection requirements

## Localization

### Adding Translations

Edit `locales/{language}.json`:

```json
{
  "loyalty": {
    "widget": {
      "loading": "Loading your rewards...",
      "error": "Unable to load rewards. Please try again.",
      "login_prompt": "Sign in to view your loyalty rewards",
      "login_button": "Sign In"
    }
  }
}
```

Supported languages:
- English (en.default.json)
- Add more by creating `{language}.json` files

## Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |
| Mobile Safari | 14+ | ✅ Full |
| Chrome Mobile | 90+ | ✅ Full |

**Required APIs:**
- Fetch API
- LocalStorage
- ES6+ JavaScript
- CSS Grid/Flexbox

## Development

### Local Testing

1. Start the app development server:
```bash
npm run dev
```

2. Open theme editor with extension preview:
```bash
shopify theme dev --store=your-dev-store.myshopify.com
```

3. Add the widget block to a test page

4. Use browser dev tools to inspect:
   - Network tab: Check API requests
   - Console: Look for JavaScript errors
   - Application tab: Verify localStorage cache

### Testing Checklist

- [ ] Widget displays correctly for logged-in customers
- [ ] Shows login prompt for guest users
- [ ] All three variants render properly
- [ ] Progress bar calculates correctly
- [ ] Expiring points warning appears when applicable
- [ ] CTA button navigates to correct URL
- [ ] Widget is responsive on mobile
- [ ] Loading state shows initially
- [ ] Error state displays on API failure
- [ ] Cache works (check localStorage)
- [ ] Theme editor preview works
- [ ] Accessible via keyboard navigation
- [ ] Screen reader compatible

## Maintenance

### Monitoring

Check these metrics regularly:
- Widget load time (should be < 1s)
- API error rate (should be < 1%)
- Cache hit rate (should be > 80%)
- Customer feedback on widget utility

### Updates

When updating the widget:
1. Test thoroughly in development
2. Deploy to staging environment
3. Verify in theme editor
4. Deploy to production
5. Monitor for errors in first 24 hours

## Support

### Common Questions

**Q: Can I use this widget on multiple themes?**
A: Yes, theme app extensions work across all themes in your store.

**Q: Does this work with headless Shopify?**
A: Not directly. For headless, use the Storefront API endpoint directly from your frontend.

**Q: Can I customize the widget design?**
A: Yes, edit the CSS file or override styles in your theme's custom CSS.

**Q: Will this slow down my store?**
A: No, the widget loads asynchronously and is optimized for performance.

### Need Help?

- Check the implementation plan: `IMPLEMENTATION_PLAN.md`
- Review server logs for API errors
- Test API endpoint directly in browser
- Contact RewardsPro support for assistance

## Future Enhancements

Planned features for future versions:

- [ ] Multiple widget layouts
- [ ] Animation customization
- [ ] Widget position presets
- [ ] A/B testing support
- [ ] Advanced analytics integration
- [ ] Social proof ("X customers redeemed today")
- [ ] Personalized promotional messages
- [ ] Multi-language auto-detection
- [ ] Dark mode support
- [ ] Widget preview in theme editor with live data

---

**Version:** 1.0.0
**Last Updated:** 2025-10-13
**Minimum Shopify Version:** Shopify Plus or Advanced
