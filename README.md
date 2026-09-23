# RewardsPro Shopify source

New paid subscriptions, trials and paid plan changes are retired. This project has no revenue, acquisition or activity target; understanding alone is sufficient.

Existing subscription records, provider-backed cancellation, callbacks, order handling, refunds and usage settlement remain in place. No balances, agreements or entitlement limits are rewritten by this retirement. Earlier implementation and promotional material remain in Git history.

This standalone repository is not the source of the currently mapped Vercel deployment: `shopify.app.toml` points to `rewardspro-production.vercel.app`, whose Vercel project is linked to `Cambridge-TCG-monorepo/apps/rewardspro` on `main`. Publishing this source does not deploy a separate app.

Run focused checks with `npx vitest run --config vitest.retirement.config.ts`. Build with `npm run build`; that command generates the local Prisma client and does not run database migrations.
