-- =====================================================================
-- SAC Admission Tracker (HAA, USA) — v1 database
-- Run this whole file once in Supabase: SQL Editor -> New query -> Run.
-- Then run 02_seed.sql. Safe to re-run on an empty project only.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Reference / settings tables (editable by SAC admin, readable by all)
-- ---------------------------------------------------------------------
create table public.programs (
  id           text primary key,
  partner      text not null default 'HAA',
  category     text not null,                 -- 'Aeroplane CPL' | 'Helicopter CPL'
  name         text not null,
  short_name   text not null,                 -- shown on boarding pass
  tuition_usd  numeric(12,2) not null,
  pofc_usd     numeric(12,2) not null,        -- Proof of Financial Capability (hidden until program chosen)
  active       boolean not null default true,
  sort         int not null default 0
);

create table public.intakes (
  id           serial primary key,
  partner      text not null default 'HAA',
  label        text not null,                 -- 'Mar 2027'
  start_month  date not null,                 -- first day of intake month
  status       text not null,                 -- 'Accepting applications' | 'Opens early Dec' ...
  note         text,                          -- warning / recommendation shown to students
  recommended  boolean not null default false,
  active       boolean not null default true
);

create table public.fees (
  key          text primary key,
  label        text not null,
  amount       numeric(12,2),                 -- null = 'ask SAC for latest'
  currency     text not null,                 -- 'USD' | 'NPR' | 'EUR'
  payee        text not null,
  refundable   boolean not null default false,
  note         text,
  sort         int not null default 0
);

create table public.doctors (
  id           serial primary key,
  grp          text not null check (grp in ('physical','ent','eye')),
  name         text not null,
  address      text,
  phone        text,
  email        text,
  active       boolean not null default true,
  sort         int not null default 0
);

create table public.settings (
  key          text primary key,
  value        text,
  label        text
);

-- The journey. Each row is one tick-box/step. Add rows to add steps;
-- a new partner school later = new rows with a different partner value.
create table public.step_templates (
  key          text primary key,
  partner      text not null default 'HAA',
  track        text not null check (track in ('onboard','visa','departure')),
  stage        int  not null,                 -- waypoint number within the track
  sort         int  not null,
  title        text not null,
  help         text,
  actor        text not null check (actor in ('student','sac','both')),
  needs_verify boolean not null default false,-- student tick stays 'pending' until SAC verifies
  optional     boolean not null default false,
  fields       jsonb not null default '[]',   -- [{k,t,l,o?}] t: check|date|datetime|text|select|doctor
  fee_key      text references public.fees(key),
  depends_on   text,                          -- step whose completion starts the clock
  expect_min   int,                           -- working days
  expect_max   int,
  badge        text,                          -- badge earned when done
  active       boolean not null default true
);

-- ---------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------
create table public.students (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,                 -- e.g. SAC-7K3P9
  pin_hash        text not null,
  parent_token    text unique not null default encode(extensions.gen_random_bytes(18),'hex'),
  full_name       text not null,
  email           text,
  phone           text,
  dob             date,
  program_id      text references public.programs(id),
  intake_id       int  references public.intakes(id),
  lead_source     text check (lead_source in ('Instagram','Facebook','Google Ads','Website','TikTok','Expo','Other')),
  status          text not null default 'active'
                  check (status in ('active','deferred','withdrawn','visa_refused','completed')),
  status_reason   text,
  ack_terms_at    timestamptz,
  ack_consent_at  timestamptz,
  internal_notes  text,                                  -- SAC only
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table public.student_steps (
  student_id  uuid not null references public.students(id) on delete cascade,
  step_key    text not null references public.step_templates(key),
  status      text not null default 'todo' check (status in ('todo','pending','done','na')),
  data        jsonb not null default '{}',
  done_at     date,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (student_id, step_key)
);

create table public.student_sessions (
  token       text primary key,
  student_id  uuid not null references public.students(id) on delete cascade,
  expires_at  timestamptz not null
);

-- Internal: HAA commission ledger (never shown to students or parents)
create table public.commissions (
  student_id   uuid primary key references public.students(id) on delete cascade,
  expected_usd numeric(12,2),
  received_usd numeric(12,2),
  received_on  date,
  quarter      text,
  note         text
);

create table public.admins (
  user_id uuid primary key,
  email   text
);

create table public.activity_log (
  id         bigserial primary key,
  student_id uuid references public.students(id) on delete cascade,
  actor      text,
  action     text,
  detail     jsonb,
  at         timestamptz not null default now()
);

create index on public.student_steps (step_key);
create index on public.activity_log (student_id, at desc);

-- ---------------------------------------------------------------------
-- Security: Row Level Security on every table
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array['programs','intakes','fees','doctors','settings','step_templates',
                           'students','student_steps','student_sessions','commissions','admins','activity_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  -- Reference data is public (no personal data in these tables)
  foreach t in array array['programs','intakes','fees','doctors','settings','step_templates']
  loop
    execute format('create policy public_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
-- students, student_steps, sessions, commissions, admins, activity_log:
-- NO anon access at all. Students and parents only reach data through
-- the functions below, which check the PIN session / parent token.

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public._rand_code(n int) returns text
language plpgsql volatile set search_path = public, extensions as $$
declare alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; b bytea := gen_random_bytes(n); r text := ''; i int;
begin
  for i in 0..n-1 loop
    r := r || substr(alphabet, (get_byte(b,i) % length(alphabet)) + 1, 1);
  end loop;
  return r;
end $$;

create or replace function public._rand_pin() returns text
language sql volatile set search_path = public, extensions as $$
  select lpad(((('x'||encode(gen_random_bytes(4),'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
$$;

-- Builds everything a portal needs. viewer: 'student' | 'parent'
create or replace function public._payload(sid uuid, viewer text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'viewer', viewer,
    'student', (
      select jsonb_strip_nulls(jsonb_build_object(
        'code', s.code, 'full_name', s.full_name, 'status', s.status,
        'status_reason', case when viewer='student' then s.status_reason end,
        'email', case when viewer='student' then s.email end,
        'phone', case when viewer='student' then s.phone end,
        'parent_token', case when viewer='student' then s.parent_token end,
        'ack_terms_at', s.ack_terms_at, 'ack_consent_at', s.ack_consent_at,
        'created_at', s.created_at))
      from students s where s.id = sid),
    'program', (select to_jsonb(p) from programs p join students s on s.program_id = p.id where s.id = sid),
    'intake',  (select to_jsonb(i) from intakes i join students s on s.intake_id = i.id where s.id = sid),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', t.key, 'track', t.track, 'stage', t.stage, 'sort', t.sort, 'title', t.title, 'help', t.help,
        'actor', t.actor, 'needs_verify', t.needs_verify, 'optional', t.optional, 'fields', t.fields,
        'fee_key', t.fee_key, 'depends_on', t.depends_on, 'expect_min', t.expect_min, 'expect_max', t.expect_max,
        'badge', t.badge,
        'status', coalesce(ss.status, 'todo'), 'data', coalesce(ss.data, '{}'::jsonb), 'done_at', ss.done_at)
        order by t.track, t.stage, t.sort)
      from step_templates t
      join students s on s.id = sid
      left join programs p on p.id = s.program_id
      left join student_steps ss on ss.student_id = sid and ss.step_key = t.key
      where t.active and t.partner = coalesce(p.partner, 'HAA')), '[]'::jsonb),
    'fees',    coalesce((select jsonb_agg(to_jsonb(f) order by f.sort) from fees f), '[]'::jsonb),
    'doctors', coalesce((select jsonb_agg(to_jsonb(d) order by d.grp, d.sort) from doctors d where d.active), '[]'::jsonb),
    'intakes', coalesce((select jsonb_agg(to_jsonb(i) order by i.start_month) from intakes i where i.active), '[]'::jsonb),
    'settings', coalesce((select jsonb_object_agg(key, value) from settings), '{}'::jsonb)
  );
$$;

create or replace function public._session_student(p_token text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare sid uuid;
begin
  select student_id into sid from student_sessions where token = p_token and expires_at > now();
  if sid is null then raise exception 'SESSION_EXPIRED'; end if;
  return sid;
end $$;

-- ---------------------------------------------------------------------
-- Student functions (anon can call; each checks PIN / session)
-- ---------------------------------------------------------------------
create or replace function public.student_login(p_code text, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s students; tok text;
begin
  -- Errors are returned (not raised) so the failed-attempt counter is saved.
  select * into s from students where code = upper(trim(p_code));
  if s.id is null then return jsonb_build_object('error', 'INVALID_LOGIN'); end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('error', 'LOCKED');
  end if;
  if s.pin_hash <> crypt(trim(p_pin), s.pin_hash) then
    update students set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
     where id = s.id;
    return jsonb_build_object('error', 'INVALID_LOGIN');
  end if;
  update students set failed_attempts = 0, locked_until = null where id = s.id;
  delete from student_sessions where expires_at < now();
  tok := encode(gen_random_bytes(24), 'hex');
  insert into student_sessions(token, student_id, expires_at) values (tok, s.id, now() + interval '12 hours');
  return jsonb_build_object('token', tok, 'portal', _payload(s.id, 'student'));
end $$;

create or replace function public.student_portal(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return _payload(_session_student(p_token), 'student');
end $$;

create or replace function public.student_logout(p_token text) returns void
language sql volatile security definer set search_path = public as $$
  delete from student_sessions where token = p_token;
$$;

create or replace function public.student_acknowledge(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid := _session_student(p_token);
begin
  update students set ack_terms_at = coalesce(ack_terms_at, now()),
                      ack_consent_at = coalesce(ack_consent_at, now()),
                      last_activity_at = now()
   where id = sid;
  insert into activity_log(student_id, actor, action) values (sid, 'student', 'acknowledged terms and consent');
  return _payload(sid, 'student');
end $$;

create or replace function public.student_update_step(p_token text, p_step text, p_done boolean, p_data jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid := _session_student(p_token);
        t step_templates; cur student_steps; clean jsonb; new_status text; new_done date;
begin
  if (select ack_terms_at from students where id = sid) is null then raise exception 'ACK_REQUIRED'; end if;
  select * into t from step_templates where key = p_step and active;
  if t.key is null or t.actor not in ('student','both') then raise exception 'NOT_ALLOWED'; end if;
  select * into cur from student_steps where student_id = sid and step_key = p_step;
  if cur.status = 'done' and t.needs_verify then raise exception 'ALREADY_VERIFIED'; end if;

  -- keep only fields defined for this step
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into clean
    from jsonb_each(coalesce(p_data, '{}'::jsonb)) e
   where e.key in (select f->>'k' from jsonb_array_elements(t.fields) f);
  clean := coalesce(cur.data, '{}'::jsonb) || clean;

  if p_done then
    new_status := case when t.needs_verify then 'pending' else 'done' end;
    new_done   := coalesce(nullif(clean->>'date','')::date, current_date);
  else
    new_status := 'todo'; new_done := null;
  end if;

  insert into student_steps(student_id, step_key, status, data, done_at, updated_by, updated_at)
  values (sid, p_step, new_status, clean, new_done, 'student', now())
  on conflict (student_id, step_key) do update
     set status = excluded.status, data = excluded.data, done_at = excluded.done_at,
         updated_by = 'student', updated_at = now();

  update students set last_activity_at = now() where id = sid;
  insert into activity_log(student_id, actor, action, detail)
  values (sid, 'student', 'updated ' || p_step, jsonb_build_object('status', new_status));
  return _payload(sid, 'student');
end $$;

-- ---------------------------------------------------------------------
-- Parent / sponsor: read-only by secret link
-- ---------------------------------------------------------------------
create or replace function public.parent_view(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from students where parent_token = p_token and status <> 'withdrawn';
  if sid is null then raise exception 'INVALID_LINK'; end if;
  return _payload(sid, 'parent');
end $$;

-- ---------------------------------------------------------------------
-- Admin functions (SAC staff, logged in through Supabase Auth)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_student(
  p_full_name text, p_email text, p_phone text, p_dob date,
  p_program_id text, p_intake_id int, p_lead_source text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare sid uuid; c text; pin text := _rand_pin(); part text;
begin
  if not is_admin() then raise exception 'NOT_ALLOWED'; end if;
  loop
    c := 'SAC-' || _rand_code(5);
    exit when not exists (select 1 from students where code = c);
  end loop;
  insert into students(code, pin_hash, full_name, email, phone, dob, program_id, intake_id, lead_source)
  values (c, crypt(pin, gen_salt('bf')), p_full_name, nullif(p_email,''), nullif(p_phone,''), p_dob,
          p_program_id, p_intake_id, nullif(p_lead_source,''))
  returning id into sid;

  select coalesce(partner,'HAA') into part from programs where id = p_program_id;
  insert into student_steps(student_id, step_key, status, done_at, updated_by)
  select sid, t.key,
         case when t.key = 'program_intake' then 'done' else 'todo' end,
         case when t.key = 'program_intake' then current_date end, 'sac'
    from step_templates t where t.partner = coalesce(part,'HAA');

  insert into commissions(student_id) values (sid);
  insert into activity_log(student_id, actor, action) values (sid, 'sac', 'student created');
  return jsonb_build_object('id', sid, 'code', c, 'pin', pin,
                            'parent_token', (select parent_token from students where id = sid));
end $$;

create or replace function public.admin_reset_pin(p_student uuid) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare pin text := _rand_pin();
begin
  if not is_admin() then raise exception 'NOT_ALLOWED'; end if;
  update students set pin_hash = crypt(pin, gen_salt('bf')), failed_attempts = 0, locked_until = null
   where id = p_student;
  delete from student_sessions where student_id = p_student;
  insert into activity_log(student_id, actor, action) values (p_student, 'sac', 'PIN reset');
  return pin;
end $$;

create or replace function public.admin_reset_parent_link(p_student uuid) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare tok text := encode(gen_random_bytes(18),'hex');
begin
  if not is_admin() then raise exception 'NOT_ALLOWED'; end if;
  update students set parent_token = tok where id = p_student;
  insert into activity_log(student_id, actor, action) values (p_student, 'sac', 'parent link reset');
  return tok;
end $$;

-- Retention rule: withdrawn students are deleted 12 months after last activity.
create or replace function public.admin_purge_expired() returns int
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'NOT_ALLOWED'; end if;
  delete from students where status = 'withdrawn' and last_activity_at < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end $$;

-- Admin step edits go straight to the table (RLS allows admins);
-- this trigger keeps activity + audit trail.
create or replace function public._touch_student() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.updated_by,'') = 'sac' and tg_op = 'UPDATE' then
    update students set last_activity_at = now() where id = new.student_id;
    insert into activity_log(student_id, actor, action, detail)
    values (new.student_id, 'sac', 'updated ' || new.step_key, jsonb_build_object('status', new.status));
  end if;
  return new;
end $$;
create trigger student_steps_touch after update on public.student_steps
  for each row execute function public._touch_student();

-- ---------------------------------------------------------------------
-- Permissions on functions
-- ---------------------------------------------------------------------
-- Supabase grants every new function to anon/authenticated by default,
-- so take everything away first and give back only what is needed.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.student_login(text,text),
                          public.student_portal(text),
                          public.student_logout(text),
                          public.student_acknowledge(text),
                          public.student_update_step(text,text,boolean,jsonb),
                          public.parent_view(text)
  to anon, authenticated;
grant execute on function public.admin_create_student(text,text,text,date,text,int,text),
                          public.admin_reset_pin(uuid),
                          public.admin_reset_parent_link(uuid),
                          public.admin_purge_expired(),
                          public.is_admin()
  to authenticated;

-- ---------------------------------------------------------------------
-- Permissions on tables (project has "auto-grant API access" switched OFF)
-- ---------------------------------------------------------------------
-- Reference data: anyone may read. Everything else: signed-in admin only
-- (Row Level Security above decides who is really an admin).
revoke all on all tables in schema public from anon, authenticated;
grant select on public.programs, public.intakes, public.fees, public.doctors,
                public.settings, public.step_templates to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.students, public.student_steps, public.student_sessions,
              public.commissions, public.admins, public.activity_log from anon;
grant usage, select on all sequences in schema public to authenticated;
