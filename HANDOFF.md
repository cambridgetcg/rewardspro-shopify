# RewardsPro Shopify - Claude Handoff Document

## 🎯 IMPORTANT: Project Purpose

**This version is specifically for Shopify App Store review and approval.**

This is a separate instance from the production codebase, configured and optimized for:
- Shopify's app review requirements
- App Store compliance and guidelines
- Review team testing and evaluation
- Meeting all Shopify Partner Program standards

Any changes made here should prioritize:
- ✅ Shopify best practices and guidelines
- ✅ App Store policy compliance
- ✅ Clean, reviewable code
- ✅ Proper documentation for reviewers
- ✅ Security and privacy standards

## 📍 Project Location
```
/Users/alex/Desktop/rewardspro-shopify
```

## 🚀 Git Repository Information

### Repository Details
- **Remote URL:** `https://github.com/cambridgetcg/rewardspro-shopify.git`
- **Branch:** `main`
- **Status:** Freshly cloned from production codebase

### Verify Git Setup
```bash
cd /Users/alex/Desktop/rewardspro-shopify
git remote -v
git status
git branch
```

### Common Git Commands
```bash
# Check current status
git status

# Create a new branch
git checkout -b feature/your-feature-name

# Stage changes
git add .

# Commit changes
git commit -m "feat: your commit message"

# Push to remote
git push -u origin feature/your-feature-name

# Pull latest changes
git pull origin main

# Check commit history
git log --oneline -10
```

## 📚 Required Reading (In Order)

### 1. Start Here - Main Instructions
```
/Users/alex/Desktop/rewardspro-shopify/CLAUDE.md
```
This is the **primary instructions file**. Read this FIRST. It contains:
- Complete project overview (65% complete)
- Tech stack & architecture
- Security patterns (CRITICAL)
- Implementation workflow
- Database schema
- All routes & endpoints
- Development commands

### 2. Project README
```
/Users/alex/Desktop/rewardspro-shopify/README.md
```

### 3. Documentation Hub
```
/Users/alex/Desktop/rewardspro-shopify/docs/DOCUMENTATION_INDEX.md
```

### 4. Active Tasks & Progress
```
/Users/alex/Desktop/rewardspro-shopify/TODO.md
/Users/alex/Desktop/rewardspro-shopify/PROGRESS.md
/Users/alex/Desktop/rewardspro-shopify/COMPLETED_TASKS.md
```

## 🏗️ Project Quick Facts

### Tech Stack
- **Framework:** Remix v2.16+ with Vite
- **Database:** AWS Aurora Serverless PostgreSQL (Data API ONLY)
- **ORM:** Prisma v6.15+ (schema only, operations via Data API)
- **UI:** Shopify Polaris v12
- **Deployment:** Vercel (serverless)
- **Authentication:** Shopify OAuth + Session Tokens (JWT, 1-min expiry)

### Critical Architecture Details
1. **NO direct database connections** - Uses AWS Aurora Data API exclusively
2. **Custom Prisma adapter** - Located at `app/utils/prisma-data-api-adapter.ts`
3. **Zero persistent connections** - Serverless-first architecture
4. **Build uses placeholder DATABASE_URL:**
   ```
   DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
   ```

## 🔐 Security Requirements (CRITICAL - READ FIRST!)

### MUST-FOLLOW Security Patterns
⚠️ **88% of data breaches are authentication-related!**

1. **Every route MUST authenticate:**
   ```typescript
   const { session } = await authenticate.admin(request);
   if (!session?.shop) throw new Response("Unauthorized", { status: 401 });
   ```

2. **Every database query MUST scope to shop:**
   ```typescript
   const data = await db.customer.findMany({
     where: { shop: session.shop } // NEVER omit this!
   });
   ```

3. **Every webhook MUST verify HMAC:**
   ```typescript
   if (!verifyWebhookHMAC(request, rawBody)) {
     return new Response("Unauthorized", { status: 401 });
   }
   ```

4. **NEVER trust client-supplied shop domain** - Use verified session only
5. **NEVER store tokens client-side** - Server-side encrypted storage only
6. **Session tokens expire in 1 minute** - Refresh frequently

### Security Documentation (MUST READ)
```
/Users/alex/Desktop/rewardspro-shopify/docs/08-security/
```
Especially:
- `07-authentication-security.md`
- `08-shopify-auth-security.md`
- `10-data-exposure-prevention.md`

## 🛠️ Development Setup

### Essential Commands
```bash
# Development server
npm run dev

# Type checking (with placeholder DB)
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx tsc --noEmit

# Build (with placeholder DB)
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npm run build

# Prisma commands
npx prisma generate
npx prisma migrate dev
npx prisma db pull

# Lint
npm run lint
```

### Environment Variables Required
See `/Users/alex/Desktop/rewardspro-shopify/.env.example` for complete list.

Key variables:
- `AURORA_RESOURCE_ARN` - AWS Aurora cluster ARN
- `AURORA_SECRET_ARN` - AWS Secrets Manager ARN
- `AURORA_DATABASE_NAME` - Database name
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_REGION` - AWS region (e.g., eu-north-1)
- `SHOPIFY_API_KEY` - From Shopify Partners
- `SHOPIFY_API_SECRET` - From Shopify Partners
- `SHOPIFY_WEBHOOK_SECRET` - For HMAC verification
- `ENCRYPTION_KEY` - 32-byte base64 for AES-256-GCM
- `SESSION_SECRET` - Random 32-byte secret

## 📋 Implementation Workflow (ALWAYS FOLLOW)

### Before Starting ANY Task

1. **Read Required Documentation** (see CLAUDE.md section: "Implementation Workflow & Required Reading")
   - Database tasks → Read Prisma Schema Design Guide
   - Feature tasks → Read route patterns
   - Security tasks → Read security documentation

2. **Check Existing Code**
   - Review similar implementations
   - Check database schema reference
   - Review TODO.md for context

3. **Plan & Track**
   - Use TodoWrite tool for multi-step tasks
   - Update PROGRESS.md with completion %
   - Move completed work to COMPLETED_TASKS.md

### Code Quality Checklist
- [ ] All Text components have `as` prop (Polaris v12)
- [ ] All queries scoped to authenticated shop
- [ ] HMAC verification on webhooks
- [ ] Input validation with Zod schemas
- [ ] Proper error boundaries
- [ ] No `any` types without justification

## 🎯 Current Project Status

### Completion: ~65%
- ✅ Database & Infrastructure: 100%
- ✅ Authentication: 100%
- ✅ Core Features: 85%
- ✅ Shopify Integration: 75%
- ✅ Customer Portal: 80%
- ✅ Subscription System: 90%
- 🟡 Order Sync: 70%
- 🟡 Analytics: 30%
- 🔴 Email Notifications: 10%

### Active Priorities
See `TODO.md` and `PROGRESS.md` for current sprint tasks.

## 📁 Key Files & Directories

### Configuration
- `shopify.app.toml` - Shopify app configuration
- `vercel.json` - Deployment configuration
- `vite.config.ts` - Build configuration
- `tsconfig.json` - TypeScript configuration

### Core Application
- `app/shopify.server.ts` - Shopify setup
- `app/db.server.ts` - Database client
- `app/root.tsx` - Root layout with CSP

### Critical Utilities
- `app/utils/aurora-data-api.ts` - AWS Aurora client
- `app/utils/prisma-data-api-adapter.ts` - Custom Prisma adapter (32KB)
- `app/utils/session-data-api-adapter.ts` - Session storage
- `app/utils/encryption.ts` - AES-256-GCM encryption
- `app/utils/hmac-verification.ts` - HMAC validation
- `app/utils/jwt-validation.server.ts` - JWT verification

### Database
- `prisma/schema.prisma` - Database schema
- `prisma/migrations/` - Migration history

### Documentation
- `docs/` - Complete documentation library
- `docs/05-reference/prisma-schema-design-guide.md` - Schema patterns
- `docs/05-reference/prisma-schema-reference.md` - Model documentation

## 🎨 UI/UX Patterns

### Polaris v12 Requirements
```typescript
// ALWAYS add 'as' prop to Text components
<Text as="h2" variant="headingMd">Title</Text>

// Use icon prop, not JSX children
<Button icon={RefreshIcon}>Refresh</Button>

// Use Box instead of Card.Section
<Card>
  <Box padding="400">Content</Box>
</Card>
```

### Optimistic UI Pattern
Use `app/hooks/useOptimisticData.ts` for instant feedback with automatic rollback.

## 🚨 Common Pitfalls to Avoid

### Security Mistakes (DO NOT DO THIS!)
```typescript
// ❌ WRONG - No shop scope
const customer = await db.customer.findUnique({ where: { id } });

// ✅ CORRECT
const customer = await db.customer.findFirst({
  where: { id, shop: session.shop }
});

// ❌ WRONG - Trusting client
const shop = request.url.searchParams.get('shop');

// ✅ CORRECT
const { session } = await authenticate.admin(request);
const shop = session.shop;
```

### Build Errors
- Always use placeholder DATABASE_URL for TypeScript checking and builds
- Run `npx prisma generate` after schema changes
- Check for missing 'as' prop on Polaris Text components

## 📞 Getting Help

### Debugging Endpoints
- `/api/health` - Check Data API connection
- `/app/webhook-test-simple` - Test webhook processing
- `/app/graphql-test` - Test Shopify GraphQL

### Documentation Sections
- Setup: `/docs/01-getting-started/`
- Development: `/docs/02-development/`
- Deployment: `/docs/03-deployment/`
- UI Components: `/docs/04-ui-components/`
- Reference: `/docs/05-reference/`
- Troubleshooting: `/docs/06-troubleshooting/`
- Security: `/docs/08-security/`

## ✅ Quick Start Checklist

When starting work in this repository:

1. [ ] Navigate to project: `cd /Users/alex/Desktop/rewardspro-shopify`
2. [ ] Read `CLAUDE.md` completely
3. [ ] Check git status: `git status`
4. [ ] Review active tasks in `TODO.md`
5. [ ] Check current branch: `git branch`
6. [ ] Pull latest changes: `git pull origin main`
7. [ ] Install dependencies: `npm install` (if needed)
8. [ ] Generate Prisma client: `npx prisma generate` (if needed)
9. [ ] Review security documentation in `/docs/08-security/`
10. [ ] Start coding with security patterns in mind!

## 🎯 Remember

- **This is the Shopify review version** - Prioritize compliance and best practices
- **Security is NOT optional** - Follow all security patterns religiously
- **Always scope to shop** - Multi-tenant isolation is critical
- **Use placeholder DATABASE_URL** - For all builds and type checking
- **Read documentation first** - Don't guess, read the guides
- **Track your work** - Use TodoWrite for complex tasks
- **Test thoroughly** - Run type checking and builds before committing
- **Shopify guidelines first** - When in doubt, follow Shopify's recommendations

## 📋 Shopify Review Considerations

When working on this version, ensure:
- All Shopify API usage follows current best practices
- App meets Shopify's performance requirements
- Privacy policy and data handling are clearly documented
- UI/UX follows Shopify Polaris design system strictly
- No hidden fees or unclear pricing
- Proper error handling and user feedback
- Accessible to users with disabilities
- Works correctly in Shopify admin embedded context

---

**Last Updated:** 2025-01-03
**Repository:** https://github.com/cambridgetcg/rewardspro-shopify
**Project Status:** 65% Complete
**Purpose:** Shopify App Store Review & Approval
**Critical Focus:** Shopify Compliance, Security, Multi-tenant Isolation, AWS Aurora Data API
