/**
 * Apply Storefront Widget Fields Migration to AWS Aurora via Data API
 *
 * This script adds the following fields needed for storefront widgets:
 * - Customer: shopifyCustomerMetafieldId, pointsBalance, lifetimePoints
 * - Tier: icon, color, threshold
 * - StoreCreditLedger: expiresAt
 *
 * Usage: node scripts/apply-storefront-widget-migration.mjs
 */

import { RDSDataClient, ExecuteStatementCommand, BeginTransactionCommand, CommitTransactionCommand, RollbackTransactionCommand } from "@aws-sdk/client-rds-data";
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

async function applyStorefrontWidgetMigration() {
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

  console.log("🚀 Applying Storefront Widget Migration to Aurora Database\n");
  console.log(`Database: ${database}`);
  console.log(`Region: ${process.env.AWS_REGION}\n`);

  // Start transaction for atomicity
  console.log("Starting transaction...");
  const { transactionId } = await client.send(new BeginTransactionCommand({
    resourceArn,
    secretArn,
    database,
  }));

  try {
    // Execute migration in logical steps
    await executeMigrationSteps(client, resourceArn, secretArn, database, transactionId);

    // Commit if all successful
    console.log("\n💾 Committing transaction...");
    await client.send(new CommitTransactionCommand({
      resourceArn,
      secretArn,
      transactionId,
    }));

    console.log("✅ Migration completed successfully!\n");
    console.log("Next steps:");
    console.log("1. Run backfill script: node scripts/backfill-storefront-data.mjs");
    console.log("2. Deploy extensions with production URLs");
    console.log("3. Test widgets on development store\n");

  } catch (error) {
    // Rollback on any error
    console.error(`\n❌ Error: ${error.message}\n`);
    console.log("Rolling back transaction...");
    await client.send(new RollbackTransactionCommand({
      resourceArn,
      secretArn,
      transactionId,
    }));
    console.log("Transaction rolled back. No changes were made.\n");
    throw error;
  }
}

async function executeMigrationSteps(client, resourceArn, secretArn, database, transactionId) {

  // Step 1: Add columns to Customer table
  console.log("Step 1: Adding storefront fields to Customer table...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `ALTER TABLE "Customer"
          ADD COLUMN IF NOT EXISTS "shopifyCustomerMetafieldId" VARCHAR(255),
          ADD COLUMN IF NOT EXISTS "pointsBalance" DECIMAL(10,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS "lifetimePoints" DECIMAL(10,2) DEFAULT 0`,
    transactionId,
  }));
  console.log("  ✓ Customer columns added");

  // Step 2: Add columns to Tier table
  console.log("Step 2: Adding display fields to Tier table...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `ALTER TABLE "Tier"
          ADD COLUMN IF NOT EXISTS "icon" VARCHAR(50) DEFAULT '⭐',
          ADD COLUMN IF NOT EXISTS "color" VARCHAR(50) DEFAULT '#FFD700',
          ADD COLUMN IF NOT EXISTS "threshold" INTEGER`,
    transactionId,
  }));
  console.log("  ✓ Tier columns added");

  // Step 3: Add expiresAt column to StoreCreditLedger
  console.log("Step 3: Adding expiration tracking to StoreCreditLedger...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `ALTER TABLE "StoreCreditLedger"
          ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`,
    transactionId,
  }));
  console.log("  ✓ StoreCreditLedger column added");

  // Step 4: Create index on Customer for metafield lookups
  console.log("Step 4: Creating index on Customer(shop, shopifyCustomerMetafieldId)...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `CREATE INDEX IF NOT EXISTS "Customer_shop_shopifyCustomerMetafieldId_idx"
          ON "Customer"("shop", "shopifyCustomerMetafieldId")`,
    transactionId,
  }));
  console.log("  ✓ Customer index created");

  // Step 5: Create index on StoreCreditLedger for expiring points queries
  console.log("Step 5: Creating index on StoreCreditLedger(customerId, expiresAt)...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `CREATE INDEX IF NOT EXISTS "StoreCreditLedger_customerId_expiresAt_idx"
          ON "StoreCreditLedger"("customerId", "expiresAt")`,
    transactionId,
  }));
  console.log("  ✓ StoreCreditLedger index created");

  // Step 6: Record migration in Prisma's tracking table
  console.log("Step 6: Recording migration in _prisma_migrations...");
  const migrationId = crypto.randomBytes(18).toString('hex');
  const migrationName = "20251014000000_add_storefront_widget_fields";
  const checksum = crypto
    .createHash('sha256')
    .update(migrationName)
    .digest('hex')
    .substring(0, 64);

  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `INSERT INTO "_prisma_migrations"
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (:id, :checksum, NOW(), :name, NULL, NULL, NOW(), 5)`,
    parameters: [
      { name: "id", value: { stringValue: migrationId }},
      { name: "checksum", value: { stringValue: checksum }},
      { name: "name", value: { stringValue: migrationName }},
    ],
    transactionId,
  }));
  console.log("  ✓ Migration recorded");
}

// Run the migration
applyStorefrontWidgetMigration().catch(error => {
  console.error("Migration failed:", error);
  process.exit(1);
});
