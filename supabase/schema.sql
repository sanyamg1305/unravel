-- Sukoon: Supabase schema
-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).
-- Requires Supabase Auth (email/password) to already be enabled, which it is by default.

-- ============ Profiles: one per user, holds the KDF salt for client-side encryption ============
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  kdf_salt text not null,
  visit_count int not null default 0,
  last_visit_at timestamptz,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- ============ Entries: The Keepsake Box. ciphertext only, encrypted client-side before insert ============
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  iv text not null,          -- base64 AES-GCM IV, not secret
  ciphertext text not null,  -- base64 ciphertext; Supabase never sees plaintext
  created_at timestamptz not null default now()
);
alter table entries enable row level security;
create policy "read own entries" on entries for select using (auth.uid() = user_id);
create policy "insert own entries" on entries for insert with check (auth.uid() = user_id);
create policy "delete own entries" on entries for delete using (auth.uid() = user_id);

-- ============ Posts: The Shared Couch. Requires moderation approval before public read ============
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users on delete set null,
  body text not null,
  approved boolean not null default false,
  auto_flagged boolean not null default false,
  lights int not null default 0,
  created_at timestamptz not null default now()
);
alter table posts enable row level security;
create policy "read approved posts" on posts for select using (approved = true);
create policy "read own unapproved posts" on posts for select using (auth.uid() = author_id);
create policy "insert own post" on posts for insert with check (auth.uid() = author_id);

-- Anyone (including anonymous) can increment lights on an already-approved post,
-- but cannot touch the body/approved/author fields. Enforced by only exposing
-- this narrow RPC function below, not direct table updates.
create or replace function increment_light(post_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  new_count int;
begin
  update posts set lights = lights + 1 where id = post_id and approved = true
  returning lights into new_count;
  return new_count;
end;
$$;

-- ============ Moderation note ============
-- There is deliberately no public "approve" policy: approving a post requires
-- either the Supabase Table Editor (as the project owner) or a service-role
-- key used from a trusted admin context, never the anon key.
