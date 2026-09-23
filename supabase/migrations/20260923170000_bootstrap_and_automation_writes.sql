-- Task 014: first-user workspace bootstrap + member write policies for
-- automations. The foundation migration's own comment anticipated this
-- moment: "member policies are added when per-user writes exist".
-- Read policies from 20260923120000 are untouched; still no `using (true)`.
--
-- Apply (hosted project), from the repo root:
--   npx supabase link --project-ref etwuqthopqrzffdgvhqs   # needs SUPABASE_ACCESS_TOKEN
--   npx supabase db push

-- SECURITY DEFINER so bootstrap can insert into workspaces +
-- workspace_members without those tables' read-only RLS getting in the way
-- (definer bypasses RLS; execute is restricted to `authenticated`, and the
-- function only ever touches the caller's own membership — auth.uid()).
-- Idempotent: returns the caller's existing workspace when already a member.
create or replace function public.bootstrap_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ws uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select workspace_id into ws
  from public.workspace_members
  where user_id = uid
  limit 1;

  if ws is not null then
    return ws;
  end if;

  insert into public.workspaces (name)
  values ('My Workspace')
  returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, uid, 'owner');

  return ws;
end;
$$;

revoke execute on function public.bootstrap_workspace() from public, anon;
grant execute on function public.bootstrap_workspace() to authenticated;

comment on function public.bootstrap_workspace() is
  'Task 014: idempotent first-run workspace + owner-membership for auth.uid(); RLS reads unchanged.';

-- ponytail: no advisory lock — two concurrent first requests could create two
-- workspaces for one user (rare, self-healing not implemented). Add
-- pg_advisory_xact_lock(auth.uid()::...) if it ever happens in practice.

-- Members may create and update their own automations (RLS stays the
-- isolation boundary; end-user JWTs only — no service_role in the API).
create policy "members_insert_automations"
  on public.automations for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "members_update_automations"
  on public.automations for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
