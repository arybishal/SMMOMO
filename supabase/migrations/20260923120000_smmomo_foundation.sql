-- SMMOMO foundation: multi-tenant workspace → social account → posts → automations.
-- Project inspected first (2026-09-23): public schema empty (all candidate
-- tables PGRST205), no storage buckets, GoTrue healthy — this is the first
-- migration; it creates nothing that already exists.
--
-- Apply (hosted project), from the repo root:
--   npx supabase link --project-ref etwuqthopqrzffdgvhqs   # needs SUPABASE_ACCESS_TOKEN
--   npx supabase db push
-- or paste this file into the dashboard SQL Editor and run it once.
-- Never reset/wipe the project. Record every applied migration here.

-- ---------------------------------------------------------------------------
-- workspaces (tenant root)
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

comment on table public.workspaces is 'Tenant root: every private row hangs off a workspace id.';

-- ---------------------------------------------------------------------------
-- workspace_members (RLS membership source of truth)
-- ---------------------------------------------------------------------------
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- social_accounts (Instagram connection per workspace)
-- ---------------------------------------------------------------------------
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  platform text not null default 'instagram' check (platform = 'instagram'),
  username text not null,
  name text not null default '',
  followers integer not null default 0,
  status text not null default 'connected' check (status in ('connected', 'error')),
  connected_at timestamptz not null default now()
);

create index social_accounts_workspace_id_idx on public.social_accounts (workspace_id);

-- ---------------------------------------------------------------------------
-- posts (Instagram content targeted by automations)
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  media_url text,
  caption text not null default '',
  type text not null check (type in ('IMAGE', 'REEL', 'CAROUSEL')),
  permalink text not null default '',
  comments_count integer not null default 0,
  likes_count integer not null default 0,
  posted_at timestamptz not null
);

create index posts_workspace_id_idx on public.posts (workspace_id);
create index posts_social_account_id_idx on public.posts (social_account_id);

-- ---------------------------------------------------------------------------
-- automations (comment → DM rules bound to a post, per workspace)
-- ---------------------------------------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('active', 'paused', 'draft')),
  keyword text not null,
  private_reply text not null,
  public_reply text,
  matched_count integer not null default 0,
  dm_sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automations_workspace_id_idx on public.automations (workspace_id);
create index automations_post_id_idx on public.automations (post_id);

-- ---------------------------------------------------------------------------
-- RLS: membership-scoped reads only. No `using (true)` policies anywhere.
-- Mutations are intentionally absent: app writes arrive with the backend
-- tasks (service_role bypasses RLS server-side, or member policies are added
-- when per-user writes exist). Anonymous/authenticated-without-membership
-- see zero rows.
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so policies can consult workspace_members without the
-- recursive-RLS problem (policy on a table querying that same table).
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
  );
$$;

-- Only signed-in callers may execute the helper; anon never evaluates it.
revoke execute on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.social_accounts enable row level security;
alter table public.posts enable row level security;
alter table public.automations enable row level security;

create policy "members_read_workspace"
  on public.workspaces for select
  to authenticated
  using (public.is_workspace_member(id));

create policy "members_read_workspace_membership"
  on public.workspace_members for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members_read_social_accounts"
  on public.social_accounts for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members_read_posts"
  on public.posts for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members_read_automations"
  on public.automations for select
  to authenticated
  using (public.is_workspace_member(workspace_id));
