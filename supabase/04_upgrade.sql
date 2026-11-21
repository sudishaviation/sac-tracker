-- =====================================================================
-- 04_upgrade.sql  —  M-1 visa programs, visa type, existing-student records
-- Safe to run once on the live database (SQL Editor). Existing prices untouched.
-- =====================================================================

-- 1) Programs: visa type
alter table public.programs add column if not exists visa_type text not null default 'F-1'
  check (visa_type in ('F-1','M-1'));

-- 2) Students: visa type + existing-student fields
alter table public.students
  add column if not exists visa_type          text not null default 'F-1' check (visa_type in ('F-1','M-1')),
  add column if not exists haa_student_id     text,
  add column if not exists start_date         date,
  add column if not exists expected_end_date  date,
  add column if not exists consent_recorded_on date;

do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.students'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%visa_refused%'
  loop
    execute format('alter table public.students drop constraint %I', c);
  end loop;
end $$;
alter table public.students add constraint students_status_check
  check (status in ('active','deferred','withdrawn','visa_refused','visa_granted','studying','completed'));

-- 3) Two M-1 programs (Standard price only; CFI intentionally not mentioned)
--    Proof of financial capability = tuition + USD 1,500 x 12 months.
insert into public.programs (id, category, name, short_name, tuition_usd, pofc_usd, sort, visa_type) values
 ('haa-m1-airplane', 'Aeroplane M-1',  'HAA – Airplane Professional Pilot Program (M-1 visa)',  'M-1 AIRPLANE', 65467.50, 83467.50, 7, 'M-1'),
 ('haa-m1-heli',     'Helicopter M-1', 'HAA – Helicopter Professional Pilot Program (M-1 visa)', 'M-1 HELI',     71920.00, 89920.00, 8, 'M-1')
on conflict (id) do nothing;

insert into public.settings (key, value, label) values
 ('m1_note', 'M-1 is a vocational student visa. HAA states it allows up to 12 months of study plus an extension of up to 12 months. An M-1 student cannot change to an F-1 or an employment visa, and there is no CPT or OPT. Ask SAC if you have questions about your visa category.', 'Note shown to M-1 students')
on conflict (key) do nothing;

-- 4) Payload now carries the new student fields
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
        'visa_type', s.visa_type, 'haa_student_id', s.haa_student_id,
        'start_date', s.start_date, 'expected_end_date', s.expected_end_date,
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

-- 5) admin_create_student: visa type + "where are they now?" quick-fill
--    p_stage: 'new' | 'visa_granted' | 'studying'
drop function if exists public.admin_create_student(text,text,text,date,text,int,text);
create or replace function public.admin_create_student(
  p_full_name text, p_email text, p_phone text, p_dob date,
  p_program_id text, p_intake_id int, p_lead_source text,
  p_visa_type text default null, p_stage text default 'new',
  p_haa_student_id text default null, p_start_date date default null,
  p_expected_end date default null, p_consent_on date default null)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare sid uuid; c text; pin text := _rand_pin(); part text; vt text; st text;
begin
  if not is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if p_stage not in ('new','visa_granted','studying') then raise exception 'BAD_STAGE'; end if;
  select coalesce(partner,'HAA'), visa_type into part, vt from programs where id = p_program_id;
  vt := coalesce(nullif(p_visa_type,''), vt, 'F-1');
  st := case p_stage when 'visa_granted' then 'visa_granted' when 'studying' then 'studying' else 'active' end;
  loop
    c := 'SAC-' || _rand_code(5);
    exit when not exists (select 1 from students where code = c);
  end loop;
  insert into students(code, pin_hash, full_name, email, phone, dob, program_id, intake_id, lead_source,
                       visa_type, status, haa_student_id, start_date, expected_end_date, consent_recorded_on)
  values (c, crypt(pin, gen_salt('bf')), p_full_name, nullif(p_email,''), nullif(p_phone,''), p_dob,
          p_program_id, p_intake_id, nullif(p_lead_source,''),
          vt, st, nullif(p_haa_student_id,''), p_start_date, p_expected_end, p_consent_on)
  returning id into sid;

  insert into student_steps(student_id, step_key, status, done_at, updated_by)
  select sid, t.key,
         case when t.key = 'program_intake' then 'done'
              when p_stage = 'studying' and not t.optional then 'done'
              when p_stage = 'visa_granted' and t.track in ('onboard','visa') and not t.optional then 'done'
              else 'todo' end,
         case when t.key = 'program_intake' then current_date
              when p_stage = 'studying' and not t.optional then current_date
              when p_stage = 'visa_granted' and t.track in ('onboard','visa') and not t.optional then current_date
              end, 'sac'
    from step_templates t where t.partner = coalesce(part,'HAA');

  insert into commissions(student_id) values (sid);
  insert into activity_log(student_id, actor, action)
  values (sid, 'sac', case p_stage when 'new' then 'student created' else 'existing student added (' || p_stage || ')' end);
  return jsonb_build_object('id', sid, 'code', c, 'pin', pin,
                            'parent_token', (select parent_token from students where id = sid));
end $$;

revoke execute on function public.admin_create_student(text,text,text,date,text,int,text,text,text,text,date,date,date) from public, anon, authenticated;
grant  execute on function public.admin_create_student(text,text,text,date,text,int,text,text,text,text,date,date,date) to authenticated;

-- 6) Table permissions for the new columns are covered by existing table-level grants.
