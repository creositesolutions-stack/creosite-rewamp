create extension if not exists pgcrypto;

create table if not exists public.selected_works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  project_url text,
  image_url text not null,
  accent_color text not null default '#6e8dad',
  favourite boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint selected_works_title_length_check check (char_length(title) between 1 and 120),
  constraint selected_works_accent_color_check check (accent_color ~ '^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')
);

create index if not exists selected_works_favourite_sort_idx
  on public.selected_works (favourite, sort_order asc, created_at desc);

create index if not exists selected_works_sort_order_idx
  on public.selected_works (sort_order asc, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists selected_works_set_updated_at on public.selected_works;
create trigger selected_works_set_updated_at
  before update on public.selected_works
  for each row
  execute function public.set_updated_at();

alter table public.selected_works enable row level security;

drop policy if exists "Selected works are publicly readable" on public.selected_works;
create policy "Selected works are publicly readable"
  on public.selected_works
  for select
  to anon, authenticated
  using (true);

grant select on public.selected_works to anon, authenticated;
grant all on public.selected_works to service_role;

comment on table public.selected_works is
  'Portfolio projects. Set favourite to true to feature a project on the home page; image_url holds the public Supabase Storage (or other public) image URL; accent_color is the card hover/touch colour.';
comment on column public.selected_works.accent_color is
  'Hex colour used for the card border, glow and cover tint. Accepts #RGB or #RRGGBB.';
comment on column public.selected_works.favourite is
  'When true, the project is shown in the Selected work section on the home page.';
