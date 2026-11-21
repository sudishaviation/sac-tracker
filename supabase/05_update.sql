-- Tuition wording + quick-fill keeps the SAC 2nd instalment unpaid for "visa granted"
update public.fees set label = 'Tuition (total, paid in instalments to HAA)',
  note = 'HAA invoices you directly for each instalment and due date — check your HAA payment portal and your HAA email.'
  where key = 'tuition';
update public.step_templates set title = 'Tuition instalments paid to HAA',
  help = 'Tuition is paid in instalments. HAA invoices you directly for each upcoming payment and due date — check your HAA payment portal; invoices are also emailed to your HAA email address. Your NOCs are needed at your Nepal bank to transfer.'
  where key = 'tuition_transfer';

drop function if exists public.admin_create_student(text,text,text,date,text,int,text,text,text,text,date,date,date);
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
              when p_stage = 'visa_granted' and t.track in ('onboard','visa') and not t.optional and t.key <> 'sac_fee_2' then 'done'
              else 'todo' end,
         case when t.key = 'program_intake' then current_date
              when p_stage = 'studying' and not t.optional then current_date
              when p_stage = 'visa_granted' and t.track in ('onboard','visa') and not t.optional and t.key <> 'sac_fee_2' then current_date
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

