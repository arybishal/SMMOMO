-- Task 024: idempotent content sync — one row per (workspace, Instagram media).
-- PostgREST upserts use ?on_conflict=workspace_id,ig_media_id, which requires
-- this unique index to infer the arbiter. NULL ig_media_id rows remain distinct
-- (Postgres default), so pre-sync/manual rows are unaffected.
create unique index if not exists posts_workspace_id_ig_media_id_key
  on public.posts (workspace_id, ig_media_id);
