/**
 * Migration: Add customer sync status fields to ShopSettings
 *
 * Adds two new boolean fields to track customer sync status:
 * - customersInitialSynced: Has initial customer sync completed
 * - customersSyncInProgress: Is customer sync currently running
 *
 * Usage: npx ts-node scripts/migrate-add-customer-sync-fields.ts
 */

import { createDataAPIPrismaClient } from '../app/utils/prisma-data-api-adapter';
import { getAuroraClient } from '../app/utils/aurora-data-api';
import 'dotenv/config';

const prisma = createDataAPIPrismaClient();
const aurora = getAuroraClient();

async function main() {
  console.log('🔄 Starting migration: Add customer sync status fields to ShopSettings');
  console.log('==================================================================\n');

  try {
    // Step 1: Add customersInitialSynced column
    console.log('[1/2] Adding customersInitialSynced column...');
    await aurora.executeStatement(`
      ALTER TABLE "ShopSettings"
      ADD COLUMN IF NOT EXISTS "customersInitialSynced" BOOLEAN NOT NULL DEFAULT false;
    `, []);
    console.log('✅ customersInitialSynced column added\n');

    // Step 2: Add customersSyncInProgress column
    console.log('[2/2] Adding customersSyncInProgress column...');
    await aurora.executeStatement(`
      ALTER TABLE "ShopSettings"
      ADD COLUMN IF NOT EXISTS "customersSyncInProgress" BOOLEAN NOT NULL DEFAULT false;
    `, []);
    console.log('✅ customersSyncInProgress column added\n');

    // Verify the migration
    console.log('🔍 Verifying migration...');
    const result = await aurora.executeStatement(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ShopSettings'
        AND column_name IN ('customersInitialSynced', 'customersSyncInProgress')
      ORDER BY column_name;
    `, []);

    if (result.records.length === 2) {
      console.log('✅ Migration verified successfully!\n');
      console.log('Column details:');
      result.records.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
      });
    } else {
      console.warn('⚠️  Warning: Expected 2 columns but found', result.records.length);
    }

    // Show sample data
    console.log('\n📊 Sample ShopSettings records:');
    const shops = await prisma.shopSettings.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });

    if (shops.length > 0) {
      console.log(`Found ${shops.length} shop(s):`);
      shops.forEach((shop: any) => {
        console.log(`  - ${shop.shop}: customersInitialSynced=${shop.customersInitialSynced}, customersSyncInProgress=${shop.customersSyncInProgress}`);
      });
    } else {
      console.log('  No shops found in database');
    }

    console.log('\n==================================================================');
    console.log('✨ Migration completed successfully!');
    console.log('\nNew fields added:');
    console.log('  • customersInitialSynced (Boolean, default: false)');
    console.log('  • customersSyncInProgress (Boolean, default: false)');
    console.log('\nThese fields track customer sync status after app installation.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('\n📡 Database connection closed');
  });
