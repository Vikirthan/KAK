-- Run this in Supabase SQL Editor.
-- This creates a DB-backed student directory for Google login verification.

create table if not exists public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  student_uid text not null,
  name text,
  reg_no text not null,
  phone text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_profiles_email_lower_uidx
  on public.student_profiles (lower(email));

create unique index if not exists student_profiles_student_uid_uidx
  on public.student_profiles (student_uid);

alter table public.student_profiles enable row level security;

-- Allow logged-in users to read only their own student row.
drop policy if exists "student can read own profile" on public.student_profiles;
create policy "student can read own profile"
  on public.student_profiles
  for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Allow logged-in users to create their own student row on first login.
drop policy if exists "student can insert own profile" on public.student_profiles;
create policy "student can insert own profile"
  on public.student_profiles
  for insert
  to authenticated
  with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Allow logged-in users to update their own student row.
drop policy if exists "student can update own profile" on public.student_profiles;
create policy "student can update own profile"
  on public.student_profiles
  for update
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Optional seed rows for initial testing.
-- Replace with real values.
insert into public.student_profiles (email, student_uid, name, reg_no, phone, is_active)
values
  ('vikirthan.student@gmail.com', '123', 'Vikirthan T', '12301234', '9876543210', true),
  ('arun.student@gmail.com', '456', 'Arun Kumar S', '45601234', '9865432101', true),
  ('priya.student@gmail.com', '789', 'Priya Sharma', '78901234', '9754321089', true)
on conflict (student_uid) do update
set
  email = excluded.email,
  name = excluded.name,
  reg_no = excluded.reg_no,
  phone = excluded.phone,
  is_active = excluded.is_active,
  updated_at = now();
