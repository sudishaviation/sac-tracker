-- Run AFTER you have created your login in Supabase:
-- Authentication -> Users -> Add user -> Create new user (your email + a strong password, tick "Auto Confirm").
-- Replace the email below with the one you used, then Run.

insert into public.admins (user_id, email)
select id, email from auth.users where email = 'sooraj.lama@gmail.com'
on conflict (user_id) do nothing;

-- Check: should return one row
select * from public.admins;
