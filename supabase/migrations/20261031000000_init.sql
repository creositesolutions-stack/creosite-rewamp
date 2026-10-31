create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  owner_id uuid references auth.users (id) on delete set null,
  title text not null default 'New conversation',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_status_check check (status in ('active', 'archived', 'deleted'))
);

create index if not exists conversations_visitor_updated_idx
  on public.conversations (visitor_id, updated_at desc);

create index if not exists conversations_owner_updated_idx
  on public.conversations (owner_id, updated_at desc)
  where owner_id is not null;

create index if not exists conversations_updated_at_idx
  on public.conversations (updated_at);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  ui_id text not null,
  role text not null,
  content text not null default '',
  parts jsonb not null default '[]'::jsonb,
  seq bigint generated always as identity,
  created_at timestamptz not null default now(),
  constraint messages_role_check check (role in ('user', 'assistant', 'system')),
  constraint messages_ui_id_length_check check (char_length(ui_id) between 1 and 200)
);

create unique index if not exists messages_conversation_ui_id_key
  on public.messages (conversation_id, ui_id);

create index if not exists messages_conversation_seq_idx
  on public.messages (conversation_id, seq);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row
  execute function public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Owners can read own conversations" on public.conversations;
create policy "Owners can read own conversations"
  on public.conversations
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can insert own conversations" on public.conversations;
create policy "Owners can insert own conversations"
  on public.conversations
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can update own conversations" on public.conversations;
create policy "Owners can update own conversations"
  on public.conversations
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can delete own conversations" on public.conversations;
create policy "Owners can delete own conversations"
  on public.conversations
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can read own messages" on public.messages;
create policy "Owners can read own messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can insert own messages" on public.messages;
create policy "Owners can insert own messages"
  on public.messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can update own messages" on public.messages;
create policy "Owners can update own messages"
  on public.messages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can delete own messages" on public.messages;
create policy "Owners can delete own messages"
  on public.messages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.owner_id = (select auth.uid())
    )
  );

comment on table public.conversations is
  'Creo chat conversations. Anonymous ownership uses visitor_id; authenticated ownership uses owner_id. Server access uses the service role, which bypasses RLS.';
comment on table public.messages is
  'Ordered Creo chat messages. parts stores the AI SDK UIMessage parts; content stores normalized plain text for fallback and title generation.';
