-- Daily numbers per Instagram account, for the charts.
-- Meta numbers (followers, reach, interactions...) are copied here once a day by the server, so growth since connecting can be drawn.
-- Our own numbers (comments caught, messages sent...) are computed from existing tables by account_activity().

create table account_stats_daily (
  channel_account_id uuid not null references channel_accounts(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  day date not null,
  followers integer,
  media_count integer,
  reach integer,
  interactions integer,
  likes integer,
  comments integer,
  profile_views integer,
  created_at timestamptz not null default now(),
  primary key (channel_account_id, day)
);
create index on account_stats_daily (org_id, day);
alter table account_stats_daily enable row level security;
-- members read; only the server (service role) writes
create policy account_stats_daily_read on account_stats_daily for select using (is_org_member(org_id));

-- Our own activity per day for one account: comments that fired an automation, messages out/in, new people.
create or replace function account_activity(p_account uuid, p_since date)
returns table (day date, triggers bigint, messages_out bigint, messages_in bigint, new_contacts bigint)
language sql stable security invoker as $$
  with days as (select generate_series(p_since, current_date, interval '1 day')::date as d)
  select d.d,
    (select count(*) from events e join automations a on a.id = e.automation_id
       where a.channel_account_id = p_account and e.type = 'trigger_fired' and e.created_at::date = d.d),
    (select count(*) from messages m where m.channel_account_id = p_account and m.direction = 'out'
       and m.status in ('sent','delivered','read') and m.created_at::date = d.d),
    (select count(*) from messages m where m.channel_account_id = p_account and m.direction = 'in' and m.created_at::date = d.d),
    (select count(*) from contacts c where c.channel_account_id = p_account and c.created_at::date = d.d)
  from days d order by d.d;
$$;
