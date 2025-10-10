/**
 * Test Aurora Database Connection via AWS Data API
 *
 * This script verifies that we can connect to the Aurora database
 * and lists all tables in the public schema.
 */

import { RDSDataClient, ExecuteStatementCommand } from "@aws-sdk/client-rds-data";
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  const client = new RDSDataClient({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  console.log("🔌 Testing AWS Data API connection...\n");
  console.log("Configuration:");
  console.log(`  Region: ${process.env.AWS_REGION || "eu-north-1"}`);
  console.log(`  Database: ${process.env.AURORA_DATABASE_NAME || "rewardspro"}`);
  console.log(`  Resource ARN: ${process.env.AURORA_RESOURCE_ARN?.substring(0, 50)}...`);
  console.log();

  try {
    // Test basic query
    const result = await client.send(new ExecuteStatementCommand({
      resourceArn: process.env.AURORA_RESOURCE_ARN,
      secretArn: process.env.AURORA_SECRET_ARN,
      database: process.env.AURORA_DATABASE_NAME || "rewardspro",
      sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      includeResultMetadata: true,
    }));

    console.log("✅ Connection successful!\n");
    console.log("Tables in database:");

    if (result.records && result.records.length > 0) {
      result.records.forEach(record => {
        if (record[0] && record[0].stringValue) {
          console.log(`  - ${record[0].stringValue}`);
        }
      });
      console.log(`\nTotal: ${result.records.length} tables\n`);
    } else {
      console.log("  (No tables found)\n");
    }

    // Check if BillingSubscription table exists
    const billingCheck = await client.send(new ExecuteStatementCommand({
      resourceArn: process.env.AURORA_RESOURCE_ARN,
      secretArn: process.env.AURORA_SECRET_ARN,
      database: process.env.AURORA_DATABASE_NAME || "rewardspro",
      sql: `SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'BillingSubscription'
            ORDER BY ordinal_position`,
      includeResultMetadata: true,
    }));

    if (billingCheck.records && billingCheck.records.length > 0) {
      console.log("BillingSubscription table columns:");
      billingCheck.records.forEach(record => {
        const columnName = record[0]?.stringValue || "unknown";
        const dataType = record[1]?.stringValue || "unknown";
        console.log(`  - ${columnName}: ${dataType}`);
      });
      console.log();

      // Check if lastChargedBatch column exists
      const hasLastChargedBatch = billingCheck.records.some(record =>
        record[0]?.stringValue === "lastChargedBatch"
      );

      if (hasLastChargedBatch) {
        console.log("✅ lastChargedBatch column exists (migration already applied)\n");
      } else {
        console.log("⚠️  lastChargedBatch column NOT found (migration needs to be applied)\n");
      }
    } else {
      console.log("⚠️  BillingSubscription table not found\n");
    }

  } catch (error) {
    console.error("❌ Connection failed!\n");
    console.error("Error details:");
    console.error(`  Message: ${error.message}`);
    console.error(`  Code: ${error.name}\n`);

    if (error.message.includes("Signature")) {
      console.error("💡 Tip: Check that your AWS_SECRET_ACCESS_KEY is exactly 40 characters");
    } else if (error.message.includes("Access")) {
      console.error("💡 Tip: Verify your AWS credentials have RDS Data API permissions");
    } else if (error.message.includes("not found")) {
      console.error("💡 Tip: Check that AURORA_RESOURCE_ARN and AURORA_SECRET_ARN are correct");
    }
    console.error();
  }
}

testConnection();
