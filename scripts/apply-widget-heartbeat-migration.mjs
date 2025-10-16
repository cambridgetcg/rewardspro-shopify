/**
 * Apply Widget Heartbeat Migration to Aurora Database via Data API
 *
 * This script adds heartbeat tracking fields to ShopSettings table
 * to support widget detection via storefront heartbeat signals.
 *
 * Migration: add_widget_heartbeat_tracking
 * Date: 2025-10-16
 */

import { RDSDataClient, ExecuteStatementCommand, BeginTransactionCommand, CommitTransactionCommand, RollbackTransactionCommand } from "@aws-sdk/client-rds-data";
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

async function applyWidgetHeartbeatMigration() {
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

  console.log("🚀 Applying Widget Heartbeat Migration to Aurora Database\n");
  console.log("Migration: add_widget_heartbeat_tracking");
  console.log("Purpose: Add heartbeat tracking for widget detection\n");

  // Start transaction for atomicity
  console.log("Starting transaction...");
  const { transactionId } = await client.send(new BeginTransactionCommand({
    resourceArn,
    secretArn,
    database,
  }));

  try {
    // Execute migration steps
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
    console.log("  1. Deploy updated widget JavaScript");
    console.log("  2. Deploy updated application code");
    console.log("  3. Test widget heartbeat on storefront");
    console.log("  4. Verify widget detection in dashboard\n");

  } catch (error) {
    // Rollback on any error
    console.error(`\n❌ Migration failed: ${error.message}\n`);
    console.log("Rolling back transaction...");

    await client.send(new RollbackTransactionCommand({
      resourceArn,
      secretArn,
      transactionId,
    }));

    console.error("❌ Transaction rolled back. No changes were made to the database.\n");
    throw error;
  }
}

async function executeMigrationSteps(client, resourceArn, secretArn, database, transactionId) {
  // Step 1: Add widgetLastHeartbeat column
  console.log("Step 1: Adding widgetLastHeartbeat column to ShopSettings...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `ALTER TABLE "ShopSettings"
          ADD COLUMN IF NOT EXISTS "widgetLastHeartbeat" TIMESTAMP(3)`,
    transactionId,
  }));
  console.log("  ✓ widgetLastHeartbeat column added");

  // Step 2: Add widgetIsActive column
  console.log("Step 2: Adding widgetIsActive column to ShopSettings...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `ALTER TABLE "ShopSettings"
          ADD COLUMN IF NOT EXISTS "widgetIsActive" BOOLEAN NOT NULL DEFAULT FALSE`,
    transactionId,
  }));
  console.log("  ✓ widgetIsActive column added");

  // Step 3: Add index for efficient heartbeat queries
  console.log("Step 3: Adding index on widgetLastHeartbeat...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `CREATE INDEX IF NOT EXISTS "ShopSettings_widgetLastHeartbeat_idx"
          ON "ShopSettings"("widgetLastHeartbeat")`,
    transactionId,
  }));
  console.log("  ✓ Index created");

  // Step 4: Add comments to document the fields
  console.log("Step 4: Adding column comments...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `COMMENT ON COLUMN "ShopSettings"."widgetLastHeartbeat"
          IS 'Last time the widget sent a heartbeat signal from the storefront'`,
    transactionId,
  }));
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `COMMENT ON COLUMN "ShopSettings"."widgetIsActive"
          IS 'Whether widget is currently active (heartbeat received within last 5 minutes)'`,
    transactionId,
  }));
  console.log("  ✓ Comments added");

  // Step 5: Record migration in Prisma's tracking table
  console.log("Step 5: Recording migration in _prisma_migrations...");
  const migrationId = crypto.randomBytes(18).toString('hex');
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const migrationName = `${timestamp}_add_widget_heartbeat_tracking`;

  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `INSERT INTO "_prisma_migrations"
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (:id, :checksum, NOW(), :name, NULL, NULL, NOW(), 5)`,
    parameters: [
      { name: "id", value: { stringValue: migrationId }},
      { name: "checksum", value: { stringValue: "widget_heartbeat_tracking_v1" }},
      { name: "name", value: { stringValue: migrationName }},
    ],
    transactionId,
  }));
  console.log(`  ✓ Migration recorded: ${migrationName}`);

  console.log("\n  ✓ All steps completed successfully");
}

// Run the migration
applyWidgetHeartbeatMigration().catch(error => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
