-- Apply manually to the existing Supabase project before enabling the webhook.
-- No email content, sender, subject, recipient, filenames, or attachment bytes
-- belong in this ledger. Keep terminal rows: deleting them defeats deduplication.
begin;

create table if not exists public.admin_email_forwarding (
  email_id uuid primary key,
  state text not null default 'pending'
    check (state in ('pending', 'sent', 'ignored', 'review_required')),
  lease_token uuid,
  lease_until timestamptz,
  payload_sha256 text check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  first_send_at timestamptz,
  outgoing_email_id uuid,
  last_error_code text check (last_error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((lease_token is null) = (lease_until is null)),
  check (state = 'pending' or lease_token is null),
  check ((payload_sha256 is null) = (first_send_at is null)),
  check ((state = 'sent') = (outgoing_email_id is not null)),
  check (state <> 'sent' or first_send_at is not null)
);

comment on table public.admin_email_forwarding is
  'Private metadata-only inbound forwarding ledger; preserve terminal rows for permanent deduplication.';

alter table public.admin_email_forwarding enable row level security;
revoke all on table public.admin_email_forwarding from public, anon, authenticated, service_role;
grant select on table public.admin_email_forwarding to service_role;

create or replace function public.admin_email_claim(p_email_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  entry public.admin_email_forwarding%rowtype;
  v_now timestamptz;
begin
  if p_email_id is null or p_token is null then
    raise exception 'forwarding_invalid_identity';
  end if;
  insert into public.admin_email_forwarding (email_id) values (p_email_id)
    on conflict (email_id) do nothing;
  select * into entry from public.admin_email_forwarding
    where email_id = p_email_id for update;
  v_now := clock_timestamp();
  if entry.state <> 'pending' then
    return jsonb_build_object('status', entry.state);
  end if;
  if entry.lease_until > v_now then
    return jsonb_build_object('status', 'busy');
  end if;
  -- Resend's send idempotency keys expire after 24 hours. Stop an hour early,
  -- even when delivery outcome is unknown, so a retry cannot become a new send.
  if entry.first_send_at is not null and entry.first_send_at <= v_now - interval '23 hours' then
    update public.admin_email_forwarding set state = 'review_required',
      lease_token = null, lease_until = null,
      last_error_code = 'idempotency_window_expired', updated_at = v_now
      where email_id = p_email_id;
    return jsonb_build_object('status', 'review_required');
  end if;
  update public.admin_email_forwarding set lease_token = p_token,
    lease_until = v_now + interval '2 minutes', updated_at = v_now
    where email_id = p_email_id;
  return jsonb_build_object('status', 'claimed');
end;
$$;

create or replace function public.admin_email_prepare(p_email_id uuid, p_token uuid, p_payload_hash text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  entry public.admin_email_forwarding%rowtype;
  v_now timestamptz;
  failure_code text;
begin
  if p_email_id is null or p_token is null or p_payload_hash is null
    or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'forwarding_invalid_prepare';
  end if;
  select * into entry from public.admin_email_forwarding
    where email_id = p_email_id for update;
  if not found then return jsonb_build_object('status', 'busy'); end if;
  if entry.state <> 'pending' then return jsonb_build_object('status', entry.state); end if;
  v_now := clock_timestamp();
  if entry.lease_token is distinct from p_token or entry.lease_until <= v_now then
    return jsonb_build_object('status', 'busy');
  end if;
  if entry.first_send_at <= v_now - interval '23 hours' then
    failure_code := 'idempotency_window_expired';
  elsif entry.payload_sha256 is not null and entry.payload_sha256 <> p_payload_hash then
    failure_code := 'payload_changed';
  end if;
  if failure_code is not null then
    update public.admin_email_forwarding set state = 'review_required',
      lease_token = null, lease_until = null, last_error_code = failure_code,
      updated_at = v_now where email_id = p_email_id and lease_token = p_token;
    return jsonb_build_object('status', 'review_required');
  end if;
  update public.admin_email_forwarding set payload_sha256 = p_payload_hash,
    first_send_at = coalesce(first_send_at, v_now), updated_at = v_now
    where email_id = p_email_id and lease_token = p_token;
  return jsonb_build_object('status', 'ready');
end;
$$;

create or replace function public.admin_email_finish(
  p_email_id uuid, p_token uuid, p_action text,
  p_outgoing_email_id uuid default null, p_code text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  entry public.admin_email_forwarding%rowtype;
  v_now timestamptz;
begin
  if p_email_id is null or p_token is null or p_action is null
    or p_action not in ('sent', 'retry', 'ignored', 'review_required')
    or (p_action = 'sent' and (p_outgoing_email_id is null or p_code is not null))
    or (p_action <> 'sent' and (p_outgoing_email_id is not null or p_code is null))
    or (p_code is not null and p_code !~ '^[a-z][a-z0-9_]{0,63}$') then
    raise exception 'forwarding_invalid_finish';
  end if;
  select * into entry from public.admin_email_forwarding
    where email_id = p_email_id for update;
  if not found then return jsonb_build_object('status', 'busy'); end if;
  if entry.state <> 'pending' then return jsonb_build_object('status', entry.state); end if;
  v_now := clock_timestamp();
  if entry.lease_token is distinct from p_token or entry.lease_until <= v_now then
    return jsonb_build_object('status', 'busy');
  end if;
  if p_action = 'sent' and entry.first_send_at is null then
    raise exception 'forwarding_send_not_prepared';
  end if;
  update public.admin_email_forwarding set
    state = case when p_action = 'retry' then 'pending' else p_action end,
    outgoing_email_id = p_outgoing_email_id, last_error_code = p_code,
    lease_token = null, lease_until = null, updated_at = v_now
    where email_id = p_email_id and lease_token = p_token;
  return jsonb_build_object('status', case when p_action = 'retry' then 'released' else p_action end);
end;
$$;

revoke all on function public.admin_email_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_email_prepare(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_email_finish(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_email_claim(uuid, uuid) to service_role;
grant execute on function public.admin_email_prepare(uuid, uuid, text) to service_role;
grant execute on function public.admin_email_finish(uuid, uuid, text, uuid, text) to service_role;

commit;
