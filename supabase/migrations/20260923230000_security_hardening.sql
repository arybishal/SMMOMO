-- Task 020: security hardening — column-level read on social_accounts
-- + workspace_id immutability triggers on member-updated tables.
--
-- access_token / ig_user_id / token_expires_at must never be readable via
-- the authenticated PostgREST role (API maps explicit columns; delivery
-- worker uses service-role). Members keep SELECT on the public profile
-- columns only.

revoke select on table public.social_accounts from authenticated;
grant select (id, workspace_id, platform, username, name, followers, status, connected_at)
  on public.social_accounts to authenticated;

-- Prevent moving a row into another workspace by flipping workspace_id.
-- Trigger (not RLS WITH CHECK) so OLD.workspace_id is unambiguous.

create or replace function public.prevent_workspace_reassign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot be changed';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_workspace_reassign() from public, anon;
grant execute on function public.prevent_workspace_reassign() to authenticated;

create trigger automations_block_workspace_reassign
  before update on public.automations
  for each row execute function public.prevent_workspace_reassign();

create trigger social_accounts_block_workspace_reassign
  before update on public.social_accounts
  for each row execute function public.prevent_workspace_reassign();
