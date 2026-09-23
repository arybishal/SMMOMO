-- Task 018: delivery worker claim/idempotency.
-- status gains 'processing' so a worker can claim queued rows before the
-- Graph call (crash mid-send leaves processing, not stuck queued → no
-- double-send on redelivery). attempts/claimed_at support retry accounting.

alter table public.deliveries
  drop constraint if exists deliveries_status_check;

alter table public.deliveries
  add constraint deliveries_status_check
  check (status in ('queued', 'processing', 'sent', 'delivered', 'failed'));

alter table public.deliveries
  add column if not exists attempts integer not null default 0,
  add column if not exists claimed_at timestamptz;

create index if not exists deliveries_queued_idx
  on public.deliveries (created_at)
  where status = 'queued';

comment on column public.deliveries.attempts is
  'Claim count for the delivery worker (018); max attempts before permanent failed.';
comment on column public.deliveries.claimed_at is
  'Last claim time when status flipped queued → processing.';
