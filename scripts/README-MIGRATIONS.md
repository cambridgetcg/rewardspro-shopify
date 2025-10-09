# Database Migration Scripts

This directory contains Data API-compatible migration scripts for Aurora Serverless.

## Available Migrations

### Add Customer Sync Status Fields

**File:** `migrate-add-customer-sync-fields.ts`

Adds two new boolean fields to the `ShopSettings` table to track customer sync status:
- `customersInitialSynced` - Has initial customer sync completed?
- `customersSyncInProgress` - Is customer sync currently running?

#### Usage

```bash
# Using npx (recommended)
npx ts-node scripts/migrate-add-customer-sync-fields.ts

# Or using tsx
npx tsx scripts/migrate-add-customer-sync-fields.ts
```

#### What it does

1. Adds `customersInitialSynced` column (BOOLEAN, default: false)
2. Adds `customersSyncInProgress` column (BOOLEAN, default: false)
3. Verifies the migration completed successfully
4. Shows sample data from existing shops

#### Expected Output

```
🔄 Starting migration: Add customer sync status fields to ShopSettings
==================================================================

[1/2] Adding customersInitialSynced column...
✅ customersInitialSynced column added

[2/2] Adding customersSyncInProgress column...
✅ customersSyncInProgress column added

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

If you see this error, the migration has already been run. The script uses `IF NOT EXISTS` to make it idempotent (safe to run multiple times).

### Error: "Cannot connect to database"

Check your AWS credentials and Data API configuration:
1. Verify `.env` file has correct ARNs
2. Check IAM permissions for Data API access
3. Ensure Aurora cluster is running

### Error: "Permission denied"

Your IAM role needs these permissions:
- `rds-data:ExecuteStatement`
- `rds-data:BatchExecuteStatement`
- `secretsmanager:GetSecretValue`

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

1. **Always use `IF NOT EXISTS`** - Makes migrations idempotent
2. **Verify after each change** - Query `information_schema` to confirm
3. **Test on dev first** - Never run untested migrations in production
4. **Add defaults** - Use `DEFAULT` values for non-nullable columns
5. **Document everything** - Update this README for each new migration
6. **Backup first** - Take a database snapshot before major migrations

## Support

For issues with migrations:
1. Check the error message carefully
2. Verify your `.env` configuration
3. Review AWS CloudWatch logs for Data API errors
4. Contact the development team if needed
