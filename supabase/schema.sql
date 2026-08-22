-- WhatsApp Status Quality Keeper schema
-- Run in Supabase SQL editor after creating a project.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  whatsapp_phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists whatsapp_phone text;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  original_bytes bigint not null,
  output_bytes bigint not null,
  preset text not null,
  codec text not null,
  output_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  recipient_phone text not null,
  status text not null check (status in ('sending', 'sent', 'failed')),
  whatsapp_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.whatsapp_deliveries enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can view own jobs"
  on public.jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own jobs"
  on public.jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own jobs"
  on public.jobs for delete
  using (auth.uid() = user_id);

create policy "Users can view own WhatsApp deliveries"
  on public.whatsapp_deliveries for select
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('processed', 'processed', false)
on conflict (id) do nothing;

create policy "Users can upload own processed files"
  on storage.objects for insert
  with check (
    bucket_id = 'processed'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own processed files"
  on storage.objects for select
  using (
    bucket_id = 'processed'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own processed files"
  on storage.objects for update
  using (
    bucket_id = 'processed'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own processed files"
  on storage.objects for delete
  using (
    bucket_id = 'processed'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
