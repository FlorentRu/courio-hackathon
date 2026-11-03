-- Courio's AI helper (Meta hackathon, October 2026): how many AI actions each person has used today.
-- Run once in the Supabase SQL editor. Safe to run again.
--
-- Nobody reads or writes this table directly: the companion-ai server function calls use_ai(), which
-- counts one use and says whether the person is still under today's limit. On purpose there are no
-- grants on the table (Supabase no longer adds them for new tables from 30 October 2026, and none are wanted).

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  uses int not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Counts one AI action for the person signed in. True while they are within 30 actions today (UTC).
create or replace function public.use_ai()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  n int;
begin
  if me is null then return false; end if;
  insert into ai_usage (user_id, day, uses)
  values (me, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set uses = ai_usage.uses + 1
  returning uses into n;
  return n <= 30;
end;
$$;

revoke all on function public.use_ai() from public, anon;
grant execute on function public.use_ai() to authenticated;
