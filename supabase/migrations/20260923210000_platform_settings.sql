-- Task 018A: platform-level Meta settings (single row).
-- Not workspace-scoped: App Secret / webhook verify token are deployment-wide.
-- RLS on with NO policies — end-user JWTs get zero rows; only service-role
-- (API server) reads/writes. No `using (true)`.

create table if not exists public.platform_settings (
  id boolean primary key default true,
  meta_app_id text,
  meta_app_secret_encrypted text,
  webhook_verify_token_encrypted text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint platform_settings_single_row check (id)
);

comment on table public.platform_settings is
  'Single-row platform settings (Meta app id/secret, webhook verify token). Encrypted secrets; service-role only.';

alter table public.platform_settings enable row level security;
-- Intentionally no CREATE POLICY: authenticated and anon cannot read or write.
