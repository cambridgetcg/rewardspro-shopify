-- Migration: Add Usage Billing Batch Tracking
-- Date: 2025-10-10
-- Description: Adds lastChargedBatch field to track which usage batch was last charged
--              to prevent double-charging in the usage-based billing system

-- Add the lastChargedBatch column to BillingSubscription table
ALTER TABLE "BillingSubscription"
ADD COLUMN IF NOT EXISTS "lastChargedBatch" INTEGER;

-- Add comment to document the field's purpose
COMMENT ON COLUMN "BillingSubscription"."lastChargedBatch" IS 'Tracks which batch was last charged for usage-based billing. E.g., 1 = first 100 orders, 2 = second 100 orders, etc.';

-- Optional: Set default value to 0 for existing records
UPDATE "BillingSubscription"
SET "lastChargedBatch" = 0
WHERE "lastChargedBatch" IS NULL;
