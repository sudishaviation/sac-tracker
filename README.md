# SAC Admission Tracker — HAA, USA (v1)

Private student tracker for Sudisha Aviation Consultant: from first contact to visa, NOCs and arrival at Hillsboro Aero Academy.

| Page | Who | How they get in |
|---|---|---|
| `index.html` | Students | Student ID + 6-digit PIN (created by SAC) |
| `parent.html?t=…` | Parents / sponsors | Private read-only link |
| `admin.html` | SAC staff | Email + password (Supabase login) |

Until Supabase keys are added to `assets/js/config.js`, the site runs in **demo mode** with sample students (`SAC-DEMO1` / PIN `123456`).

**Cost: free** — GitHub Pages (website) + Supabase free plan (database & logins).

---

## Setup (about 30 minutes, one time)

### 1. Supabase (database)
1. Go to https://supabase.com → **Start your project** → sign up (GitHub or email).
2. **New project** → name `sac-tracker`, choose a strong database password (save it in your password manager), region **closest to Nepal (e.g. Mumbai / Singapore)** → Create.
3. Open **SQL Editor** → **New query** → paste all of `supabase/01_schema.sql` → **Run**. Then do the same with `supabase/02_seed.sql`.
4. **Authentication → Users → Add user → Create new user**: your email + a strong password, tick **Auto Confirm User**.
5. SQL Editor: open `supabase/03_make_admin.sql`, check the email is yours → **Run**. It should show one row.
6. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up" (only you create accounts).
7. **Project Settings → API**: copy the **Project URL** and the **publishable / anon public key**.
   ⚠️ Never share or paste the **secret / service_role** key anywhere.

### 2. Connect the website
Paste the two values into `assets/js/config.js`:
```js
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_KEY: 'sb_publishable_… or eyJ…',
```

### 3. GitHub Pages (website hosting)
1. Repo **Settings → Pages → Source: Deploy from a branch → `main` / root** → Save.
2. After a minute the site is live at `https://<github-user>.github.io/sac-tracker/`.
3. Repo **Settings → Secrets and variables → Actions → New repository secret**: add `SUPABASE_URL` and `SUPABASE_KEY` (same public values). This powers the daily "keep awake" ping so the free database never pauses.

### 4. Your own web address (track.sudishaviation.com.np)
1. At your domain/DNS provider add a record: **Type** `CNAME`, **Name** `track`, **Value** `<github-user>.github.io`.
2. Back in **Settings → Pages → Custom domain**: enter `track.sudishaviation.com.np` → Save. When the check is green, tick **Enforce HTTPS**.

---

## Daily use
- **Add student** (Admin → + Add student) → copy the welcome message → send privately by email/WhatsApp. The PIN is shown once; use **Reset PIN** if lost.
- Students tick steps → payment and document ticks show as **To verify** on your dashboard → check your bank / inbox → **✓ Verify**.
- **Dashboard** shows: steps to verify, overdue steps (based on HAA/CAAN timelines), students idle 14+ days, tight intakes, NOC risk before intake, passport expiry, expired deferrals.
- **Settings** → update intakes, fees, program prices, CAAN doctors and links whenever they change. Students see changes immediately.
- Withdrawn students are deleted automatically 12 months after their last activity (when you open the admin page).

## Security model
- Students and parents can never read the database directly. They only reach their own record through functions that check the PIN session or the secret parent link.
- 5 wrong PINs lock the ID for 15 minutes. Sessions expire after 12 hours.
- Documents are **not** stored here — only status ticks.
- Commission and internal notes are visible to SAC admins only.

## Files
```
index.html / parent.html / admin.html
assets/js/   core.js (journey logic) · journey.js (student/parent UI) · admin.js · api.js · legal.js (agreements) · config.js · demo-data.js
supabase/    01_schema.sql · 02_seed.sql · 03_make_admin.sql
.github/workflows/keep-alive.yml
```

## Changing the journey later
Steps live in the `step_templates` table. A new step = a new row (track, stage, title, who ticks it, fields). A new partner school = new rows with a different `partner` value plus its programs — no code rewrite.
