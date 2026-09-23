-- Task 015: Meta OAuth — token storage on social_accounts + the member
-- write policies the foundation migration deferred until per-user writes
-- exist (connect upsert / disconnect delete).

alter table public.social_accounts
  add column access_token text,
  add column ig_user_id text,
  add column token_expires_at timestamptz;

comment on column public.social_accounts.access_token is
  'Meta/Instagram long-lived access token — read by apps/api only; never selected into web responses.';
comment on column public.social_accounts.ig_user_id is
  'Instagram API user id from the OAuth profile (Graph calls in Tasks 016+).';

-- Membership-scoped writes (same helper as reads — no using(true), no anon).
create policy "members_insert_social_accounts"
  on public.social_accounts for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "members_update_social_accounts"
  on public.social_accounts for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members_delete_social_accounts"
  on public.social_accounts for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));
