-- ======================================================
-- QUICK DEPLOY: Copy and paste this entire file into Supabase SQL Editor
-- ======================================================
-- This is the complete schema for ONI CashApp with delete account support
-- Run this in your Supabase Dashboard → SQL Editor
-- ======================================================

-- 1. Function: Extract Clerk user_id from JWT
create or replace function get_clerk_user_id() 
returns text as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '');
$$ language sql stable;

-- 2. Books table
create table if not exists public.books (
    id text primary key default gen_random_uuid()::text,
    user_id text not null,
    name text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    deleted boolean default false
);

-- Enable RLS
alter table public.books enable row level security;

-- Create indexes
create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_updated_at_idx on public.books(updated_at);

-- 3. Transactions table
create table if not exists public.transactions (
    id text primary key default gen_random_uuid()::text,
    user_id text not null,
    book_id text references public.books(id) on delete cascade,
    type text check (type in ('income','expense')) not null,
    amount numeric not null,
    note text,
    category text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    deleted boolean default false
);

-- Enable RLS
alter table public.transactions enable row level security;

-- Create indexes
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_book_id_idx on public.transactions(book_id);
create index if not exists transactions_updated_at_idx on public.transactions(updated_at);

-- 4. User metadata table
create table if not exists public.user_metadata (
    user_id text primary key,
    initialized boolean default false,
    last_sync timestamptz default now(),
    created_at timestamptz default now()
);

-- Enable RLS
alter table public.user_metadata enable row level security;

-- ==================================
-- RLS POLICIES
-- ==================================

-- Books: Users can only access their own books
drop policy if exists "Users can manage their own books" on public.books;
create policy "Users can manage their own books"
on public.books
for all
using (user_id = get_clerk_user_id())
with check (user_id = get_clerk_user_id());

-- Transactions: Users can only access their own transactions
drop policy if exists "Users can manage their own transactions" on public.transactions;
create policy "Users can manage their own transactions"
on public.transactions
for all
using (user_id = get_clerk_user_id())
with check (user_id = get_clerk_user_id());

-- User metadata: Users can only access their own metadata
drop policy if exists "Users can manage their own metadata" on public.user_metadata;
create policy "Users can manage their own metadata"
on public.user_metadata
for all
using (user_id = get_clerk_user_id())
with check (user_id = get_clerk_user_id());

-- ==================================
-- PERMISSIONS
-- ==================================

grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

alter default privileges in schema public
grant all on tables to authenticated;

alter default privileges in schema public
grant all on sequences to authenticated;

-- ==================================
-- HELPER FUNCTIONS
-- ==================================

-- Function to upsert user metadata
create or replace function upsert_user_metadata(
  p_user_id text
) returns void as $$
begin
  insert into public.user_metadata (user_id, initialized, last_sync)
  values (p_user_id, true, now())
  on conflict (user_id) 
  do update set last_sync = now();
end;
$$ language plpgsql security definer;

grant execute on function upsert_user_metadata(text) to authenticated;

-- ==================================
-- DELETE ACCOUNT FUNCTION
-- ==================================

-- Function to delete all user data (called from client)
create or replace function delete_user_data()
returns json as $$
declare
  v_user_id text;
  v_books_deleted int;
  v_transactions_deleted int;
begin
  -- Get the current user's Clerk ID from JWT
  v_user_id := get_clerk_user_id();
  
  -- Ensure user is authenticated
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  
  -- Delete transactions (will cascade from books, but explicit for counting)
  delete from public.transactions 
  where user_id = v_user_id;
  get diagnostics v_transactions_deleted = row_count;
  
  -- Delete books
  delete from public.books 
  where user_id = v_user_id;
  get diagnostics v_books_deleted = row_count;
  
  -- Delete user metadata
  delete from public.user_metadata 
  where user_id = v_user_id;
  
  -- Return summary
  return json_build_object(
    'success', true,
    'user_id', v_user_id,
    'books_deleted', v_books_deleted,
    'transactions_deleted', v_transactions_deleted,
    'deleted_at', now()
  );
end;
$$ language plpgsql security definer;

grant execute on function delete_user_data() to authenticated;

comment on function delete_user_data() is 'Deletes all data for the authenticated user. Returns JSON with deletion summary.';

-- ==================================
-- VERIFICATION QUERIES
-- ==================================

-- Run these to verify everything is set up correctly:

-- Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('books', 'transactions', 'user_metadata');

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('books', 'transactions', 'user_metadata');

-- Check policies exist
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Check functions exist
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('get_clerk_user_id', 'delete_user_data', 'upsert_user_metadata');

-- ==================================
-- DEPLOYMENT COMPLETE
-- ==================================
-- Next steps:
-- 1. Deploy the Edge Function: supabase functions deploy delete-account
-- 2. Set Clerk secret: supabase secrets set CLERK_SECRET_KEY=your_key
-- 3. Configure Clerk JWT template for Supabase
-- 4. Test the delete flow from your app
-- ==================================
