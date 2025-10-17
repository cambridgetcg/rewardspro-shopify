/**
 * Apply Customer Account Block Heartbeat Migration to Aurora Database via Data API
 *
 * This script adds the customerAccountBlockLastHeartbeat field to ShopSettings table
 * to support actual detection of customer account block installation (not just dismissal).
 *
 * Migration: add_customer_account_block_heartbeat
 * Date: 2025-10-17
 */

import { RDSDataClient, ExecuteStatementCommand, BeginTransactionCommand, CommitTransactionCommand, RollbackTransactionCommand } from "@aws-sdk/client-rds-data";
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

async function applyCustomerAccountHeartbeatMigration() {
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

  console.log("🚀 Applying Customer Account Block Heartbeat Migration to Aurora Database\n");
  console.log("Migration: add_customer_account_block_heartbeat");
  console.log("Purpose: Add heartbeat detection for customer account block (not just dismissal)\n");

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
    console.log("  1. Deploy updated application code with heartbeat endpoint");
    console.log("  2. Update customer account block UI extension to send heartbeats");
    console.log("  3. Test detection logic on dashboard\n");

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
  // Step 1: Add customerAccountBlockLastHeartbeat column
  console.log("Step 1: Adding customerAccountBlockLastHeartbeat column to ShopSettings...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `ALTER TABLE "ShopSettings"
          ADD COLUMN IF NOT EXISTS "customerAccountBlockLastHeartbeat" TIMESTAMP`,
    transactionId,
  }));
  console.log("  ✓ customerAccountBlockLastHeartbeat column added");

  // Step 2: Add comment to document the field
  console.log("Step 2: Adding column comment...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `COMMENT ON COLUMN "ShopSettings"."customerAccountBlockLastHeartbeat"
          IS 'Last time customer account block sent heartbeat signal (confirms actual installation)'`,
    transactionId,
  }));
  console.log("  ✓ Comment added");

  // Step 3: Add index for efficient heartbeat queries
  console.log("Step 3: Adding index for heartbeat queries...");
  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `CREATE INDEX IF NOT EXISTS "ShopSettings_customerAccountBlockLastHeartbeat_idx"
          ON "ShopSettings"("customerAccountBlockLastHeartbeat")`,
    transactionId,
  }));
  console.log("  ✓ Index created");

  // Step 4: Record migration in Prisma's tracking table
  console.log("Step 4: Recording migration in _prisma_migrations...");
  const migrationId = crypto.randomBytes(18).toString('hex');
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const migrationName = `${timestamp}_add_customer_account_block_heartbeat`;

  await client.send(new ExecuteStatementCommand({
    resourceArn,
    secretArn,
    database,
    sql: `INSERT INTO "_prisma_migrations"
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (:id, :checksum, NOW(), :name, NULL, NULL, NOW(), 3)`,
    parameters: [
      { name: "id", value: { stringValue: migrationId }},
      { name: "checksum", value: { stringValue: "customer_account_heartbeat_v1" }},
      { name: "name", value: { stringValue: migrationName }},
    ],
    transactionId,
  }));
  console.log(`  ✓ Migration recorded: ${migrationName}`);

  console.log("\n  ✓ All steps completed successfully");
}

// Run the migration
applyCustomerAccountHeartbeatMigration().catch(error => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
