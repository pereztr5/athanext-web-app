-- Invites page matching the Working Copy (replaces My Clients), plus the week picker for
-- "Book {athlete}" from My Athletes.
--
-- 1. coach_client_referrals gains how the family was invited (email, import, link, admin),
--    when the invite was opened, how often it was resent and an updated_at for the Updated
--    column. email_bounced_at comes from 20261010160000 (kept here with if not exists).
-- 2. Opening an invite link marks it opened (get_referral_invite).
-- 3. get_coach_invites: the coach's invites with the athlete's name and age and, for
--    marketplace clients, when they first booked.
-- 4. coach_fix_invite_email (from 20261010160000) also resets opened and the resend count;
--    the client then resends through add-client-referral, which emails a new token.
-- 5. resend_coach_referral counts resends and stops coaches after 3 on the same address.
-- 6. mark_referral_bounced: for an email provider webhook (service role only).
-- 7. get_roster_book_week: one week of the coach's open 1-on-1s, groups with space and taken
--    times, for the Book dialog's "Pick another time or several".

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

alter table public.coach_client_referrals
  add column if not exists invited_via text,
  add column if not exists opened_at timestamptz,
  add column if not exists email_bounced_at timestamptz,
  add column if not exists resend_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ccr_invited_via') then
    alter table public.coach_client_referrals add constraint ccr_invited_via
      check (invited_via in ('email', 'import', 'link', 'admin'));
  end if;
end;
$$;

update public.coach_client_referrals
   set invited_via = case initiated_by when 'athlete' then 'link' when 'admin' then 'admin' else 'email' end
 where invited_via is null;

update public.coach_client_referrals
   set updated_at = greatest(created_at, coalesce(confirmed_at, created_at));

create or replace function public.ccr_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.invited_via := coalesce(
      new.invited_via,
      case new.initiated_by when 'athlete' then 'link' when 'admin' then 'admin' else 'email' end
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ccr_touch on public.coach_client_referrals;
create trigger ccr_touch
  before insert or update on public.coach_client_referrals
  for each row execute function public.ccr_touch();

-- ---------------------------------------------------------------------------
-- 2. Opening an invite link marks it opened. Same result as before.
-- ---------------------------------------------------------------------------

create or replace function public.get_referral_invite(_token uuid)
returns table (
  coach_id uuid,
  coach_name text,
  coach_slug text,
  client_name text,
  masked_email text,
  state text,
  email_matches boolean,
  is_athlete boolean
)
language plpgsql security definer set search_path = public
volatile
as $$
begin
  update coach_client_referrals r
     set opened_at = now()
   where r.invite_token = _token
     and r.initiated_by <> 'athlete'
     and r.opened_at is null
     and r.status in ('invited', 'pending_confirmation');

  return query
  select
    r.coach_id,
    c.name,
    c.slug,
    r.client_name,
    left(r.client_email, 1) || '***' || substring(r.client_email from position('@' in r.client_email)),
    case
      when r.status = 'declined' then 'used'
      when r.status = 'confirmed' and r.athlete_id is not null then 'used'
      when r.expires_at is not null and r.expires_at < now() then 'expired'
      else 'valid'
    end,
    coalesce(
      (select lower(u.email) from auth.users u where u.id = auth.uid()) = r.client_email,
      false
    ),
    exists (
      select 1 from user_profiles p
       where p.id = auth.uid() and p.athlete_id is not null
    )
  from coach_client_referrals r
  join coaches c on c.id = r.coach_id
  where r.invite_token = _token
    and r.initiated_by <> 'athlete';
end;
$$;

grant execute on function public.get_referral_invite(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The coach's invites. Each row is the referral plus athlete_name, athlete_age and
--    marketplace_since. Link sign-ups the coach declined are left out.
-- ---------------------------------------------------------------------------

create or replace function public.get_coach_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    raise exception 'Only coaches can see their invites' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      to_jsonb(r) || jsonb_build_object(
        'athlete_name', athlete.full_name,
        'athlete_age', case when athlete.date_of_birth is not null
          then extract(year from age(current_date, athlete.date_of_birth))::int end,
        'marketplace_since', case when r.relationship_source = 'platform' and r.athlete_id is not null then (
          select min(booking.created_at)::date from public.coach_slot_bookings as booking
          where booking.coach_id = v_coach and booking.athlete_id = r.athlete_id
        ) end
      )
      order by r.updated_at desc
    )
    from public.coach_client_referrals as r
    left join public.athlete_profiles as athlete on athlete.id = r.athlete_id
    where r.coach_id = v_coach
      and not (r.initiated_by = 'athlete' and r.status = 'declined')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_coach_invites() from public, anon;
grant execute on function public.get_coach_invites() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Fix email (coach_fix_invite_email from 20261010160000): same checks, and a corrected
--    address starts over, so opened and the resend count reset too.
-- ---------------------------------------------------------------------------

create or replace function public.coach_fix_invite_email(p_referral_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_email text := lower(trim(p_email));
begin
  if v_coach is null then
    raise exception 'Only coaches can change invites' using errcode = '42501';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Enter a valid email' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.coach_client_referrals
    where coach_id = v_coach and client_email = v_email and id <> p_referral_id
  ) then
    raise exception 'This email is already a client or invited' using errcode = '23505';
  end if;

  update public.coach_client_referrals
     set client_email = v_email,
         email_bounced_at = null,
         opened_at = null,
         resend_count = 0
   where id = p_referral_id
     and coach_id = v_coach
     and initiated_by <> 'athlete'
     and athlete_id is null
     and status in ('invited', 'pending_confirmation', 'confirmed');
  if not found then
    raise exception 'Invite not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.coach_fix_invite_email(uuid, text) from public, anon;
grant execute on function public.coach_fix_invite_email(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Resend: same as before, plus a count. Coaches can resend 3 times per address.
-- ---------------------------------------------------------------------------

create or replace function public.resend_coach_referral(_referral_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _token uuid := gen_random_uuid();
  _admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
begin
  if not _admin and exists (
    select 1 from coach_client_referrals
     where id = _referral_id and resend_count >= 3
  ) then
    raise exception 'invite_resend_limit';
  end if;

  update coach_client_referrals
     set invite_token = _token,
         expires_at = now() + interval '14 days',
         email_bounced_at = null,
         resend_count = resend_count + 1
   where id = _referral_id
     and initiated_by <> 'athlete'
     and (
       status in ('invited', 'pending_confirmation')
       or (status = 'confirmed' and athlete_id is null)
     )
     and (
       coach_id in (select coach_id from user_profiles where id = auth.uid())
       or _admin
     );
  if not found then
    raise exception 'invite_not_resendable';
  end if;
  return _token;
end;
$$;

revoke all on function public.resend_coach_referral(uuid) from public, anon;
grant execute on function public.resend_coach_referral(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Bounce from the email provider (no webhook calls this yet).
-- ---------------------------------------------------------------------------

create or replace function public.mark_referral_bounced(_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update coach_client_referrals
     set email_bounced_at = now()
   where client_email = lower(trim(_email))
     and initiated_by <> 'athlete'
     and athlete_id is null
     and status in ('invited', 'pending_confirmation', 'confirmed');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_referral_bounced(text) from public, anon, authenticated;
grant execute on function public.mark_referral_bounced(text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. One week for the Book dialog: open 1-on-1s, groups the athlete can join, and taken
--    times (shown disabled). Dates are Eastern, like every occurrence.
-- ---------------------------------------------------------------------------

create or replace function public.get_roster_book_week(p_athlete_id uuid, p_from date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null or p_athlete_id is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', x.id,
      'date', x.occurrence_date,
      'startTime', x.start_time,
      'endTime', x.end_time,
      'price', x.price,
      'place', x.place,
      'kind', x.kind,
      'title', x.title,
      'booked', x.booked,
      'cap', x.cap,
      'takenBy', x.taken_by
    ) order by x.occurrence_date, x.start_time)
    from (
      select
        occ.id,
        occ.occurrence_date,
        occ.start_time,
        occ.end_time,
        occ.price,
        coalesce(occ.place, occ.location) as place,
        case
          when mine.id is not null then 'taken'
          when counts.n >= coalesce(occ.max_bookings_per_slot, 1) then 'taken'
          when occ.session_type = 'group' then 'group'
          when occ.visibility in ('open', 'clients') then 'open'
          else null
        end as kind,
        case when occ.session_type = 'group' then coalesce(occ.session_name, 'Group session') end as title,
        counts.n as booked,
        coalesce(occ.max_bookings_per_slot, 1) as cap,
        case when occ.session_type <> 'group' and counts.n > 0 then (
          select split_part(coalesce(athlete.full_name, 'Athlete'), ' ', 1)
          from public.coach_slot_bookings as booking
          left join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
          where booking.occurrence_id = occ.id
            and booking.status in ('requested', 'pending_payment', 'booked', 'completed')
          order by booking.created_at
          limit 1
        ) end as taken_by
      from public.coach_availability_slot_occurrences as occ
      cross join lateral (
        select count(*)::int as n from public.coach_slot_bookings as booking
        where booking.occurrence_id = occ.id
          and booking.status in ('requested', 'pending_payment', 'booked', 'completed')
      ) as counts
      left join lateral (
        select booking.id from public.coach_slot_bookings as booking
        where booking.occurrence_id = occ.id and booking.athlete_id = p_athlete_id
          and booking.status in ('requested', 'pending_payment', 'booked', 'completed')
        limit 1
      ) as mine on true
      where occ.coach_id = v_coach
        and occ.is_enabled
        and not occ.is_draft
        and occ.occurrence_date between p_from and p_from + 7
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
    ) as x
    where x.kind is not null
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_roster_book_week(uuid, date) from public, anon;
grant execute on function public.get_roster_book_week(uuid, date) to authenticated;


-- My Athletes' open invites use the same "opened" as the Invites page: the family opened the link.
create or replace function public.get_coach_open_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    raise exception 'Only coaches can see their invites' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.sort_rank, r."createdAt" desc)
    from (
      select
        referral.id,
        coalesce(nullif(referral.client_name, ''), account.name, referral.client_email) as parent,
        referral.client_email as email,
        coalesce(nullif(referral.athlete_first_name, ''), split_part(athlete.full_name, ' ', 1)) as athlete,
        extract(year from age(current_date, athlete.date_of_birth))::int as age,
        case
          when referral.initiated_by = 'athlete' then 'approval'
          when referral.email_bounced_at is not null then 'bounced'
          when referral.opened_at is not null or referral.status <> 'invited' then 'opened'
          else 'sent'
        end as status,
        case when referral.initiated_by = 'athlete' then 0 when referral.email_bounced_at is not null then 1 else 2 end as sort_rank,
        referral.created_at as "createdAt"
      from public.coach_client_referrals as referral
      left join public.athlete_profiles as athlete on athlete.id = referral.athlete_id
      left join public.user_profiles as account on account.id = athlete.user_id
      where referral.coach_id = v_coach
        and (
          (referral.initiated_by = 'athlete' and referral.status = 'pending_confirmation')
          or (
            referral.initiated_by <> 'athlete'
            and (referral.status in ('invited', 'pending_confirmation') or (referral.status = 'confirmed' and referral.athlete_id is null))
            and (referral.expires_at is null or referral.expires_at > now())
          )
        )
    ) as r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_coach_open_invites() from public, anon;
grant execute on function public.get_coach_open_invites() to authenticated;
