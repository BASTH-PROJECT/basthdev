-- ======================================================
-- MIGRATION: Add deleted column for soft delete support
-- ======================================================
-- Run this in Supabase SQL Editor if you already have tables created
-- This adds the deleted column to existing books and transactions tables
-- ======================================================

-- Add deleted column to books table
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;

-- Add deleted column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;

-- Create indexes for better query performance on deleted column
CREATE INDEX IF NOT EXISTS books_deleted_idx ON public.books(deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS transactions_deleted_idx ON public.transactions(deleted) WHERE deleted = false;

-- Verify the columns were added
SELECT 
    'books' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'books'
  AND column_name = 'deleted'
UNION ALL
SELECT 
    'transactions' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
  AND column_name = 'deleted';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully! deleted column added to books and transactions tables.';
END $$;
