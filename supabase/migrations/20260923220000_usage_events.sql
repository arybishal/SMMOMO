-- Task 019: idempotent usage events (product usage / future billing layer).
-- Distinct from operational rows (comments/deliveries) and analytics counters
-- (automations.*_count). One real user action → one billable event even when
-- Meta retries, webhooks redeliver, or the delivery worker retries.
--
-- Idempotency: unique (workspace_id, event_type, idempotency_key).
-- Keys are deterministic from the authoritative record:
--   comment_*     → comment:{ig_comment_id}
--   *_{sent,failed} → delivery:{delivery_id}
-- Application Prefer: resolution=ignore-duplicates + unique constraint as
-- final protection (23505 treated as already recorded).

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_type text not null check (event_type in (
    'comment_received',
    'comment_matched',
    'private_dm_sent',
    'private_dm_failed',
    'public_reply_sent',
    'public_reply_failed'
  )),
  source text not null check (source in ('webhook', 'engine', 'delivery')),
  reference_type text not null check (reference_type in ('comment', 'delivery')),
  reference_id text not null,
  quantity integer not null default 1 check (quantity > 0),
  -- Minimal: no tokens, no comment/DM body, no personal data beyond ids.
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (workspace_id, event_type, idempotency_key)
);

comment on table public.usage_events is
  'Idempotent product usage events (Task 019); authority for usage/billing metrics. Operational state stays on deliveries/comments; analytics counters stay on automations.';

create index usage_events_workspace_occurred_idx
  on public.usage_events (workspace_id, occurred_at);

create index usage_events_workspace_type_occurred_idx
  on public.usage_events (workspace_id, event_type, occurred_at);

-- Membership-scoped SELECT only (no using (true)). Writes come from API
-- service_role paths (webhook/engine/delivery) — browser never inserts.
alter table public.usage_events enable row level security;

create policy "members_read_usage_events"
  on public.usage_events for select
  to authenticated
  using (public.is_workspace_member(workspace_id));
