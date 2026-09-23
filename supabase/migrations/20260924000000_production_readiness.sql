-- Task 021: production readiness — IG token column lockdown, workspace-scoped
-- automations→posts FK, unique Instagram connection per workspace.
-- Idempotent: safe to re-run after a partial failure.
--
-- 1) Token columns (access_token / ig_user_id / token_expires_at) are
--    server-only: OAuth upsert + delivery use service-role (apps/api).
--    Members keep DELETE (disconnect) + column SELECT on profile columns
--    (from 20260923230000). No member INSERT/UPDATE on this table.
-- 2) automations.post_id becomes a composite FK to posts(workspace_id, id)
--    so a member cannot point an automation at another tenant's post.
--    ON DELETE CASCADE stays: an automation never exists without its post
--    (product model — UI always binds caption/keyword to a live post;
--    disconnect cascade deletes posts → automations intentionally).
-- 3) One Instagram connection per workspace (platform is already
--    check-constrained to 'instagram').

revoke insert, update on table public.social_accounts from authenticated;

-- Composite FK needs a unique target on (workspace_id, id).
DO $$
BEGIN
  IF NOT EXISTS (
    select 1 from pg_constraint
    where conname = 'posts_workspace_id_id_key'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_workspace_id_id_key unique (workspace_id, id);
  END IF;
END $$;

alter table public.automations
  drop constraint if exists automations_post_id_fkey;

alter table public.automations
  add constraint automations_post_id_fkey
  foreign key (workspace_id, post_id)
  references public.posts (workspace_id, id)
  on delete cascade;

-- One row per (workspace, platform). Callers must dedupe first if needed.
create unique index if not exists social_accounts_workspace_platform_key
  on public.social_accounts (workspace_id, platform);

comment on constraint automations_post_id_fkey on public.automations is
  'Task 021: same-workspace post only; cascade when post (or its IG account) is removed.';

