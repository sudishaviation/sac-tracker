import { getApi, DEMO } from './api.js';
import { renderKnowledge } from './kb.js';
import {
  $, $$, h, esc, money, fmtDate, fmtDateTime, toast, copy, basePath, parentLink, buildPayload, adminAlerts,
  STAGES, STATUS_LABEL, STUDENT_STATUS, LEAD_SOURCES, WITHDRAW_REASONS, DOCTOR_GROUPS, currentStage, nextAction,
  byKey, isComplete, daysBetween, reminderItems,
} from './core.js';

const api = await getApi();
let db = null, view = 'students', role = 'owner', me = '';
const isOwner = () => role === 'owner';

if (DEMO) {
  $('#demo').append(h(`<div class="demo-bar">Demo mode · sample data in this browser only. Any email/password logs in. <button id="resetDemo">Reset demo</button></div>`));
  $('#resetDemo').onclick = () => { api.reset(); location.reload(); };
}

// ---------------- auth ----------------
function showPasswordForm() {
  $('#login').hidden = false; $('#app').hidden = true; $('#loginForm').hidden = true; $('#pwForm').hidden = false;
}
$('#pwForm').onsubmit = async e => {
  e.preventDefault(); $('#pwErr').hidden = true;
  const a = $('#pw1').value, b = $('#pw2').value;
  if (a.length < 10 || a !== b) { $('#pwErr').textContent = a !== b ? 'The two passwords do not match.' : 'Use at least 10 characters.'; $('#pwErr').hidden = false; return; }
  try { await api.setPassword(a); $('#pw1').value = $('#pw2').value = ''; toast('Password saved'); $('#pwForm').hidden = true; $('#loginForm').hidden = false; await start(); }
  catch (err) { $('#pwErr').textContent = err.message; $('#pwErr').hidden = false; }
};
$('#forgot').onclick = async () => {
  const email = $('#email').value.trim();
  if (!email) { $('#loginErr').textContent = 'Type your email above first, then press Forgot password.'; $('#loginErr').hidden = false; return; }
  try { await api.sendPasswordReset(email); $('#loginErr').className = 'notice'; $('#loginErr').textContent = 'If this email belongs to the SAC team, a reset link is on its way. Open it on this device.'; $('#loginErr').hidden = false; }
  catch (err) { $('#loginErr').textContent = err.message; $('#loginErr').hidden = false; }
};
$('#chpw').onclick = () => showPasswordForm();

async function start() {
  if (['invite', 'recovery'].includes(api.authLinkType?.()) && await api.authReady?.()) { showPasswordForm(); return; }
  const who = await api.adminSession();
  if (!who) { $('#login').hidden = false; $('#app').hidden = true; $('#logout').hidden = true; return; }
  role = who.role || 'owner'; me = who.email;
  $('#who').textContent = `${who.email} · ${isOwner() ? 'Owner' : 'Counsellor'}`; $('#logout').hidden = false; $('#chpw').hidden = DEMO; $('#login').hidden = true; $('#app').hidden = false;
  $$('#nav [data-owner]').forEach(b => { b.hidden = !isOwner(); });
  await reload();
  if (isOwner()) { try { const n = await api.adminPurge(); if (n) toast(`${n} withdrawn record(s) older than 12 months deleted`); } catch { /* ignore */ } }
}
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); $('#loginErr').hidden = true;
  try { await api.adminSignIn($('#email').value, $('#pw').value); $('#pw').value = ''; await start(); }
  catch (err) { $('#loginErr').textContent = err.message; $('#loginErr').hidden = false; }
};
$('#logout').onclick = async () => { await api.adminSignOut(); location.reload(); };
$('#nav').onclick = e => { const b = e.target.closest('[data-view]'); if (!b) return; view = b.dataset.view; render(); };

async function reload() { db = await api.adminLoadAll(role); render(); }

// ---------------- helpers ----------------
const P = sid => buildPayload(db, sid, 'admin');
const stu = id => db.students.find(s => s.id === id);
const progName = id => db.programs.find(p => p.id === id)?.short_name || '—';
const intakeLabel = id => db.intakes.find(i => i.id === id)?.label || '—';
function rowAlerts(s) { return adminAlerts(s, P(s.id)); }
function stageText(p) {
  const v = currentStage(p.steps, 'visa');
  return v > 7 ? 'Visa done' : `${v}/7 ${STAGES.visa[v - 1].name}`;
}
function nextText(p) {
  const n = nextAction(p);
  if (n.mine) return `Student: ${n.mine.title}`;
  if (n.waiting) return `${n.waiting.status === 'pending' ? 'Verify' : 'Waiting'}: ${n.waiting.title}`;
  return '—';
}
function welcomeMessage(s, pin, ptoken) {
  return `Hi ${s.full_name.split(' ')[0]}, welcome to Sudisha Aviation Consultant! ✈\n\nTrack your Hillsboro Aero Academy journey here:\n${basePath()}\n\nStudent ID: ${s.code}\nPIN: ${pin}\n(Keep your PIN private.)\n\nShare this private link with your parents/sponsor so they can follow your progress:\n${parentLink(ptoken)}\n\n— Sudisha Aviation Consultant`;
}

// ---------------- views ----------------
function render() {
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const v = $('#view'); v.innerHTML = ''; v.onclick = null;
  if (!isOwner() && ['add', 'settings'].includes(view)) view = 'students';
  if (view === 'knowledge') { renderKnowledge(v, api, { role, email: me, students: db.students }); return; }
  ({ students: renderStudentsHome, add: renderAdd, reminders: renderReminders, settings: renderSettings })[view](v);
}

function reminderText(s) {
  const r = reminderItems(P(s.id));
  const st = db.settings.find(x => x.key === 'contact_email')?.value || '';
  const lines = [`Hi ${s.full_name.split(' ')[0]},`, '', `A quick reminder from Sudisha Aviation Consultant about your HAA journey (Student ID ${s.code}).`, ''];
  if (r.booked.length) { lines.push('Your booked dates:'); r.booked.forEach(b => lines.push(`• ${b.title} — ${b.dt ? fmtDateTime(b.date) : fmtDate(b.date)}`)); lines.push(''); }
  if (r.todo.length) { lines.push('Still to do:'); r.todo.forEach(t => lines.push(`• ${t}`)); lines.push(''); }
  if (!r.booked.length && !r.todo.length) lines.push('You have nothing pending right now. Thank you!', '');
  lines.push(`Please tick what you have completed in your tracker: ${basePath()}`, 'If something is already done or you need help, just reply to this message.', '', 'Regards,', 'Sudisha Aviation Consultant (SAC)', st);
  return { text: lines.join('\n'), count: r.booked.length + r.todo.length, next: r.booked[0] };
}

function openReminder(id) {
  const s = stu(id); if (!s) return;
  const { text } = reminderText(s);
  const subject = 'Reminder: your HAA application steps';
  const m = h(`<div class="modal"><div class="modal-box"><header><h3>Reminder for ${esc(s.full_name)}</h3><div class="muted small">${s.email ? `To: ${esc(s.email)}` : 'No email on file'} · edit the text if you like, then send it yourself.</div></header>
    <div class="scroll"><textarea rows="16" style="width:100%;font:inherit"></textarea></div>
    <footer><div class="actions"><button class="btn" data-a="mail">Open in email app</button><button class="btn ghost" data-a="copy">Copy text</button><button class="btn ghost" data-a="x">Close</button></div></footer></div></div>`);
  const ta = $('textarea', m); ta.value = text;
  m.onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'x' || e.target === m) m.remove();
    if (a === 'copy') copy(ta.value, 'Reminder copied');
    if (a === 'mail') window.location.href = `mailto:${encodeURIComponent(s.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(ta.value)}`;
  };
  document.body.append(m);
}

function renderReminders(v) {
  const rows = db.students.filter(s => !['withdrawn', 'studying', 'completed'].includes(s.status)).map(s => ({ s, ...reminderText(s) }))
    .sort((a, b) => (a.next ? new Date(a.next.date) : Infinity) - (b.next ? new Date(b.next.date) : Infinity));
  v.append(h(`<div class="card"><h3>Reminders</h3><p class="muted small">Students with pending tasks or booked dates. Click Email to review a ready-made reminder, then send it from your own mail. Nothing is sent automatically.</p>
    <div class="tablewrap"><table class="tbl"><thead><tr><th>Student</th><th>Pending / booked</th><th>Next booked date</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.s.full_name)}</b> <span class="mono muted small">${esc(r.s.code)}</span></td><td>${r.count}</td><td>${r.next ? `${esc(r.next.title)} · ${esc(r.next.dt ? fmtDateTime(r.next.date) : fmtDate(r.next.date))}` : '—'}</td><td><button class="btn small" data-rem="${r.s.id}">Email</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No active students.</td></tr>'}</tbody></table></div></div>`));
  v.onclick = e => { const b = e.target.closest('[data-rem]'); if (b) openReminder(b.dataset.rem); };
}

function renderGuide(v) {
  const who = { student: 'Student', sac: 'SAC', both: 'Student + SAC' };
  const feeOf = k => { const f = db.fees.find(x => x.key === k); return f ? `${f.label}: ${f.amount == null ? 'ask for latest' : money(f.amount, f.currency)} → ${f.payee}${f.refundable ? ' (refundable)' : ''}` : ''; };
  v.append(h(`<div class="card"><h3>HAA procedure — zero to visa, then departure</h3><p class="muted small">Reference only. This is exactly what each student sees. Edit fees, programs and intakes in Settings.</p></div>`));
  [['onboard', 'Before take-off'], ['visa', 'Visa journey'], ['departure', 'Departure (Nepal NOCs, medical)']].forEach(([track, title]) => {
    const c = h(`<div class="card"><h3>${title}</h3></div>`);
    let last = null;
    db.step_templates.filter(t => t.track === track && t.active !== false).sort((a, b) => a.stage - b.stage || a.sort - b.sort).forEach(t => {
      if (track !== 'onboard' && t.stage !== last) { last = t.stage; const i = STAGES[track][t.stage - 1]; c.append(h(`<h4 style="margin:14px 0 4px;color:var(--navy)">${t.stage}. ${esc(i?.name || '')} <span class="muted small">${esc(i?.sub || '')}</span></h4>`)); }
      const fee = t.fee_key ? feeOf(t.fee_key) : '';
      c.append(h(`<div style="padding:8px 0;border-top:1px solid var(--line)"><b>${esc(t.title)}</b> <span class="tag">${who[t.actor] || ''}${t.optional ? ' · optional' : ''}</span>
        <div class="small">${esc(t.help || '')}</div>
        ${fee ? `<div class="small"><b>Fee:</b> ${esc(fee)}</div>` : ''}
        ${t.expect_min ? `<div class="muted small">Usually ${t.expect_min}–${t.expect_max} working days</div>` : ''}</div>`));
    });
    v.append(c);
  });
  const f = h(`<div class="card"><h3>All fees</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>Fee</th><th>Amount</th><th>Paid to</th><th>Refundable</th><th>Note</th></tr></thead><tbody>${db.fees.slice().sort((a, b) => a.sort - b.sort).map(x => `<tr><td>${esc(x.label)}</td><td>${x.amount == null ? 'ask' : esc(money(x.amount, x.currency))}</td><td>${esc(x.payee)}</td><td>${x.refundable ? 'Yes' : 'No'}</td><td class="small">${esc(x.note || '')}</td></tr>`).join('')}</tbody></table></div></div>`);
  v.append(f);
  const d = h(`<div class="card"><h3>CAAN Class 1 medical — 3 doctors needed</h3><p class="muted small">One physical, one ENT, one eye examiner. Confirm the latest list with CAAN.</p>${['physical', 'ent', 'eye'].map(g => `<h4 style="margin:12px 0 4px">${esc(DOCTOR_GROUPS[g])}</h4>${db.doctors.filter(x => x.grp === g && x.active).map(x => `<div class="small" style="padding:4px 0">${esc(x.name)} — ${esc(x.address || '')} · ${esc(x.phone || '')}</div>`).join('')}`).join('')}</div>`);
  v.append(d);
}

function attentionCard() {
  const alerts = db.students.flatMap(s => rowAlerts(s).map(a => ({ ...a, s })));
  const order = { verify: 0, red: 1, amber: 2 };
  const al = h(`<div class="card alerts"><h3>Needs your attention</h3>${alerts.length ? '' : '<p class="muted">All clear ✈</p>'}</div>`);
  alerts.sort((a, b) => order[a.level] - order[b.level]).forEach(a => al.append(h(`<div class="al" data-open="${a.s.id}"><span class="lvl ${a.level}"></span><div><b>${esc(a.text)}</b><small>${esc(a.s.full_name)} · ${esc(a.s.code)}</small></div></div>`)));
  return al;
}

// Stats (pipeline, lead sources, commission) — shown folded under the student list
function renderDash(v) {
  const live = db.students.filter(s => s.status !== 'withdrawn');
  const active = db.students.filter(s => s.status === 'active');
  const alerts = db.students.flatMap(s => rowAlerts(s).map(a => ({ ...a, s })));
  const pend = alerts.filter(a => a.level === 'verify').length;
  const granted = db.students.filter(s => P(s.id).steps.find(x => x.key === 'visa_result')?.data?.result === 'Granted');
  const exp = db.commissions.reduce((t, c) => t + Number(c.expected_usd || 0), 0);
  const rec = db.commissions.reduce((t, c) => t + Number(c.received_usd || 0), 0);
  v.append(h(`<div class="kpis">
    <div class="kpi"><label>Active students</label><b>${active.length}</b></div>
    <div class="kpi ${pend ? 'alert' : ''}"><label>To verify</label><b>${pend}</b></div>
    <div class="kpi ${alerts.length - pend ? 'alert' : ''}"><label>Alerts</label><b>${alerts.length - pend}</b></div>
    <div class="kpi"><label>Visas granted</label><b>${granted.length}</b></div>
    ${isOwner() ? `<div class="kpi"><label>Commission (USD)</label><b style="font-size:18px">${money(rec, '')} <span class="muted small">/ ${money(exp, '')} expected</span></b></div>` : ''}
  </div>`));
  const g = h(`<div class="grid2"><div></div><div></div></div>`); v.append(g);


  const pipe = h(`<div class="card"><h3>Pipeline (active students)</h3></div>`);
  const counts = {}; active.forEach(s => { const st = currentStage(P(s.id).steps, 'visa'); counts[st] = (counts[st] || 0) + 1; });
  [...STAGES.visa, { n: 8, name: 'Visa done' }].forEach(st => {
    const c = counts[st.n] || 0;
    pipe.append(h(`<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${st.n <= 7 ? st.n + '. ' : ''}${esc(st.name)}</span><b>${c}</b></div><div class="bar"><i style="width:${active.length ? (c / active.length) * 100 : 0}%"></i></div></div>`));
  });
  g.children[1].append(pipe);

  const lead = h(`<div class="card"><h3>Lead sources</h3><table class="tbl"><thead><tr><th>Source</th><th>Students</th><th>Visas</th></tr></thead><tbody></tbody></table></div>`);
  LEAD_SOURCES.forEach(src => {
    const n = db.students.filter(s => s.lead_source === src).length; if (!n) return;
    const vis = granted.filter(s => s.lead_source === src).length;
    $('tbody', lead).append(h(`<tr><td>${src}</td><td>${n}</td><td>${vis}</td></tr>`));
  });
  g.children[1].append(lead);

  const intk = h(`<div class="card"><h3>By intake</h3><table class="tbl"><tbody></tbody></table></div>`);
  db.intakes.forEach(i => { const n = live.filter(s => s.intake_id === i.id).length; if (n) $('tbody', intk).append(h(`<tr><td>${esc(i.label)}${i.note && !i.recommended ? ' ⚠️' : ''}</td><td>${n}</td></tr>`)); });
  g.children[0].append(intk);
  v.onclick = e => { const o = e.target.closest('[data-open]'); if (o) openStudent(o.dataset.open); };
}

function renderStudentsHome(v) {
  v.append(attentionCard());
  const list = h('<div></div>'); v.append(list);
  renderStudents(list);
  const st = h(`<details class="card" style="margin-top:14px"><summary style="cursor:pointer;font-weight:600;color:var(--navy)">Stats — pipeline, lead sources${isOwner() ? ', commission' : ''}</summary><div style="margin-top:12px"></div></details>`);
  v.append(st); renderDash($('div', st));
  v.onclick = e => { const o = e.target.closest('[data-open]'); if (o) openStudent(o.dataset.open); };
}

function renderStudents(v) {
  v.append(h(`<div class="card"><div class="toolbar">
    <input id="q" placeholder="Search name, ID, email…" style="flex:1;min-width:200px">
    <select id="fs"><option value="">All statuses</option>${Object.entries(STUDENT_STATUS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <button class="btn ghost small" id="csv">Export CSV</button></div>
    <div class="tablewrap"><table class="tbl"><thead><tr><th>ID</th><th>Name</th><th>Program</th><th>Intake</th><th>Stage</th><th>Next</th><th>Last activity</th><th>Status</th><th>⚑</th></tr></thead><tbody></tbody></table></div></div>`));
  const draw = () => {
    const q = $('#q').value.toLowerCase(), fs = $('#fs').value;
    const tb = $('tbody', v); tb.innerHTML = '';
    db.students.filter(s => (!fs || s.status === fs) && (!q || [s.full_name, s.code, s.email, s.phone].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
      .forEach(s => {
        const p = P(s.id), al = rowAlerts(s);
        tb.append(h(`<tr class="click" data-open="${s.id}"><td class="mono">${esc(s.code)}</td><td><b>${esc(s.full_name)}</b><br><small class="muted">${esc(s.lead_source || '')}</small></td>
          <td>${esc(progName(s.program_id))}</td><td>${esc(intakeLabel(s.intake_id))}</td><td>${stageText(p)}</td><td class="small">${esc(nextText(p))}</td>
          <td class="small">${daysBetween(s.last_activity_at, new Date())}d ago</td><td><span class="pill ${s.status}">${STUDENT_STATUS[s.status]}</span></td>
          <td>${al.length ? `<span class="flagdot">${al.length}</span>` : ''}</td></tr>`));
      });
  };
  $('#q').oninput = draw; $('#fs').onchange = draw; draw();
  $('#csv').onclick = () => {
    const rows = [['ID', 'Name', 'Email', 'Phone', 'Program', 'Intake', 'Lead source', 'Status', 'Stage', 'Last activity']];
    db.students.forEach(s => rows.push([s.code, s.full_name, s.email, s.phone, progName(s.program_id), intakeLabel(s.intake_id), s.lead_source, s.status, stageText(P(s.id)), fmtDate(s.last_activity_at)]));
    const csv = rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `sac-students-${fmtDate(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}.csv`; a.click();
  };
  v.onclick = e => { const o = e.target.closest('[data-open]'); if (o) openStudent(o.dataset.open); };
}

function opts(list, val, blank = '') { return (blank !== null ? `<option value="">${blank}</option>` : '') + list.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(val ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join(''); }
const programOpts = v => opts(db.programs.filter(p => p.active || p.id === v).map(p => [p.id, `${p.category} · ${p.name.replace('HAA – ', '')}`]), v, 'Choose program…');
const intakeOpts = v => opts(db.intakes.filter(i => i.active || i.id === v).map(i => [i.id, `${i.label} — ${i.status}${i.recommended ? ' ★' : ''}`]), v, 'Choose intake…');

function renderAdd(v) {
  v.append(h(`<div class="card" style="max-width:640px"><h3>Add a student</h3>
    <p class="muted small">Only after you have checked eligibility (18+). The student gets an ID and PIN — share them privately.</p>
    <form id="addForm"><div class="formgrid">
      <div class="field"><label>Full name *</label><input name="full_name" required></div>
      <div class="field"><label>Email</label><input name="email" type="email"></div>
      <div class="field"><label>Phone / WhatsApp</label><input name="phone"></div>
      <div class="field"><label>Date of birth</label><input name="dob" type="date"></div>
      <div class="field"><label>Program *</label><select name="program_id" required>${programOpts()}</select></div>
      <div class="field"><label>Visa type *</label><select name="visa_type" required>${opts([['F-1', 'F-1 student visa'], ['M-1', 'M-1 student visa']], '', 'Choose program first…')}</select></div>
      <div class="field"><label>Intake *</label><select name="intake_id" required>${intakeOpts()}</select></div>
      <div class="field"><label>Lead source *</label><select name="lead_source" required>${opts(LEAD_SOURCES.map(x => [x, x]), '', 'How did they find us?')}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Where are they now? *</label><select name="stage">
        <option value="new">New applicant — starting from zero</option>
        <option value="visa_granted">Visa already granted — awaiting departure</option>
        <option value="studying">Already studying at HAA</option></select></div>
    </div>
    <div id="existingBox" class="card" style="display:none;background:var(--sky)"><h4 style="margin:0 0 6px">Existing student details</h4>
      <p class="muted small">Earlier steps are marked done automatically (dated today). Correct any dates later in the student's Journey. For a past intake, add it first in Settings → Intakes.</p>
      <div class="formgrid">
      <div class="field"><label>HAA student ID</label><input name="haa_student_id"></div>
      <div class="field"><label>Actual start date</label><input name="start_date" type="date"></div>
      <div class="field"><label>Expected completion</label><input name="expected_end_date" type="date"></div>
      <div class="field"><label>Data consent recorded on</label><input name="consent_recorded_on" type="date"></div></div>
      <p class="muted small">If consent was given offline (signed form / email), enter that date. Otherwise the student accepts it on first login.</p></div>
    <div id="ageWarn"></div><button class="btn" type="submit">Create student</button></form><div id="created"></div></div>`));
  const f = $('#addForm');
  f.program_id.onchange = () => { const pr = db.programs.find(x => x.id === f.program_id.value); if (pr) f.visa_type.value = pr.visa_type || 'F-1'; };
  f.stage.onchange = () => { $('#existingBox').style.display = f.stage.value === 'new' ? 'none' : 'block'; };
  f.dob.onchange = () => {
    const age = (new Date() - new Date(f.dob.value)) / (365.25 * 864e5);
    $('#ageWarn').innerHTML = f.dob.value && age < 18 ? `<div class="notice warn">This student is under 18 — not eligible yet.</div>` : '';
  };
  f.intake_id.onchange = () => {
    const i = db.intakes.find(x => String(x.id) === f.intake_id.value);
    $('#ageWarn').innerHTML = f.stage.value === 'new' && i?.note && !i.recommended ? `<div class="notice warn">${esc(i.note)}</div>` : '';
  };
  f.onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    try {
      const r = await api.adminCreateStudent(data);
      await reload(); view = 'add'; render();
      const s = { ...data, code: r.code };
      const msg = welcomeMessage(s, r.pin, r.parent_token);
      $('#created').append(h(`<div class="secret" style="margin-top:16px">Student ID <b>${esc(r.code)}</b> · PIN <b>${esc(r.pin)}</b>
        <div class="small" style="opacity:.75;margin-top:6px">The PIN is shown only now. Copy the welcome message and send it to the student privately (email or WhatsApp).</div></div>`));
      const b = h(`<div class="actions" style="margin-top:10px"><button class="btn navy">Copy welcome message</button><button class="btn ghost">Open student</button></div>`);
      b.children[0].onclick = () => copy(msg, 'Welcome message copied');
      b.children[1].onclick = () => openStudent(r.id);
      $('#created').append(b);
    } catch (err) { toast(err.message, 'err'); }
  };
}

// ---------------- student drawer ----------------
async function openStudent(id) {
  $('.drawer')?.remove(); $('.drawer-bg')?.remove();
  const s = stu(id); if (!s) return;
  const p = P(id), al = rowAlerts(s);
  const com = db.commissions.find(c => c.student_id === id) || {};
  const bg = h(`<div class="drawer-bg"></div>`);
  const d = h(`<aside class="drawer"><header><h2>${esc(s.full_name)} <span class="mono muted small">${esc(s.code)}</span></h2><span class="pill ${s.status}">${STUDENT_STATUS[s.status]}</span><button class="btn ghost small" data-x>Close</button></header><div class="body"></div></aside>`);
  document.body.append(bg, d);
  const close = () => { d.remove(); bg.remove(); };
  bg.onclick = close; $('[data-x]', d).onclick = close;
  const body = $('.body', d);

  if (al.length) body.append(h(`<div class="card alerts"><h3>Alerts</h3>${al.map(a => `<div class="al"><span class="lvl ${a.level}"></span><div>${esc(a.text)}</div></div>`).join('')}</div>`));

  const qa = h(`<div class="card"><h3>Quick actions</h3><div class="actions">
    <button class="btn navy small" data-a="pin">Reset PIN</button>
    <button class="btn ghost small" data-a="plink">Copy parent link</button>
    ${isOwner() ? '<button class="btn ghost small" data-a="preset">Reset parent link</button>' : ''}
    <button class="btn ghost small" data-a="popen">Open parent view</button>
    <button class="btn ghost small" data-a="remind">Reminder email</button></div><div id="pinOut"></div>
    <p class="muted small">Agreements: ${s.ack_terms_at ? `accepted ${fmtDateTime(s.ack_terms_at)}` : s.consent_recorded_on ? `consent recorded offline on ${fmtDate(s.consent_recorded_on)} · student still ticks at first login` : '<b>not yet accepted</b> (student accepts at first login)'}</p></div>`);
  body.append(qa);
  qa.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    try {
      if (a === 'pin') { if (!confirm('Create a new PIN? The old PIN stops working.')) return; const pin = await api.adminResetPin(id); $('#pinOut', qa).innerHTML = ''; $('#pinOut', qa).append(h(`<div class="secret" style="margin-top:10px">New PIN <b>${pin}</b></div>`)); const b = h(`<button class="btn small" style="margin-top:8px">Copy welcome message with new PIN</button>`); b.onclick = () => copy(welcomeMessage(s, pin, s.parent_token), 'Copied'); $('#pinOut', qa).append(b); }
      if (a === 'plink') copy(parentLink(s.parent_token), 'Parent link copied');
      if (a === 'remind') openReminder(id);
      if (a === 'popen') window.open(parentLink(s.parent_token), '_blank');
      if (a === 'preset') { if (!confirm('Reset the parent link? The old link stops working.')) return; s.parent_token = await api.adminResetParentLink(id); toast('New parent link created'); copy(parentLink(s.parent_token), 'New parent link copied'); }
    } catch (err) { toast(err.message, 'err'); }
  };

  // profile
  const prof = h(`<div class="card"><h3>Profile & status</h3><form><div class="formgrid">
    <div class="field"><label>Full name</label><input name="full_name" value="${esc(s.full_name)}"></div>
    <div class="field"><label>Email</label><input name="email" value="${esc(s.email || '')}"></div>
    <div class="field"><label>Phone</label><input name="phone" value="${esc(s.phone || '')}"></div>
    <div class="field"><label>Date of birth</label><input name="dob" type="date" value="${esc(s.dob || '')}"></div>
    <div class="field"><label>Program</label><select name="program_id">${programOpts(s.program_id)}</select></div>
    <div class="field"><label>Intake</label><select name="intake_id">${intakeOpts(s.intake_id)}</select></div>
    <div class="field"><label>Visa type</label><select name="visa_type">${opts([['F-1', 'F-1 student visa'], ['M-1', 'M-1 student visa']], s.visa_type || 'F-1', null)}</select></div>
    <div class="field"><label>Lead source</label><select name="lead_source">${opts(LEAD_SOURCES.map(x => [x, x]), s.lead_source, '—')}</select></div>
    <div class="field"><label>HAA student ID</label><input name="haa_student_id" value="${esc(s.haa_student_id || '')}"></div>
    <div class="field"><label>Actual start date</label><input name="start_date" type="date" value="${esc(s.start_date || '')}"></div>
    <div class="field"><label>Expected completion</label><input name="expected_end_date" type="date" value="${esc(s.expected_end_date || '')}"></div>
    <div class="field"><label>Consent recorded offline on</label><input name="consent_recorded_on" type="date" value="${esc(s.consent_recorded_on || '')}"></div>
    <div class="field"><label>Status</label><select name="status">${opts(Object.entries(STUDENT_STATUS), s.status, null)}</select></div>
    <div class="field"><label>Reason (withdrawn / deferred / refused)</label><select name="status_reason">${opts(WITHDRAW_REASONS.map(x => [x, x]), s.status_reason, '—')}</select></div>
    </div><div class="field"><label>Internal notes (SAC only)</label><textarea name="internal_notes" rows="3">${esc(s.internal_notes || '')}</textarea></div>
    <button class="btn small" type="submit">Save profile</button></form></div>`);
  body.append(prof);
  $('form', prof).onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.intake_id = data.intake_id ? Number(data.intake_id) : null; data.dob = data.dob || null;
    for (const k of ['lead_source', 'status_reason', 'program_id', 'haa_student_id', 'start_date', 'expected_end_date', 'consent_recorded_on']) data[k] = data[k] || null;
    try { await api.adminSaveStudent(id, data); Object.assign(s, data); toast('Profile saved'); render(); openStudent(id); }
    catch (err) { toast(err.message, 'err'); }
  };

  // commission
  const cm = h(`<div class="card"><h3>HAA commission <span class="tag">internal</span></h3><form><div class="formgrid">
    <div class="field"><label>Expected (USD)</label><input name="expected_usd" type="number" step="0.01" value="${esc(com.expected_usd ?? '')}"></div>
    <div class="field"><label>Received (USD)</label><input name="received_usd" type="number" step="0.01" value="${esc(com.received_usd ?? '')}"></div>
    <div class="field"><label>Received on</label><input name="received_on" type="date" value="${esc(com.received_on || '')}"></div>
    <div class="field"><label>Quarter</label><input name="quarter" placeholder="e.g. 2027-Q1" value="${esc(com.quarter || '')}"></div>
    <div class="field"><label>Note</label><input name="note" value="${esc(com.note || '')}"></div>
    </div><button class="btn small ghost" type="submit">Save commission</button></form></div>`);
  if (isOwner()) body.append(cm);
  $('form', cm).onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    for (const k in data) if (data[k] === '') data[k] = null;
    try { const r = await api.adminSaveCommission(id, data); const i = db.commissions.findIndex(c => c.student_id === id); if (i >= 0) db.commissions[i] = { ...db.commissions[i], ...data }; else db.commissions.push(r); toast('Commission saved'); }
    catch (err) { toast(err.message, 'err'); }
  };

  // journey
  const keyed = byKey(p.steps);
  const jr = h(`<div class="card"><h3>Journey</h3><div class="subtabs"><button class="active" data-t="visa">Visa track</button><button data-t="departure">Departure</button><button data-t="onboard">Onboarding</button></div><div class="steps"></div></div>`);
  body.append(jr);
  const drawSteps = track => {
    const box = $('.steps', jr); box.innerHTML = '';
    let lastStage = null;
    p.steps.filter(x => x.track === track).forEach(st => {
      if (track !== 'onboard' && st.stage !== lastStage) { lastStage = st.stage; const info = STAGES[track][st.stage - 1]; box.append(h(`<h4 style="margin:16px 0 4px;color:var(--navy)">${st.stage}. ${esc(info?.name || '')} <span class="muted small">${esc(info?.sub || '')}</span></h4>`)); }
      box.append(adminStepRow(id, st));
    });
  };
  jr.querySelector('.subtabs').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; $$('.subtabs button', jr).forEach(x => x.classList.toggle('active', x === b)); drawSteps(b.dataset.t); };
  drawSteps('visa');

  const act = h(`<div class="card"><h3>Activity</h3><div class="small muted">Loading…</div></div>`);
  body.append(act);
  try {
    const log = await api.adminActivity(id);
    act.lastElementChild.innerHTML = log.map(l => `<div style="padding:4px 0;border-top:1px solid var(--line)"><span class="muted">${fmtDateTime(l.at)}</span> · <b>${esc(l.actor)}</b> ${esc(l.action)}${l.detail?.status ? ` → ${esc(l.detail.status)}` : ''}</div>`).join('') || 'No activity yet';
  } catch { act.lastElementChild.textContent = 'Could not load activity'; }

  function adminStepRow(sid, st) {
    const row = h(`<div class="adm-step st-${st.status}">
      <div class="t"><b>${esc(st.title)}</b> ${st.optional ? '<span class="tag">optional</span>' : ''}<small>${{ student: 'Student ticks', sac: 'SAC updates', both: 'Student or SAC' }[st.actor]}${st.needs_verify ? ' · needs your verification' : ''}</small></div>
      <select data-f="status">${opts(Object.entries(STATUS_LABEL).map(([k, l]) => [k, k === 'pending' ? 'Pending (verify)' : l]), st.status, null)}</select>
      <input type="date" data-f="done_at" value="${esc(st.done_at || '')}" title="Completed on">
      <div class="data"></div><div class="row-actions"></div></div>`);
    const data = $('.data', row);
    st.fields.forEach(f => {
      const v = st.data?.[f.k];
      let inp;
      if (f.t === 'check') inp = `<label class="check" style="padding:6px 8px"><input type="checkbox" data-k="${f.k}" ${v ? 'checked' : ''}><span>${esc(f.l)}</span></label>`;
      else if (f.t === 'select') inp = `<div class="field"><label>${esc(f.l)}</label><select data-k="${f.k}">${opts((f.o || []).map(o => [o, o]), v, '—')}</select></div>`;
      else if (f.t === 'doctor') inp = `<div class="field"><label>${esc(f.l)}</label><select data-k="${f.k}">${opts(db.doctors.filter(x => x.grp === f.o[0]).map(x => [x.id, x.name]), v, '—')}</select></div>`;
      else inp = `<div class="field"><label>${esc(f.l)}</label><input type="${f.t === 'date' ? 'date' : f.t === 'datetime' ? 'datetime-local' : 'text'}" data-k="${f.k}" value="${esc(v || '')}"></div>`;
      data.append(h(inp));
    });
    const ra = $('.row-actions', row);
    if (st.status === 'pending') ra.append(h(`<button class="btn small" data-verify>✓ Verify</button>`));
    ra.append(h(`<button class="btn ghost small" data-save>Save</button>`));
    row.onclick = async e => {
      const verify = e.target.closest('[data-verify]'), save = e.target.closest('[data-save]');
      if (!verify && !save) return;
      const patch = { data: {} };
      $$('[data-k]', row).forEach(i => { patch.data[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value; });
      patch.data = { ...st.data, ...patch.data };
      patch.status = verify ? 'done' : $('[data-f="status"]', row).value;
      patch.done_at = $('[data-f="done_at"]', row).value || (patch.status === 'done' ? (patch.data.date || new Date().toISOString().slice(0, 10)) : null);
      if (patch.status === 'todo') patch.done_at = null;
      try {
        await api.adminSaveStep(sid, st.key, patch);
        const r = db.student_steps.find(x => x.student_id === sid && x.step_key === st.key);
        if (r) Object.assign(r, patch); else db.student_steps.push({ student_id: sid, step_key: st.key, ...patch });
        stu(sid).last_activity_at = new Date().toISOString();
        if (st.key === 'visa_result' && patch.data.result === 'Refused' && stu(sid).status === 'active') toast('Tip: set status to "Visa refused" in Profile if they are deciding', 'ok');
        toast(verify ? 'Verified ✓' : 'Saved');
        Object.assign(st, patch);
        row.replaceWith(adminStepRow(sid, st));
        render();
      } catch (err) { toast(err.message, 'err'); }
    };
    return row;
  }
}

// ---------------- settings ----------------
const SETTINGS = {
  programs: { label: 'Programs', pk: 'id', cols: [['name', 'Name'], ['short_name', 'Short'], ['category', 'Category'], ['tuition_usd', 'Tuition USD', 'num'], ['pofc_usd', 'Proof of funds USD', 'num'], ['active', 'Active', 'bool'], ['visa_type', 'Visa', 'ro']] },
  intakes: { label: 'Intakes', pk: 'id', add: true, cols: [['label', 'Label'], ['start_month', 'Start (1st of month)', 'date'], ['status', 'Status'], ['note', 'Note to students'], ['recommended', 'Recommended', 'bool'], ['active', 'Show', 'bool']] },
  fees: { label: 'Fees', pk: 'key', cols: [['label', 'Fee'], ['amount', 'Amount', 'num'], ['currency', 'Cur.'], ['payee', 'Paid to'], ['refundable', 'Refundable', 'bool'], ['note', 'Note']] },
  doctors: { label: 'CAAN doctors', pk: 'id', add: true, cols: [['grp', 'Group', 'grp'], ['name', 'Name'], ['address', 'Address'], ['phone', 'Phone'], ['email', 'Email'], ['active', 'Show', 'bool']] },
  settings: { label: 'General', pk: 'key', cols: [['label', 'Setting', 'ro'], ['value', 'Value']] },
  guide: { label: 'HAA guide', custom: true },
};
let setTab = 'intakes';
function renderSettings(v) {
  const c = h(`<div class="card"><h3>Settings</h3><p class="muted small">Changes show to students immediately. Fees, intakes and doctors change often — keep them current.</p>
    <div class="subtabs">${Object.entries(SETTINGS).map(([k, s]) => `<button data-st="${k}" class="${k === setTab ? 'active' : ''}">${s.label}</button>`).join('')}</div><div class="tablewrap"></div></div>`);
  v.append(c);
  $('.subtabs', c).onclick = e => { const b = e.target.closest('[data-st]'); if (b) { setTab = b.dataset.st; render(); } };
  const cfg = SETTINGS[setTab];
  if (cfg.custom) { $('.tablewrap', c)?.remove(); renderGuide(v); return; }
  const tbl = h(`<table class="tbl"><thead><tr>${cfg.cols.map(x => `<th>${x[1]}</th>`).join('')}<th></th></tr></thead><tbody></tbody></table>`);
  $('.tablewrap', c).append(tbl);
  const cell = (col, val) => {
    const [k, , t] = col;
    if (t === 'bool') return `<input type="checkbox" data-c="${k}" ${val ? 'checked' : ''} style="width:auto">`;
    if (t === 'ro') return `<b>${esc(val)}</b>`;
    if (t === 'grp') return `<select data-c="${k}">${opts(Object.entries(DOCTOR_GROUPS), val, null)}</select>`;
    return `<input data-c="${k}" type="${t === 'num' ? 'number' : t === 'date' ? 'date' : 'text'}" ${t === 'num' ? 'step="0.01"' : ''} value="${esc(val ?? '')}">`;
  };
  const rows = [...db[setTab]].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.start_month || a.grp || '').localeCompare(String(b.start_month || b.grp || '')));
  rows.forEach(r => $('tbody', tbl).append(h(`<tr data-pk="${esc(r[cfg.pk])}">${cfg.cols.map(col => `<td>${cell(col, r[col[0]])}</td>`).join('')}<td><button class="btn small ghost" data-save>Save</button></td></tr>`)));
  if (cfg.add) $('tbody', tbl).append(h(`<tr data-new>${cfg.cols.map(col => `<td>${col[2] === 'ro' ? '' : cell(col, col[2] === 'bool' ? true : '')}</td>`).join('')}<td><button class="btn small" data-save>Add</button></td></tr>`));
  const read = tr => { const o = {}; $$('[data-c]', tr).forEach(i => { const t = cfg.cols.find(x => x[0] === i.dataset.c)[2]; o[i.dataset.c] = t === 'bool' ? i.checked : t === 'num' ? (i.value === '' ? null : Number(i.value)) : (i.value === '' ? null : i.value); }); return o; };
  tbl.onclick = async e => {
    const b = e.target.closest('[data-save]'); if (!b) return;
    const tr = b.closest('tr'), row = read(tr);
    try {
      if (tr.dataset.new !== undefined) {
        if (!row[cfg.cols[0][0]] && !row.name) { toast('Fill the row first', 'err'); return; }
        const r = await api.adminAddRow(setTab, row); db[setTab].push(r); toast('Added'); render();
      } else {
        const pk = tr.dataset.pk; await api.adminSaveRow(setTab, cfg.pk, pk, row);
        Object.assign(db[setTab].find(x => String(x[cfg.pk]) === pk), row); toast('Saved');
      }
    } catch (err) { toast(err.message, 'err'); }
  };
}

await start();
