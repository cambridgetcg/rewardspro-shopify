# Database Migration Scripts

This directory contains Data API-compatible migration scripts for Aurora Serverless.

Following the successful migration pattern documented in `/docs/03-deployment/successful-migration-method-guide.md`, all migrations use:
- **AWS Data API transactions** for atomicity
- **Granular statement execution** for clear error handling
- **Conditional operations** (`IF EXISTS`/`IF NOT EXISTS`) for idempotency
- **Prisma migration tracking** via `_prisma_migrations` table

## Available Migrations

### Add Customer Sync Status Fields

**File:** `migrate-add-customer-sync-fields.ts`
**Migration Name:** `20251009_add_customer_sync_fields`

Adds two new boolean fields to the `ShopSettings` table to track customer sync status:
- `customersInitialSynced` - Has initial customer sync completed?
- `customersSyncInProgress` - Is customer sync currently running?

#### Usage

```bash
# Using npx with ts-node (recommended)
npx ts-node scripts/migrate-add-customer-sync-fields.ts

# Or using tsx
npx tsx scripts/migrate-add-customer-sync-fields.ts
```

#### What it does

**Within a single transaction:**
1. Adds `customersInitialSynced` column (BOOLEAN, NOT NULL, default: false)
2. Adds `customersSyncInProgress` column (BOOLEAN, NOT NULL, default: false)
3. Records migration in `_prisma_migrations` table

**After transaction commits:**
4. Verifies the migration completed successfully
5. Shows sample data from existing shops

#### Expected Output

```
🔄 Starting migration: Add customer sync status fields to ShopSettings
==================================================================

Step 1: Adding customersInitialSynced column...
  ✓ customersInitialSynced column added

Step 2: Adding customersSyncInProgress column...
  ✓ customersSyncInProgress column added

Step 3: Recording migration in _prisma_migrations...
  ✓ Migration recorded

💾 Transaction committed successfully

🔍 Verifying migration...
✅ Migration verified successfully!

Column details:
  - customersInitialSynced: boolean (nullable: NO, default: false)
  - customersSyncInProgress: boolean (nullable: NO, default: false)

📊 Sample ShopSettings records:
Found 3 shop(s):
  - rewardspro-dev.myshopify.com: customersInitialSynced=false, customersSyncInProgress=false

==================================================================
✨ Migration completed successfully!

New fields added:
  • customersInitialSynced (Boolean, default: false)
  • customersSyncInProgress (Boolean, default: false)

These fields track customer sync status after app installation.

📡 Database connection closed
```

## Prerequisites

1. **Environment Variables**: Ensure your `.env` file has Aurora Data API credentials:
   ```env
   AWS_REGION=us-east-1
   DATABASE_SECRET_ARN=arn:aws:secretsmanager:...
   DATABASE_RESOURCE_ARN=arn:aws:rds:...
   DATABASE_NAME=your_database_name
   ```

2. **Dependencies**: Install required packages:
   ```bash
   npm install
   ```

3. **TypeScript**: Scripts use TypeScript and can be run with `ts-node` or `tsx`.

## Troubleshooting

### Error: "Column already exists"

If you see this error, the migration has already been run. The script uses `IF NOT EXISTS` to make it idempotent (safe to run multiple times). The transaction will still commit successfully.

### Error: "Cannot connect to database"

Check your AWS credentials and Data API configuration:
1. Verify `.env` file has correct ARNs
2. Check IAM permissions for Data API access
3. Ensure Aurora cluster is running
4. Verify AWS_REGION is set correctly

### Error: "Permission denied"

Your IAM role needs these permissions:
- `rds-data:ExecuteStatement`
- `rds-data:BatchExecuteStatement`
- `rds-data:BeginTransaction`
- `rds-data:CommitTransaction`
- `rds-data:RollbackTransaction`
- `secretsmanager:GetSecretValue`

### Error: "Signature mismatch"

**Cause:** Malformed AWS credentials (truncated secret key)
**Solution:** Ensure `AWS_SECRET_ACCESS_KEY` is exactly 40 characters and properly copied from AWS

### Transaction Rollback

If any step fails during the migration, the entire transaction is automatically rolled back and no changes are applied to the database. This ensures database consistency. Check the error message to identify which step failed.

## Alternative: Prisma Migrate

If you prefer using Prisma's native migration system:

```bash
# Generate migration from schema changes
npx prisma migrate dev --name add_customer_sync_fields

# Apply migration to production
npx prisma migrate deploy
```

**Note:** Prisma migrate requires a direct database connection and won't work with Data API. Use the custom scripts for Data API environments.

## Writing New Migrations

To create a new migration script:

1. Copy an existing migration script as a template
2. Update the SQL `ALTER TABLE` statements
3. Update the verification queries
4. Test on development environment first
5. Add documentation to this README

Example template:

```typescript
import { createDataAPIPrismaClient } from '../app/utils/prisma-data-api-adapter';
import { getAuroraClient } from '../app/utils/aurora-data-api';
import 'dotenv/config';

const prisma = createDataAPIPrismaClient();
const aurora = getAuroraClient();

async function main() {
  console.log('🔄 Starting migration: Your migration name');

  // Add your ALTER TABLE statements
  await aurora.executeStatement(`
    ALTER TABLE "YourTable"
    ADD COLUMN IF NOT EXISTS "yourColumn" VARCHAR(255);
  `, []);

  // Verify
  console.log('✅ Migration completed!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## Best Practices

Based on the successful migration pattern documented in `/docs/03-deployment/successful-migration-method-guide.md`:

### 1. Transaction Management
- **Always wrap migrations in transactions** using `aurora.executeTransaction()`
- All changes are committed together or rolled back on error
- Ensures database consistency and atomicity

### 2. Granular Statement Execution
- **One logical operation per `execute()` call**
- Breaking complex SQL into individual statements avoids parsing issues
- Each statement can be debugged independently
- Clear error messages for specific operations

### 3. Conditional Operations
- **Use `IF EXISTS` and `IF NOT EXISTS` clauses** for idempotency
- Migration can be safely re-run if needed
- Handles partially applied migrations gracefully

### 4. Migration Tracking
- **Always record migrations** in `_prisma_migrations` table
- Use unique IDs (`crypto.randomBytes(18)`) and checksums
- Use `ON CONFLICT DO NOTHING` to prevent duplicate entries
- Track which migrations have been applied

### 5. Development Workflow
- **Test on development environment first** - Never run untested migrations in production
- Verify each step independently before committing
- Take database snapshot before major migrations
- Document everything - Update this README for each new migration

## Support

For issues with migrations:
1. Check the error message carefully
2. Verify your `.env` configuration
3. Review AWS CloudWatch logs for Data API errors
4. Contact the development team if needed
