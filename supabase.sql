alter table public.entries
  add column if not exists email        text,
  add column if not exists called_at    timestamptz,
  add column if not exists email_status text,
  add column if not exists email_error  text;

alter table public.entries drop constraint if exists entries_email_status_chk;
alter table public.entries add constraint entries_email_status_chk
  check (email_status is null or email_status in ('sending','sent','failed'));

create index if not exists entries_company_status_ticket_idx
  on public.entries (company_id, status, ticket);

create or replace function public.call_next(p_company_id text)
returns setof public.entries
language sql
security definer
set search_path = public
as $$
  with next as (
    select id from public.entries
    where company_id = p_company_id and status = 'waiting'
    order by ticket asc
    limit 1
    for update skip locked
  )
  update public.entries e
     set status = 'called', called_at = now(), email_status = 'sending'
    from next
   where e.id = next.id
  returning e.*;
$$;

revoke all on function public.call_next(text) from public, anon, authenticated;
grant execute on function public.call_next(text) to service_role;

alter table public.entries enable row level security;
revoke select on public.entries from anon, authenticated;
grant  select (id, ticket, company_id, name, status, called_at) on public.entries to anon, authenticated;
