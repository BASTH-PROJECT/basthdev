-- ======================================================
-- SUPABASE SCHEMA FOR CLERK AUTHENTICATION
-- ======================================================
-- This schema is designed to work with Clerk as the authentication provider
-- Clerk user IDs (format: user_xxxxx) are stored as text fields
-- ======================================================

-- 1. Function: Extract Clerk user_id from JWT
-- The Clerk JWT 'sub' claim contains the user ID (format: user_xxxxx)
create or replace function get_clerk_user_id() 
returns text as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '');
$$ language sql stable;

-- 2. Books table (using text for Clerk user IDs)
create table if not exists public.books (
    id text primary key default gen_random_uuid()::text,
    user_id text not null,
    name text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table public.books enable row level security;

-- Create index for better query performance
create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_updated_at_idx on public.books(updated_at);

-- 3. Transactions table (using text for Clerk user IDs)
create table if not exists public.transactions (
    id text primary key default gen_random_uuid()::text,
    user_id text not null,
    book_id text references public.books(id) on delete cascade,
    type text check (type in ('income','expense')) not null,
    amount numeric not null,
    note text,
    category text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table public.transactions enable row level security;

-- Create indexes for better query performance
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_book_id_idx on public.transactions(book_id);
create index if not exists transactions_updated_at_idx on public.transactions(updated_at);

-- 4. User metadata (sync tracking)
create table if not exists public.user_metadata (
    user_id text primary key,
    initialized boolean default false,
    last_sync timestamptz default now(),
    created_at timestamptz default now()
);
alter table public.user_metadata enable row level security;

-- ==================================
-- RLS POLICIES (using get_clerk_user_id())
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

-- Grant access to authenticated users
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- Set default privileges for future tables
alter default privileges in schema public
grant all on tables to authenticated;

alter default privileges in schema public
grant all on sequences to authenticated;

-- ==================================
-- FUNCTIONS FOR SYNC OPERATIONS
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

-- Grant execute permission
grant execute on function upsert_user_metadata(text) to authenticated;

-- ==================================
-- DELETE ACCOUNT FUNCTION
-- ==================================

-- Function to delete all user data (called from client)
-- This function will be called by authenticated users to delete their own account data
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

-- Grant execute permission to authenticated users
grant execute on function delete_user_data() to authenticated;

-- ==================================
-- NOTES FOR CLERK INTEGRATION
-- ==================================
-- 1. In Clerk Dashboard, create a JWT template named "supabase"
-- 2. Configure the template with your Supabase JWT secret
-- 3. In your React Native app, get tokens with: getToken({ template: 'supabase' })
-- 4. Pass the token to Supabase client via Authorization header
-- 5. Ensure your Clerk user IDs are consistently used throughout the app

-- ==================================
-- DELETE ACCOUNT FLOW
-- ==================================
-- 1. Client calls delete_user_data() function via Supabase RPC
-- 2. Function deletes all Supabase data for the authenticated user
-- 3. Client then calls backend endpoint to delete Clerk user
-- 4. Client purges local SQLite database
-- 5. Client signs out and navigates to auth screen
