begin;

-- Wishwheel isolated storage. Apply only to the approved target project.
-- No browser role can select these rows or execute these functions.
create table if not exists public.wishwheel_rooms (
  code text primary key check (code ~ '^[A-Z2-9]{6}$'),
  owner_hash text not null unique,
  state jsonb not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wishwheel_rooms enable row level security;
revoke all on public.wishwheel_rooms from public, anon, authenticated;
grant select, insert, update on public.wishwheel_rooms to service_role;

create table if not exists public.wishwheel_limits (
  bucket text primary key,
  hits integer not null default 1,
  expires_at timestamptz not null
);
alter table public.wishwheel_limits enable row level security;
revoke all on public.wishwheel_limits from public, anon, authenticated;
grant select, insert, update, delete on public.wishwheel_limits to service_role;

-- SECURITY INVOKER: only service_role has underlying table access.
create or replace function public.wishwheel_cas(p_code text, p_revision bigint, p_state jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.wishwheel_rooms set state=p_state, revision=revision+1, updated_at=now()
    where code=p_code and revision=p_revision;
  return found;
end;
$$;
revoke all on function public.wishwheel_cas(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.wishwheel_cas(text,bigint,jsonb) to service_role;

create or replace function public.wishwheel_rate_limit(p_bucket text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_hits integer;
begin
  if p_limit < 1 or p_seconds < 1 then return false; end if;
  -- Bounded cleanup prevents unbounded accumulation without expensive full scans.
  delete from public.wishwheel_limits where bucket in
    (select bucket from public.wishwheel_limits where expires_at < now() limit 20);
  insert into public.wishwheel_limits(bucket,hits,expires_at)
    values(p_bucket,1,now()+make_interval(secs=>p_seconds))
    on conflict(bucket) do update set
      hits=case when wishwheel_limits.expires_at < now() then 1 else wishwheel_limits.hits+1 end,
      expires_at=case when wishwheel_limits.expires_at < now() then now()+make_interval(secs=>p_seconds) else wishwheel_limits.expires_at end
    returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.wishwheel_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.wishwheel_rate_limit(text,integer,integer) to service_role;
create index if not exists wishwheel_limits_expiry on public.wishwheel_limits(expires_at);

commit;
