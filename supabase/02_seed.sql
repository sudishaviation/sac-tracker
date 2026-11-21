-- =====================================================================
-- SAC Admission Tracker — starting data (as of 21 Nov 2026)
-- Everything here can be edited later from the Admin > Settings screen.
-- =====================================================================

insert into public.programs (id, category, name, short_name, tuition_usd, pofc_usd, sort) values
 ('haa-ppp',        'Aeroplane CPL',  'HAA – Professional Pilot Program',                       'PPP',          68702, 104342, 1),
 ('haa-ppp-cfii',   'Aeroplane CPL',  'HAA – Professional Pilot Program with CFII/MEI',         'PPP+CFII/MEI', 82421, 118061, 2),
 ('haa-faa-easa',   'Aeroplane CPL',  'HAA – Joint FAA/EASA Training Pathway',                  'FAA/EASA',    102754, 146489, 3),
 ('haa-heli',       'Helicopter CPL', 'HAA – Helicopter Professional Pilot Program',            'HELI PPP',     87175, 120275, 4),
 ('haa-heli-cfii',  'Helicopter CPL', 'HAA – Helicopter Professional Pilot Program with CFII',  'HELI+CFII',    91365, 124465, 5),
 ('haa-heli-easa',  'Helicopter CPL', 'HAA – Helicopter Professional Pilot Program – FAA/EASA', 'HELI FAA/EASA',96450, 142245, 6);

insert into public.intakes (label, start_month, status, note, recommended) values
 ('Jan 2027','2027-01-01','Accepting applications','Very tight for Nepali students because of US visa interview slot availability. We recommend the March 2027 intake.', false),
 ('Feb 2027','2027-02-01','Accepting applications','Tight for Nepali students because of US visa interview slot availability. We recommend the March 2027 intake.', false),
 ('Mar 2027','2027-03-01','Accepting applications (flight programs)','Recommended intake for Nepali students.', true),
 ('May 2027','2027-05-01','Application window opens early December', null, false),
 ('Jun 2027','2027-06-01','Application window opens early January', null, false),
 ('Jul 2027','2027-07-01','Application window opens early February', null, false),
 ('Aug 2027','2027-08-01','Application window opens early March', null, false),
 ('Sep 2027','2027-09-01','Application window opens early April', null, false),
 ('Oct 2027','2027-10-01','Application window opens early May', null, false),
 ('Nov 2027','2027-11-01','Application window opens early June', null, false),
 ('Jan 2028','2028-01-01','Application window opens early August', null, false);

insert into public.fees (key, label, amount, currency, payee, refundable, note, sort) values
 ('sac_fee_1',        'SAC service fee – 1st instalment', 30000,  'NPR', 'Sudisha Aviation Consultant', false, 'Paid when you start. Non-refundable. Valid 12 months if you defer.', 1),
 ('haa_app',          'HAA application fee',              50,     'USD', 'Hillsboro Aero Academy',      false, 'Paid with the online HAA application.', 2),
 ('haa_registration', 'HAA student registration fee',     100,    'USD', 'Hillsboro Aero Academy',      true,  'Refundable by HAA (to the paying account) if you do not proceed. SAC is not involved in refunds.', 3),
 ('haa_processing',   'HAA international application processing fee', 300, 'USD', 'Hillsboro Aero Academy', false, null, 4),
 ('sevis',            'SEVIS I-901 fee',                  350,    'USD', 'US Government (SEVP)',        false, 'Paid directly on the US government website.', 5),
 ('tsa',              'TSA flight training security fee', 140,    'USD', 'US Government (TSA)',         false, 'Paid directly on the TSA website.', 6),
 ('visa',             'US student visa (MRV) fee',        null,   'USD', 'US Government',               false, 'Ask SAC for the latest fee before paying.', 7),
 ('sac_fee_2',        'SAC service fee – 2nd instalment', 20000,  'NPR', 'Sudisha Aviation Consultant', false, 'Due only after your visa is granted.', 8),
 ('medical',          'CAAN Class 1 medical (3 doctors)', null,   'NPR', 'CAAN-approved medical examiners', false, 'Typically NPR 8,000–15,000 in total.', 9),
 ('caan_noc',         'CAAN NOC fee (USD 125 + 13% VAT)', 141.25, 'USD', 'CAAN (FSSD)',                 false, 'Deposited at Rastriya Banijya Bank, account "FSSD, CAAN". Confirm the exact NPR amount with CAAN FSSD before depositing.', 10),
 ('moest_noc',        'Ministry of Education (MoEST) NOC',2000,   'NPR', 'MoEST',                       false, 'Per application, via noc.moest.gov.np', 11),
 ('compass',          'COMPASS test at CAAN (EUR 100 + 13% VAT)', 113, 'EUR', 'CAAN (FSSD)',          false, 'Confirm the NPR amount and slot with CAAN FSSD (licensing@caanepal.gov.np, +977-1-4111075) before depositing.', 12),
 ('tuition',          'Tuition (transfer to HAA)',        null,   'USD', 'Hillsboro Aero Academy',      false, 'Amount per your program. Needs both NOCs to transfer from a Nepal bank.', 13);

insert into public.settings (key, value, label) values
 ('contact_email',  'sudishaviation@gmail.com', 'SAC contact email'),
 ('contact_phone',  '',                          'SAC contact phone / WhatsApp'),
 ('sac_bank_info',  'Ask SAC for our bank details before you transfer.', 'How to pay SAC (shown to students)'),
 ('social_whatsapp','https://whatsapp.com/channel/0029VbD2RuNFXUubPsLByG3Y', 'WhatsApp Channel'),
 ('social_instagram','https://www.instagram.com/sudishaviation/', 'Instagram'),
 ('social_facebook','https://www.facebook.com/sudishaviation', 'Facebook'),
 ('social_youtube', 'https://www.youtube.com/@sudishaviation', 'YouTube'),
 ('social_linkedin','https://www.linkedin.com/company/sudishaviation/', 'LinkedIn'),
 ('haa_intakes_url','https://flyhaa.com/apply/', 'HAA intakes page'),
 ('haa_application_url','https://haa-web.scansoftware.com/cafeweb/tapestry?page=International%20Application', 'HAA online application'),
 ('moest_noc_url',  'https://noc.moest.gov.np/', 'MoEST NOC portal'),
 ('caan_fssd',      'CAAN Flight Safety Standards Department, Sinamangal, Kathmandu · licensing@caanepal.gov.np · +977-1-4111075', 'CAAN FSSD contact');

-- CAAN medical examiners (CAAN FSSD list). Students should confirm the latest list with CAAN or SAC.
insert into public.doctors (grp, name, address, phone, email, sort) values
 ('physical','Dr. Sanjaya Karki','Mediciti Hospital, Bhaisepati, Lalitpur','9841191796','drsanjaya.karki@yahoo.com',1),
 ('physical','Dr. Manen P. Gorkhaly','Baluwatar, between Pabitra Chowk and IOM office, next to NIC Asia Bank, Thir Bom Road','01-4531197, 9851051436','mpgorkhaly@gmail.com',2),
 ('physical','Dr. Sanjeeb Tiwari','Vigour Polyclinic, Maharajgunj','9851167722','stiwari369@hotmail.com',3),
 ('physical','Dr. Pankaj Pant','Venus Hospital, Mid Baneshwor & Healthy Heart Clinic, Gatthaghar','9851110939','drpant2015@gmail.com',4),
 ('physical','Dr. Lochan Karki','Himal Hospital, Gyaneshwor','9851056689','drlochankarki@gmail.com',5),
 ('physical','Dr. Bishwa Raj Dawadi','Grande International Hospital, Tokha Road','9841226322','bishwadawadi@gmail.com',6),
 ('ent','Dr. Rakesh Pd. Shrivastav','Tanka Prasad Ghumti Sadak, Babar Mahal, Kathmandu','4262487, 4262555, 9851024444 · Clinic 5363701','rakesh2019@gmail.com',1),
 ('ent','Dr. Meera Bista','Bharosa Hospital, New Baneshwor (opp. White House College)','4489891, 9841256711','meerabista@hotmail.com',2),
 ('ent','Dr. Toran Bdr. KC','Nepal Mediciti Hospital','9851043404, 01-4217766','torankc@yahoo.com',3),
 ('ent','Dr. Inku Shrestha Basnet','B&B Hospital, Gwarko, Kathmandu','9861900009, 9818194280','inkubasnet@gmail.com',4),
 ('ent','Dr. Prakash Kumar Kafle','HAMS Hospital, Dhumbarahi','9851015558','drprakashkafle@yahoo.com',5),
 ('eye','Dr. Om K. Malla','Himal Hospital, Gyaneshwor','9841250920, 5524219','okmalla@hotmail.com',1),
 ('eye','Dr. Subarna K. Khatry','Mahalaxmi Chasma Pasal, Lagankhel','5554058, 5536218, 9851059429','khatrysubarna@gmail.com',2),
 ('eye','Dr. Priyanka Shrestha','Drishti Eye Care Center, Baneshwor','9851074622, 9823641614','priyankashresthapradhan@gmail.com',3),
 ('eye','Dr. Sanyam Bajimaya','Netradham Eye Care Center Pvt. Ltd., Lalitpur-10','9851066849','sanyambajimaya@yahoo.com',4);

-- ---------------------------------------------------------------------
-- The journey (HAA). track/stage/sort decide where a step appears.
-- ---------------------------------------------------------------------
insert into public.step_templates
 (key, track, stage, sort, title, help, actor, needs_verify, optional, fields, fee_key, depends_on, expect_min, expect_max, badge) values
-- Onboarding
 ('social_follow','onboard',0,1,'Join our community',
  'Follow SAC on all five channels — we post intake news, visa tips and pilot stories there.',
  'student',false,false,
  '[{"k":"whatsapp","t":"check","l":"WhatsApp Channel"},{"k":"instagram","t":"check","l":"Instagram"},{"k":"facebook","t":"check","l":"Facebook"},{"k":"youtube","t":"check","l":"YouTube"},{"k":"linkedin","t":"check","l":"LinkedIn"}]',
  null,null,null,null,'Pre-flight Checklist'),

-- 1 Booking
 ('program_intake','visa',1,1,'Program & intake chosen',
  'SAC confirms your eligibility (18+), your program and your intake.',
  'sac',false,false,'[]',null,null,null,null,null),

-- 2 Check-in: documents
 ('doc_transcripts','visa',2,1,'+2 / High School transcripts & certificates sent to SAC',
  'Email a clean scanned PDF to SAC.','student',true,false,'[]',null,null,null,null,null),
 ('doc_passport','visa',2,2,'Passport copy sent to SAC',
  'Email a clean scanned PDF of the information page and address page.','student',true,false,
  '[{"k":"passport_expiry","t":"date","l":"Passport expiry date"}]',null,null,null,null,null),
 ('doc_financial','visa',2,3,'Financial capability documents sent to SAC',
  'Required for HAA admission approval and your I-20. Can be a bank student loan, or a sponsor (parents or immediate family). This often takes time — update it when ready.',
  'student',true,false,
  '[{"k":"source","t":"select","l":"Funding source","o":["Bank student loan","Sponsor – parents","Sponsor – immediate family","Mixed"]}]',
  null,null,null,null,null),
 ('compass','visa',2,4,'COMPASS pilot aptitude test (CAAN)',
  'You can take COMPASS at CAAN any time during the process. SAC guides you through booking.',
  'both',false,true,
  '[{"k":"test_date","t":"date","l":"Test date"},{"k":"result","t":"select","l":"Result","o":["Booked","Taken – awaiting result","Passed","Not passed"]}]',
  'compass',null,null,null,null),

-- 3 Security: HAA application
 ('haa_application','visa',3,1,'HAA online application submitted & USD 50 paid',
  'Fill the HAA international application (SAC helps you). If the link does not work, contact SAC.',
  'both',false,false,'[{"k":"date","t":"date","l":"Submitted on"}]','haa_app',null,null,null,null),
 ('haa_portals','visa',3,2,'HAA portals active',
  'HAA creates your student portal, payment portal and HAA email. SAC shows you how to use them.',
  'both',false,false,
  '[{"k":"student_portal","t":"check","l":"Student portal"},{"k":"payment_portal","t":"check","l":"Payment portal"},{"k":"haa_email","t":"check","l":"HAA email"}]',
  null,'haa_application',3,5,null),
 ('sac_fee_1','visa',3,3,'SAC service fee – NPR 30,000 paid',
  'Pay by bank transfer, then enter the date and bank reference. SAC confirms once received.',
  'student',true,false,
  '[{"k":"date","t":"date","l":"Payment date"},{"k":"ref","t":"text","l":"Bank reference no."}]',
  'sac_fee_1',null,null,null,null),

-- 4 Boarding: acceptance
 ('pre_acceptance','visa',4,1,'Conditional acceptance letter received',
  'Usually 3–5 working days after you apply. You can use this letter to apply for a student loan.',
  'both',false,false,'[{"k":"date","t":"date","l":"Received on"}]',null,'haa_application',3,5,null),
 ('fin_docs_uploaded','visa',4,2,'Documents uploaded to HAA student portal',
  'Upload your transcripts, passport and financial documents to the HAA portal.',
  'both',false,false,'[{"k":"date","t":"date","l":"Uploaded on"}]',null,null,null,null,null),
 ('official_acceptance','visa',4,3,'Official acceptance received',
  'Usually 2–3 business days after your financial documents are uploaded.',
  'both',false,false,'[{"k":"date","t":"date","l":"Received on"}]',null,'fin_docs_uploaded',2,3,'Boarding Pass'),
 ('haa_fees','visa',4,4,'HAA registration (USD 100) & processing (USD 300) fees paid',
  'Pay through your HAA payment portal. Total USD 400.',
  'both',false,false,'[{"k":"date","t":"date","l":"Paid on"}]','haa_processing',null,null,null,null),

-- 5 Pushback: I-20 & SEVIS
 ('i20_received','visa',5,1,'I-20 received',
  'Usually 3–5 working days after the USD 400 is paid.',
  'both',false,false,'[{"k":"date","t":"date","l":"Received on"}]',null,'haa_fees',3,5,'Cleared for Takeoff'),
 ('sevis_id','visa',5,2,'SEVIS ID noted','Find it at the top of your I-20.',
  'both',false,false,'[{"k":"sevis_id","t":"text","l":"SEVIS ID"}]',null,null,null,null,null),
 ('sevis_fee','visa',5,3,'SEVIS fee (USD 350) paid','Paid directly to the US government.',
  'both',false,false,'[{"k":"date","t":"date","l":"Paid on"}]','sevis','i20_received',null,null,null),
 ('tsa_fee','visa',5,4,'TSA fee (USD 140) paid & confirmed','Confirmation usually takes 1–5 working days.',
  'both',false,false,'[{"k":"date","t":"date","l":"Confirmed on"}]','tsa','i20_received',1,5,null),

-- 6 Taxi: visa application
 ('ds160','visa',6,1,'DS-160 form completed','SAC helps you fill the DS-160.',
  'both',false,false,'[{"k":"date","t":"date","l":"Completed on"}]',null,null,null,null,null),
 ('visa_fee','visa',6,2,'Visa fee paid','Ask SAC for the latest visa fee before paying.',
  'both',false,false,'[{"k":"date","t":"date","l":"Paid on"}]','visa',null,null,null,null),
 ('interview_prep','visa',6,3,'Visa interview preparation with SAC','Mock interview with SAC experts.',
  'sac',false,false,'[{"k":"date","t":"date","l":"Done on"}]',null,null,null,null,null),
 ('visa_interview','visa',6,4,'Visa interview booked','Dates depend on available slots.',
  'both',false,false,'[{"k":"when","t":"datetime","l":"Interview date & time"}]',null,null,null,null,null),

-- 7 Takeoff: decision
 ('visa_result','visa',7,1,'Visa decision',
  'If refused, you may re-apply or take time to decide. SAC will talk you through the options.',
  'sac',false,false,
  '[{"k":"result","t":"select","l":"Decision","o":["Granted","Refused","Administrative processing"]},{"k":"refusal_reason","t":"select","l":"Refusal reason","o":["214(b)","221(g)","Other"]},{"k":"next","t":"select","l":"Next step","o":["Re-apply","Pending decision","Not re-applying"]},{"k":"date","t":"date","l":"Decision date"}]',
  null,null,null,null,'Wheels Up'),
 ('sac_fee_2','visa',7,2,'SAC service fee – NPR 20,000 paid',
  'Due only after your visa is granted. Enter the date and bank reference; SAC confirms once received.',
  'student',true,false,
  '[{"k":"date","t":"date","l":"Payment date"},{"k":"ref","t":"text","l":"Bank reference no."}]',
  'sac_fee_2','visa_result',null,null,null),

-- Departure track (opens after official acceptance)
 ('med_physical','departure',1,1,'Medical – Physical & Mental examination',
  'Choose any one CAAN medical examiner from this group. Take the CAAN medical form. SAC helps you book.',
  'both',false,false,
  '[{"k":"doctor","t":"doctor","l":"Doctor","o":["physical"]},{"k":"state","t":"select","l":"Status","o":["Appointment booked","Done"]},{"k":"date","t":"date","l":"Date"}]',
  'medical',null,null,null,null),
 ('med_ent','departure',1,2,'Medical – Ear, Nose, Throat & Hearing',
  'Choose any one specialist from this group.','both',false,false,
  '[{"k":"doctor","t":"doctor","l":"Doctor","o":["ent"]},{"k":"state","t":"select","l":"Status","o":["Appointment booked","Done"]},{"k":"date","t":"date","l":"Date"}]',
  null,null,null,null,null),
 ('med_eye','departure',1,3,'Medical – Eye, Vision & Colour perception',
  'Choose any one specialist from this group.','both',false,false,
  '[{"k":"doctor","t":"doctor","l":"Doctor","o":["eye"]},{"k":"state","t":"select","l":"Status","o":["Appointment booked","Done"]},{"k":"date","t":"date","l":"Date"}]',
  null,null,null,null,null),
 ('caan_form','departure',1,4,'CAAN medical form signed by all three doctors',
  'You submit this form with your CAAN NOC application.','both',false,false,'[]',null,null,null,null,null),
 ('caan_noc_docs','departure',2,1,'CAAN NOC documents ready',
  'All copies must be notarised.','both',false,false,
  '[{"k":"transcripts","t":"check","l":"+2 transcripts (notarised)"},{"k":"citizenship","t":"check","l":"Citizenship (notarised)"},{"k":"passport","t":"check","l":"Passport (notarised)"},{"k":"application","t":"check","l":"CAAN NOC application"},{"k":"doctors_form","t":"check","l":"Signed doctors'' form"},{"k":"voucher","t":"check","l":"Bank deposit voucher"}]',
  'caan_noc',null,null,null,null),
 ('caan_noc','departure',2,2,'CAAN NOC / recommendation letter received',
  'Takes about 10 days (tentative).','both',false,false,
  '[{"k":"applied","t":"date","l":"Applied on"},{"k":"date","t":"date","l":"Received on"}]',
  null,'caan_noc_docs',8,10,null),
 ('moest_noc','departure',3,1,'Ministry of Education (MoEST) NOC received',
  'Apply on the MoEST NOC portal after the CAAN letter. About 3–5 working days (tentative). Needed to transfer tuition from Nepal and to show immigration when you depart.',
  'both',false,false,
  '[{"k":"applied","t":"date","l":"Applied on"},{"k":"date","t":"date","l":"Received on"}]',
  'moest_noc','caan_noc',3,5,null),
 ('tuition_transfer','departure',4,1,'Tuition transferred to HAA','Uses your NOCs at your Nepal bank.',
  'both',false,false,'[{"k":"date","t":"date","l":"Transferred on"}]','tuition','moest_noc',null,null,null),
 ('orientation','departure',4,2,'Pre-departure orientation with SAC','',
  'sac',false,false,'[{"k":"date","t":"date","l":"Done on"}]',null,null,null,null,null),
 ('arrival','departure',5,1,'Arrived safely at HAA','Let us know you landed!',
  'student',false,false,'[{"k":"date","t":"date","l":"Arrived on"}]',null,null,null,null,'Touchdown');
