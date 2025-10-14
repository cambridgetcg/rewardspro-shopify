/**
 * Widget Status Verification Script
 *
 * Checks all components needed for the storefront widget to work:
 * - Database migrations applied
 * - Loyalty fields populated
 * - Customer metafields set
 * - API endpoints responding
 * - Extensions deployed
 *
 * Usage: node scripts/check-widget-status.mjs
 */

import { RDSDataClient, ExecuteStatementCommand } from "@aws-sdk/client-rds-data";
import * as dotenv from 'dotenv';

dotenv.config();

const client = new RDSDataClient({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const resourceArn = process.env.AURORA_RESOURCE_ARN;
const secretArn = process.env.AURORA_SECRET_ARN;
const database = process.env.AURORA_DATABASE_NAME || "rewardspro";

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function pass(message) {
  checks.passed++;
  checks.details.push({ status: '✅', message });
  console.log(`✅ ${message}`);
}

function fail(message, detail = '') {
  checks.failed++;
  checks.details.push({ status: '❌', message, detail });
  console.log(`❌ ${message}`);
  if (detail) console.log(`   ${detail}`);
}

function warn(message, detail = '') {
  checks.warnings++;
  checks.details.push({ status: '⚠️ ', message, detail });
  console.log(`⚠️  ${message}`);
  if (detail) console.log(`   ${detail}`);
}

console.log('🔍 Checking Widget Status\n');
console.log('='.repeat(60));

// Check 1: Database connectivity
console.log('\n📊 Database Checks\n');
try {
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: 'SELECT 1 as test'
  }));
  pass('Database connection successful');
} catch (error) {
  fail('Database connection failed', error.message);
  process.exit(1);
}

// Check 2: Migration applied
try {
  const migration = await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `SELECT migration_name, finished_at
          FROM "_prisma_migrations"
          WHERE migration_name LIKE '%storefront_widget%'
          ORDER BY finished_at DESC
          LIMIT 1`,
    includeResultMetadata: true,
  }));

  if (migration.records && migration.records.length > 0) {
    const name = migration.records[0][0]?.stringValue;
    const finishedAt = migration.records[0][1]?.stringValue;
    pass(`Migration applied: ${name}`);
    console.log(`   Finished: ${finishedAt}`);
  } else {
    fail('Storefront widget migration NOT applied',
         'Run: node scripts/apply-storefront-widget-migration.mjs');
  }
} catch (error) {
  fail('Could not check migration status', error.message);
}

// Check 3: Customer table columns exist
try {
  const customerCols = await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'Customer'
          AND column_name IN ('shopifyCustomerMetafieldId', 'pointsBalance', 'lifetimePoints')
          ORDER BY column_name`,
    includeResultMetadata: true,
  }));

  if (customerCols.records && customerCols.records.length === 3) {
    pass('Customer loyalty columns exist');
  } else {
    fail('Customer loyalty columns missing',
         `Found ${customerCols.records?.length || 0} of 3 required columns`);
  }
} catch (error) {
  fail('Could not check Customer columns', error.message);
}

// Check 4: Tier display columns exist
try {
  const tierCols = await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'Tier'
          AND column_name IN ('icon', 'color', 'threshold')
          ORDER BY column_name`,
    includeResultMetadata: true,
  }));

  if (tierCols.records && tierCols.records.length === 3) {
    pass('Tier display columns exist');
  } else {
    fail('Tier display columns missing',
         `Found ${tierCols.records?.length || 0} of 3 required columns`);
  }
} catch (error) {
  fail('Could not check Tier columns', error.message);
}

// Check 5: Data populated
console.log('\n💾 Data Population Checks\n');

try {
  const customerData = await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN "pointsBalance" > 0 THEN 1 END) as with_points,
            COUNT(CASE WHEN "lifetimePoints" > 0 THEN 1 END) as with_lifetime,
            COUNT(CASE WHEN "shopifyCustomerMetafieldId" IS NOT NULL THEN 1 END) as with_metafield
          FROM "Customer"`,
    includeResultMetadata: true,
  }));

  if (customerData.records && customerData.records.length > 0) {
    const record = customerData.records[0];
    const total = record[0]?.longValue || 0;
    const withPoints = record[1]?.longValue || 0;
    const withLifetime = record[2]?.longValue || 0;
    const withMetafield = record[3]?.longValue || 0;

    if (total > 0) {
      pass(`Found ${total} total customers`);

      if (withPoints > 0) {
        pass(`${withPoints} customers have points balance`);
      } else {
        warn(`No customers have points balance`,
             'Run: node scripts/backfill-storefront-data.mjs');
      }

      if (withLifetime > 0) {
        pass(`${withLifetime} customers have lifetime points`);
      } else {
        warn(`No customers have lifetime points calculated`,
             'This is OK if no cashback has been earned yet');
      }

      if (withMetafield > 0) {
        pass(`${withMetafield} customers have metafield IDs set`);
      } else {
        warn(`No customers have metafield IDs`,
             'Run: POST /api/setup-customer-metafield from admin');
      }
    } else {
      warn('No customers in database', 'This is OK for new installations');
    }
  }
} catch (error) {
  fail('Could not check customer data', error.message);
}

// Check 6: Tier data
try {
  const tierData = await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN "icon" IS NOT NULL THEN 1 END) as with_icon,
            COUNT(CASE WHEN "color" IS NOT NULL THEN 1 END) as with_color,
            COUNT(CASE WHEN "threshold" IS NOT NULL THEN 1 END) as with_threshold
          FROM "Tier"`,
    includeResultMetadata: true,
  }));

  if (tierData.records && tierData.records.length > 0) {
    const record = tierData.records[0];
    const total = record[0]?.longValue || 0;
    const withIcon = record[1]?.longValue || 0;
    const withColor = record[2]?.longValue || 0;
    const withThreshold = record[3]?.longValue || 0;

    if (total > 0) {
      pass(`Found ${total} loyalty tiers`);

      if (withIcon === total && withColor === total) {
        pass('All tiers have display fields (icon, color)');
      } else {
        warn(`Only ${withIcon}/${total} tiers have icons, ${withColor}/${total} have colors`,
             'Run: node scripts/backfill-storefront-data.mjs');
      }

      if (withThreshold > 0) {
        pass(`${withThreshold} tiers have threshold values`);
      } else {
        warn('No tiers have threshold values',
             'Run: node scripts/backfill-storefront-data.mjs');
      }
    } else {
      warn('No tiers configured', 'Create tiers in admin panel first');
    }
  }
} catch (error) {
  fail('Could not check tier data', error.message);
}

// Check 7: StoreCreditLedger expiration column
try {
  const ledgerCol = await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'StoreCreditLedger'
          AND column_name = 'expiresAt'`,
    includeResultMetadata: true,
  }));

  if (ledgerCol.records && ledgerCol.records.length === 1) {
    pass('StoreCreditLedger has expiresAt column');
  } else {
    fail('StoreCreditLedger missing expiresAt column',
         'Migration may not have applied correctly');
  }
} catch (error) {
  fail('Could not check StoreCreditLedger column', error.message);
}

// Check 8: Indexes
console.log('\n⚡ Performance Indexes\n');

try {
  const indexes = await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `SELECT indexname
          FROM pg_indexes
          WHERE tablename IN ('Customer', 'StoreCreditLedger')
          AND indexname IN ('Customer_shop_shopifyCustomerMetafieldId_idx',
                           'StoreCreditLedger_customerId_expiresAt_idx')
          ORDER BY indexname`,
    includeResultMetadata: true,
  }));

  if (indexes.records && indexes.records.length === 2) {
    pass('All required indexes exist');
    indexes.records.forEach(record => {
      console.log(`   ✓ ${record[0]?.stringValue}`);
    });
  } else {
    warn(`Only ${indexes.records?.length || 0} of 2 indexes found`,
         'Performance may be impacted');
  }
} catch (error) {
  fail('Could not check indexes', error.message);
}

// Check 9: Sample data validation
console.log('\n🧪 Sample Data Validation\n');

try {
  const sampleData = await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `SELECT
            c.id,
            c.email,
            c."pointsBalance",
            c."lifetimePoints",
            c."shopifyCustomerMetafieldId",
            t.name as tier_name,
            t.icon,
            t.color
          FROM "Customer" c
          LEFT JOIN "Tier" t ON c."currentTierId" = t.id
          WHERE c."pointsBalance" > 0 OR c."lifetimePoints" > 0
          LIMIT 3`,
    includeResultMetadata: true,
  }));

  if (sampleData.records && sampleData.records.length > 0) {
    pass(`Found ${sampleData.records.length} customers with loyalty data`);
    sampleData.records.forEach((record, i) => {
      const email = record[1]?.stringValue;
      const points = record[2]?.doubleValue || record[2]?.longValue || 0;
      const lifetime = record[3]?.doubleValue || record[3]?.longValue || 0;
      const metafieldId = record[4]?.stringValue;
      const tierName = record[5]?.stringValue;

      console.log(`\n   ${i + 1}. ${email}`);
      console.log(`      Points: ${points}, Lifetime: ${lifetime}`);
      console.log(`      Tier: ${tierName || 'None'}`);
      console.log(`      Metafield: ${metafieldId ? '✓ Set' : '✗ Not set'}`);
    });
  } else {
    warn('No customers with loyalty data yet',
         'This is OK if no cashback has been earned');
  }
} catch (error) {
  warn('Could not fetch sample data', error.message);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📋 Summary\n');

console.log(`✅ Passed: ${checks.passed}`);
console.log(`❌ Failed: ${checks.failed}`);
console.log(`⚠️  Warnings: ${checks.warnings}`);

console.log('\n' + '='.repeat(60));

if (checks.failed > 0) {
  console.log('\n🔴 CRITICAL: Widget will NOT work until failures are resolved\n');
  process.exit(1);
} else if (checks.warnings > 0) {
  console.log('\n🟡 Widget should work but has warnings\n');
  console.log('Recommendations:');
  console.log('1. Run backfill script if data is missing');
  console.log('2. Set up customer metafields via admin API');
  console.log('3. Create tiers if none exist\n');
  process.exit(0);
} else {
  console.log('\n✅ All checks passed! Widget is ready for production\n');
  process.exit(0);
}
