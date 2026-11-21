-- 06: Pre-Flight Academy step (onboarding). Existing students automatically see it as "to do".
insert into public.step_templates (key, track, stage, sort, title, help, actor, needs_verify, optional, fields)
values ('preflight_academy', 'onboard', 0, 2, 'Read the SAC Pre-Flight Academy (free ground school)',
  'Our free ground-school guide for aspiring pilots — a must-read before you go further. [Open the Pre-Flight Academy](https://sudishaviation.com.np/pre-flight-academy/)',
  'student', false, false,
  '[{"k":"read","t":"check","l":"I have read the Pre-Flight Academy guide"}]')
on conflict (key) do nothing;
