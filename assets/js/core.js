// Shared logic for student, parent and admin pages.
// The "journey" is driven by step_templates in the database, so adding a
// step or a partner school later does not need code changes here.

export const STAGES = {
  visa: [
    { n: 1, name: 'Booking',  sub: 'Program & intake' },
    { n: 2, name: 'Check-in', sub: 'Documents' },
    { n: 3, name: 'Security', sub: 'HAA application' },
    { n: 4, name: 'Boarding', sub: 'Acceptance' },
    { n: 5, name: 'Pushback', sub: 'I-20 & SEVIS' },
    { n: 6, name: 'Taxi',     sub: 'Visa interview' },
    { n: 7, name: 'Takeoff',  sub: 'Visa decision' },
  ],
  departure: [
    { n: 1, name: 'Medical',   sub: 'CAAN Class 1' },
    { n: 2, name: 'CAAN NOC',  sub: 'Recommendation letter' },
    { n: 3, name: 'MoEST NOC', sub: 'Ministry of Education' },
    { n: 4, name: 'Departure', sub: 'Tuition & orientation' },
    { n: 5, name: 'Touchdown', sub: 'Arrival at HAA' },
  ],
};

export const STATUS_LABEL = { todo: 'To do', pending: 'Waiting for SAC to confirm', done: 'Done', na: 'Not needed' };
export const STUDENT_STATUS = { active: 'Active', deferred: 'Deferred', withdrawn: 'Withdrawn', visa_refused: 'Visa refused', completed: 'Completed' };
export const LEAD_SOURCES = ['Instagram', 'Facebook', 'Google Ads', 'Website', 'TikTok', 'Expo', 'Other'];
export const WITHDRAW_REASONS = ['Finance', 'Family', 'Chose another school', 'Visa refused', 'Personal / health', 'No response', 'Other'];
export const DOCTOR_GROUPS = { physical: 'Physical & Mental', ent: 'Ear, Nose, Throat & Hearing', eye: 'Eye, Vision & Colour' };
// Fees whose payment is shown by a step other than the one carrying fee_key
const EXTRA_FEE_STEP = { haa_registration: 'haa_fees' };

// ---------- small utils ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export function money(amount, cur) {
  if (amount === null || amount === undefined || amount === '') return 'Ask SAC';
  const n = Number(amount);
  return `${cur} ${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
export function toDate(v) { if (!v) return null; const d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v); return isNaN(d) ? null : d; }
export function fmtDate(v, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = toDate(v); return d ? d.toLocaleDateString('en-GB', opts) : '';
}
export function fmtDateTime(v) {
  const d = toDate(v); return d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}
export function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function isoDate(d) { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); }
export function daysBetween(a, b) { return Math.round((toDate(b) - toDate(a)) / 86400000); }
export function addWorkingDays(start, n) {
  const d = toDate(start); if (!d) return null;
  let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) added++; }
  return d;
}
export function toast(msg, kind = 'ok') {
  let box = $('#toasts'); if (!box) { box = h('<div id="toasts"></div>'); document.body.append(box); }
  const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`); box.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}
export async function copy(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch { prompt('Copy this:', text); }
}
export function basePath() { return location.href.replace(/[^/]*([?#].*)?$/, ''); }
export function parentLink(token) { return `${basePath()}parent.html?t=${token}`; }

// ---------- journey logic ----------
export const isComplete = s => s.status === 'done' || s.status === 'na';
export function byKey(steps) { return Object.fromEntries(steps.map(s => [s.key, s])); }
export function trackSteps(steps, track) { return steps.filter(s => s.track === track); }

// The 'gate' a student is at. Steps waiting for SAC verification do not hold
// the student back (e.g. financial documents often arrive late).
export function currentStage(steps, track) {
  const open = trackSteps(steps, track).filter(s => !s.optional && !isComplete(s) && s.status !== 'pending');
  if (!open.length) return STAGES[track].length + 1; // finished
  return Math.min(...open.map(s => s.stage));
}
export function stageDone(steps, track, n) {
  return trackSteps(steps, track).filter(s => s.stage === n && !s.optional).every(isComplete);
}
export function departureUnlocked(steps) {
  const k = byKey(steps);
  return !k.official_acceptance || isComplete(k.official_acceptance) || trackSteps(steps, 'departure').some(s => s.status !== 'todo');
}

// Expected window for a step that waits on someone else (HAA, CAAN...)
export function expectation(step, keyed) {
  if (isComplete(step) || !step.depends_on || !step.expect_max) return null;
  const dep = keyed[step.depends_on];
  if (!dep || dep.status !== 'done' || !dep.done_at) return null;
  const from = addWorkingDays(dep.done_at, step.expect_min || step.expect_max);
  const to = addWorkingDays(dep.done_at, step.expect_max);
  return { from, to, overdue: today() > to };
}

export function studentCanEdit(step) {
  if (!['student', 'both'].includes(step.actor)) return false;
  if (step.needs_verify && step.status === 'done') return false;
  return true;
}

export function nextAction(p) {
  const steps = p.steps, keyed = byKey(steps);
  const order = [...trackSteps(steps, 'onboard'), ...trackSteps(steps, 'visa').filter(s => !s.optional)];
  if (departureUnlocked(steps)) order.push(...trackSteps(steps, 'departure'));
  const visaStage = currentStage(steps, 'visa');
  // student's own open tasks first (onboarding, current visa stage, departure)
  const mine = order.find(s => !isComplete(s) && s.status !== 'pending' && studentCanEdit(s) &&
    (s.track !== 'visa' || s.stage <= visaStage));
  const waiting = order.find(s => !isComplete(s) && (s.status === 'pending' || !studentCanEdit(s) || expectation(s, keyed)));
  return { mine, waiting, exp: waiting ? expectation(waiting, keyed) : null };
}

export function badges(steps) {
  return steps.filter(s => s.badge).map(s => ({ name: s.badge, earned: s.status === 'done', key: s.key }));
}

export function feeRows(p) {
  const keyed = byKey(p.steps);
  return p.fees.map(f => {
    const stepKey = EXTRA_FEE_STEP[f.key] || (p.steps.find(s => s.fee_key === f.key) || {}).key;
    const step = keyed[stepKey];
    let amount = f.amount;
    if (f.key === 'tuition' && p.program) amount = p.program.tuition_usd;
    const optional = step?.optional;
    let state = 'todo';
    if (step) state = step.status === 'done' ? 'paid' : step.status === 'pending' ? 'pending' : step.status === 'na' ? 'na' : 'todo';
    return { ...f, amount, step, state, optional };
  });
}

// ---------- warnings / alerts ----------
export function studentWarnings(p) {
  const w = [];
  const keyed = byKey(p.steps);
  if (p.intake?.note && !p.intake.recommended) w.push({ kind: 'warn', text: `${p.intake.label}: ${p.intake.note}` });
  const exp = keyed.doc_passport?.data?.passport_expiry;
  if (exp && p.intake) {
    const limit = new Date(toDate(p.intake.start_month)); limit.setMonth(limit.getMonth() + 6);
    if (toDate(exp) < limit) w.push({ kind: 'warn', text: `Your passport expires on ${fmtDate(exp)}. Talk to SAC about renewing it before your visa interview.` });
  }
  return w;
}

// Admin alerts for one student. stu = students row, p = payload-like {steps, intake, program}
export function adminAlerts(stu, p) {
  const out = [];
  const keyed = byKey(p.steps);
  if (stu.status === 'withdrawn' || stu.status === 'completed') return out;
  p.steps.filter(s => s.status === 'pending').forEach(s => out.push({ level: 'verify', text: `Verify: ${s.title}`, step: s.key }));
  p.steps.forEach(s => { const e = expectation(s, keyed); if (e?.overdue) out.push({ level: 'red', text: `Overdue: ${s.title} (expected by ${fmtDate(e.to)})`, step: s.key }); });
  const idle = daysBetween(stu.last_activity_at, new Date());
  if (stu.status === 'active' && idle >= 14) out.push({ level: 'amber', text: `No movement for ${idle} days` });
  const visaDone = keyed.visa_result && isComplete(keyed.visa_result);
  if (p.intake && stu.status === 'active') {
    const left = daysBetween(today(), p.intake.start_month);
    if (p.intake.note && !p.intake.recommended && !visaDone) out.push({ level: 'amber', text: `Tight intake: ${p.intake.label}` });
    if (keyed.moest_noc && !isComplete(keyed.moest_noc) && left <= 21 && left >= -30)
      out.push({ level: 'red', text: `NOCs not done — intake in ${left} days` });
  }
  const exp = keyed.doc_passport?.data?.passport_expiry;
  if (exp && p.intake) {
    const limit = new Date(toDate(p.intake.start_month)); limit.setMonth(limit.getMonth() + 6);
    if (toDate(exp) < limit) out.push({ level: 'amber', text: `Passport expires ${fmtDate(exp)}` });
  }
  if (stu.status === 'deferred' && keyed.sac_fee_1?.done_at) {
    const until = new Date(toDate(keyed.sac_fee_1.done_at)); until.setMonth(until.getMonth() + 12);
    if (today() > until) out.push({ level: 'amber', text: `Deferral expired ${fmtDate(until)} — NPR 30k no longer valid` });
  }
  return out;
}

// Build the same payload the database builds (used by admin + demo mode)
export function buildPayload(db, sid, viewer) {
  const s = db.students.find(x => x.id === sid);
  const program = db.programs.find(x => x.id === s.program_id) || null;
  const intake = db.intakes.find(x => x.id === s.intake_id) || null;
  const partner = program?.partner || 'HAA';
  const rows = db.student_steps.filter(r => r.student_id === sid);
  const steps = db.step_templates.filter(t => t.active && t.partner === partner).map(t => {
    const r = rows.find(x => x.step_key === t.key);
    return { ...t, status: r?.status || 'todo', data: r?.data || {}, done_at: r?.done_at || null };
  }).sort((a, b) => a.track.localeCompare(b.track) || a.stage - b.stage || a.sort - b.sort);
  const student = { code: s.code, full_name: s.full_name, status: s.status, ack_terms_at: s.ack_terms_at, ack_consent_at: s.ack_consent_at, created_at: s.created_at };
  if (viewer !== 'parent') Object.assign(student, { email: s.email, phone: s.phone, parent_token: s.parent_token, status_reason: s.status_reason });
  return {
    viewer, student, program, intake, steps,
    fees: [...db.fees].sort((a, b) => a.sort - b.sort),
    doctors: db.doctors.filter(d => d.active).sort((a, b) => a.grp.localeCompare(b.grp) || a.sort - b.sort),
    intakes: db.intakes.filter(i => i.active).sort((a, b) => a.start_month.localeCompare(b.start_month)),
    settings: Object.fromEntries(db.settings.map(r => [r.key, r.value])),
  };
}
