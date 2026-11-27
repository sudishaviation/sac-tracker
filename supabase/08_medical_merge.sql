-- 08: merge the three CAAN medical steps into one short step. No doctor lists in the app (SAC publishes a PDF).
begin;

insert into step_templates (key, partner, track, stage, sort, title, help, actor, needs_verify, optional, fields, fee_key, depends_on, expect_min, expect_max, badge, active)
select 'med_caan', partner, track, stage, 1,
       'CAAN medical (physical, ENT & eye)',
       'Book the 3 CAAN Class 1 medical exams: physical & mental, ENT & hearing, eye & colour vision. SAC will share the latest CAAN doctors list and helps you book.',
       actor, needs_verify, false,
       '[{"k":"state","l":"Status","t":"select","o":["Appointment booked","All 3 done"]},{"k":"date","l":"Date","t":"date"}]'::jsonb,
       null, depends_on, expect_min, expect_max, badge, true
from step_templates where key = 'med_physical'
on conflict do nothing;

-- carry over students who had completed all three old steps
insert into student_steps (student_id, step_key, status, data, done_at, updated_by)
select student_id, 'med_caan', 'done', '{}'::jsonb, max(done_at), 'migration'
from student_steps
where step_key in ('med_physical','med_ent','med_eye') and status = 'done'
group by student_id having count(*) = 3
on conflict do nothing;

-- retire the old steps (kept in the table, hidden from everyone)
update step_templates set active = false where key in ('med_physical','med_ent','med_eye');

commit;

-- 08b: medical = one tick; system notice setting (editable in Admin > Settings > General)
update step_templates set fields = '[{"k":"done","l":"All 3 CAAN medical exams completed","t":"check"}]'::jsonb where key='med_caan';
insert into settings (key, value, label) values
 ('notice', 'The system is being updated until Monday, 30 Nov 2026 and may not work smoothly. If something looks wrong, please message SAC. Thank you for your patience.', 'Notice shown at the top of every student page (leave empty to hide)')
on conflict (key) do nothing;

-- 08c: links (run AFTER the PDF is live in the repo)
update step_templates set help = 'Book the 3 CAAN Class 1 medical exams: physical & mental, ENT & hearing, eye & colour vision. Choose one CAAN-approved doctor from each group. SAC helps you book. [Download the latest doctors list (SAC, updated Nov 2026)](https://track.sudishaviation.com.np/assets/docs/caan-doctors-list.pdf) · [CAAN original list](https://flightsafety.caanepal.gov.np/media/documents/doctor_list_2026_pdf.pdf)' where key='med_caan';
