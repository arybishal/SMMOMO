-- Task 016: webhook event storage — comments (inbox source) + deliveries
-- (engine output, table ready for 017–018). Membership-scoped SELECT;
-- writes come from apps/api webhook/engine paths via service_role (API env
-- only — never apps/web), not from the browser session.

-- Instagram media id on posts so webhook comments can join a known post
-- after content import (nullable until posts sync lands).
alter table public.posts
  add column ig_media_id text;

create index posts_ig_media_id_idx on public.posts (ig_media_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  ig_comment_id text not null,
  ig_media_id text,
  username text not null,
  text text not null,
  matched boolean not null default false,
  automation_id uuid references public.automations (id) on delete set null,
  -- Denormalized for CommentEvent.automationName (survives automation rename/delete for display history).
  automation_name text,
  created_at timestamptz not null default now(),
  unique (workspace_id, ig_comment_id)
);

create index comments_workspace_id_idx on public.comments (workspace_id);
create index comments_created_at_idx on public.comments (workspace_id, created_at desc);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  recipient text not null,
  kind text not null check (kind in ('private_dm', 'public_reply')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index deliveries_workspace_id_idx on public.deliveries (workspace_id);
create index deliveries_comment_id_idx on public.deliveries (comment_id);

alter table public.comments enable row level security;
alter table public.deliveries enable row level security;

create policy "members_read_comments"
  on public.comments for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members_read_deliveries"
  on public.deliveries for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

comment on table public.comments is
  'Instagram comment events ingested by webhook (Task 016); matched/automation filled by engine (017+).';
comment on table public.deliveries is
  'Outbound DM/public-reply attempts; rows created by the delivery engine (017–018).';
