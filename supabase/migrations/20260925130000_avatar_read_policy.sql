-- Task 026 follow-up: Supabase Storage executes uploads as
-- `INSERT ... RETURNING *`; without a SELECT policy covering the new row the
-- whole transaction fails with a misleading "new row violates RLS" error
-- (Supabase troubleshooting: storage-error-403-forbidden-new-row-violates-
-- row-level-security-policy-on-upload). Covers upsert (SELECT + UPDATE) and
-- DELETE-returning too. Authenticated only: anonymous listing stays denied —
-- public bucket GETs by URL remain public by bucket design.

create policy "avatar_authenticated_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');
