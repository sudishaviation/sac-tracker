// One API for all pages. Uses Supabase when config.js has keys,
// otherwise runs a self-contained DEMO with sample students.
import { CONFIG } from './config.js';
import { buildPayload, isoDate } from './core.js';

export const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY;

const MESSAGES = {
  INVALID_LOGIN: 'Student ID or PIN is incorrect.',
  LOCKED: 'Too many wrong attempts. Please try again in 15 minutes, or contact SAC.',
  SESSION_EXPIRED: 'Your session has ended. Please log in again.',
  ACK_REQUIRED: 'Please accept the terms first.',
  NOT_ALLOWED: 'This step is updated by SAC.',
  ALREADY_VERIFIED: 'SAC has already confirmed this step.',
  INVALID_LINK: 'This link is not valid any more. Ask the student or SAC for a new one.',
};
function friendly(err) {
  const raw = (err && (err.message || err.error_description || err.error)) || String(err);
  const code = Object.keys(MESSAGES).find(k => raw.includes(k));
  const e = new Error(code ? MESSAGES[code] : raw); e.code = code; return e;
}

let api;
export async function getApi() {
  if (api) return api;
  api = DEMO ? demoApi() : await supabaseApi();
  return api;
}

// ---------------------------------------------------------------------
async function supabaseApi() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { auth: { persistSession: true } });
  const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw friendly(error); return data; };
  const q = async promise => { const { data, error } = await promise; if (error) throw friendly(error); return data; };

  return {
    studentLogin: async (code, pin) => { const r = await rpc('student_login', { p_code: code, p_pin: pin }); if (r.error) throw friendly(r.error); return r; },
    studentPortal: token => rpc('student_portal', { p_token: token }),
    studentAck: token => rpc('student_acknowledge', { p_token: token }),
    studentUpdate: (token, key, done, data) => rpc('student_update_step', { p_token: token, p_step: key, p_done: done, p_data: data }),
    studentLogout: token => rpc('student_logout', { p_token: token }).catch(() => {}),
    parentView: token => rpc('parent_view', { p_token: token }),

    adminSignIn: async (email, password) => {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw friendly(error);
      if (!(await rpc('my_role'))) { await sb.auth.signOut(); throw new Error('This account is not an active SAC team member.'); }
    },
    // Returns { email, role } where role is 'owner' or 'counsellor', or null when not signed in.
    adminSession: async () => {
      const { data } = await sb.auth.getSession(); if (!data.session) return null;
      try { const role = await rpc('my_role'); return role ? { email: data.session.user.email, role } : null; } catch { return null; }
    },
    adminSignOut: () => sb.auth.signOut(),
    adminLoadAll: async (role = 'owner') => {
      if (role === 'owner') {
        const tables = ['students', 'student_steps', 'step_templates', 'programs', 'intakes', 'fees', 'doctors', 'settings', 'commissions'];
        const res = await Promise.all(tables.map(t => q(sb.from(t).select('*'))));
        return Object.fromEntries(tables.map((t, i) => [t, res[i]]));
      }
      // Counsellors: students come through a function without PIN data; commission is never loaded.
      const tables = ['student_steps', 'step_templates', 'programs', 'intakes', 'fees', 'doctors', 'settings'];
      const [students, ...res] = await Promise.all([rpc('staff_students'), ...tables.map(t => q(sb.from(t).select('*')))]);
      return { students: students || [], commissions: [], ...Object.fromEntries(tables.map((t, i) => [t, res[i]])) };
    },
    // ---- Knowledge Hub ----
    kbLoad: async () => {
      const [qa, facts] = await Promise.all([
        q(sb.from('kb_qa_rendered').select('id,slug,question,variants,category,audience,channels,status,needs_review,review_reason,answer_short_rendered,answer_long_rendered,source_refs,updated_at').neq('status', 'retired').order('category').order('question')),
        q(sb.from('kb_all_facts').select('*')),
      ]);
      return { qa, facts };
    },
    kbRemarks: () => q(sb.from('kb_remarks').select('*').order('created_at', { ascending: false }).limit(200)),
    kbAddRemark: r => q(sb.from('kb_remarks').insert(r).select().single()),
    kbResolveRemark: (id, status, owner_reply) => q(sb.from('kb_remarks').update({ status, owner_reply, resolved_at: new Date().toISOString() }).eq('id', id).select().single()),
    kbLogEnquiry: r => q(sb.from('kb_enquiries').insert(r).select().single()),
    kbEnquiries: () => q(sb.from('kb_enquiries').select('*').order('received_at', { ascending: false }).limit(200)),
    adminActivity: id => q(sb.from('activity_log').select('*').eq('student_id', id).order('at', { ascending: false }).limit(25)),
    adminCreateStudent: s => rpc('admin_create_student', { p_full_name: s.full_name, p_email: s.email, p_phone: s.phone, p_dob: s.dob || null, p_program_id: s.program_id, p_intake_id: Number(s.intake_id), p_lead_source: s.lead_source, p_visa_type: s.visa_type || null, p_stage: s.stage || 'new', p_haa_student_id: s.haa_student_id || null, p_start_date: s.start_date || null, p_expected_end: s.expected_end_date || null, p_consent_on: s.consent_recorded_on || null }),
    adminResetPin: id => rpc('admin_reset_pin', { p_student: id }),
    adminResetParentLink: id => rpc('admin_reset_parent_link', { p_student: id }),
    adminPurge: () => rpc('admin_purge_expired'),
    adminSaveStudent: (id, patch) => q(sb.from('students').update(patch).eq('id', id)),
    adminSaveStep: (student_id, step_key, patch) => q(sb.from('student_steps').upsert({ student_id, step_key, ...patch, updated_by: 'sac', updated_at: new Date().toISOString() }).select().single()),
    adminSaveCommission: (student_id, patch) => q(sb.from('commissions').upsert({ student_id, ...patch }).select().single()),
    adminSaveRow: (table, pk, val, patch) => q(sb.from(table).update(patch).eq(pk, val).select().single()),
    adminAddRow: (table, row) => q(sb.from(table).insert(row).select().single()),
  };
}

// ---------------------------------------------------------------------
// DEMO mode: sample data kept in this browser only.
function demoApi() {
  const KEY = 'sac-demo-db-v1';
  let db;
  const load = async () => {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
    if (!db) { const m = await import('./demo-data.js'); db = structuredClone(m.DEMO_DB); }
    return db;
  };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* private mode */ } };
  const sessions = JSON.parse(sessionStorage.getItem('sac-demo-sessions') || '{}');
  const saveSessions = () => sessionStorage.setItem('sac-demo-sessions', JSON.stringify(sessions));
  const sid = token => { const id = sessions[token]; if (!id) throw friendly('SESSION_EXPIRED'); return id; };
  const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[b % 31]).join('');
  const now = () => new Date().toISOString();
  let adminEmail = sessionStorage.getItem('sac-demo-admin');

  return {
    demo: true,
    reset: () => { localStorage.removeItem(KEY); db = null; },
    studentLogin: async (code, pin) => {
      await load();
      const s = db.students.find(x => x.code === code.trim().toUpperCase());
      if (!s || s._pin !== pin.trim()) throw friendly('INVALID_LOGIN');
      const token = rnd(20); sessions[token] = s.id; saveSessions();
      return { token, portal: buildPayload(db, s.id, 'student') };
    },
    studentPortal: async token => { await load(); return buildPayload(db, sid(token), 'student'); },
    studentAck: async token => { await load(); const s = db.students.find(x => x.id === sid(token)); s.ack_terms_at = s.ack_consent_at = now(); persist(); return buildPayload(db, s.id, 'student'); },
    studentUpdate: async (token, key, done, data) => {
      await load(); const id = sid(token);
      const t = db.step_templates.find(x => x.key === key);
      if (!['student', 'both'].includes(t.actor)) throw friendly('NOT_ALLOWED');
      let row = db.student_steps.find(r => r.student_id === id && r.step_key === key);
      if (!row) { row = { student_id: id, step_key: key, status: 'todo', data: {} }; db.student_steps.push(row); }
      if (row.status === 'done' && t.needs_verify) throw friendly('ALREADY_VERIFIED');
      const allowed = Object.fromEntries(Object.entries(data || {}).filter(([k]) => t.fields.some(f => f.k === k)));
      row.data = { ...row.data, ...allowed };
      row.status = done ? (t.needs_verify ? 'pending' : 'done') : 'todo';
      row.done_at = done ? (row.data.date || isoDate(new Date())) : null;
      row.updated_by = 'student'; row.updated_at = now();
      db.students.find(x => x.id === id).last_activity_at = now();
      persist();
      return buildPayload(db, id, 'student');
    },
    studentLogout: async token => { delete sessions[token]; saveSessions(); },
    parentView: async token => { await load(); const s = db.students.find(x => x.parent_token === token && x.status !== 'withdrawn'); if (!s) throw friendly('INVALID_LINK'); return buildPayload(db, s.id, 'parent'); },

    adminSignIn: async email => { adminEmail = email || 'demo@sac'; sessionStorage.setItem('sac-demo-admin', adminEmail); },
    adminSession: async () => (adminEmail ? { email: adminEmail, role: 'owner' } : null),
    kbLoad: async () => ({ qa: [], facts: [] }),
    kbRemarks: async () => [],
    kbAddRemark: async r => r,
    kbResolveRemark: async () => ({}),
    kbLogEnquiry: async r => r,
    kbEnquiries: async () => [],
    adminSignOut: async () => { adminEmail = null; sessionStorage.removeItem('sac-demo-admin'); },
    adminLoadAll: async () => structuredClone(await load()),
    adminActivity: async () => [{ at: now(), actor: 'demo', action: 'Activity log is recorded in the live version' }],
    adminCreateStudent: async s => {
      await load();
      const id = crypto.randomUUID(), code = 'SAC-' + rnd(5), pin = String(Math.floor(100000 + Math.random() * 900000)), parent_token = rnd(24).toLowerCase();
      db.students.push({ id, code, _pin: pin, parent_token, full_name: s.full_name, email: s.email, phone: s.phone, dob: s.dob || null, program_id: s.program_id, intake_id: Number(s.intake_id), lead_source: s.lead_source, visa_type: s.visa_type || (db.programs.find(x => x.id === s.program_id)?.visa_type) || 'F-1', haa_student_id: s.haa_student_id || null, start_date: s.start_date || null, expected_end_date: s.expected_end_date || null, consent_recorded_on: s.consent_recorded_on || null, status: ({ visa_granted: 'visa_granted', studying: 'studying' })[s.stage] || 'active', status_reason: null, ack_terms_at: null, ack_consent_at: null, internal_notes: '', created_at: now(), last_activity_at: now() });
      db.step_templates.forEach(t => { const done = t.key === 'program_intake' || (!t.optional && (s.stage === 'studying' || (s.stage === 'visa_granted' && t.track !== 'departure' && t.key !== 'sac_fee_2'))); db.student_steps.push({ student_id: id, step_key: t.key, status: done ? 'done' : 'todo', data: {}, done_at: done ? isoDate(new Date()) : null }); });
      db.commissions.push({ student_id: id });
      persist(); return { id, code, pin, parent_token };
    },
    adminResetPin: async id => { await load(); const s = db.students.find(x => x.id === id); s._pin = String(Math.floor(100000 + Math.random() * 900000)); persist(); return s._pin; },
    adminResetParentLink: async id => { await load(); const s = db.students.find(x => x.id === id); s.parent_token = rnd(24).toLowerCase(); persist(); return s.parent_token; },
    adminPurge: async () => 0,
    adminSaveStudent: async (id, patch) => { await load(); const s = db.students.find(x => x.id === id); Object.assign(s, patch); persist(); return s; },
    adminSaveStep: async (student_id, step_key, patch) => {
      await load(); let r = db.student_steps.find(x => x.student_id === student_id && x.step_key === step_key);
      if (!r) { r = { student_id, step_key, data: {} }; db.student_steps.push(r); }
      Object.assign(r, patch, { updated_by: 'sac', updated_at: now() });
      db.students.find(x => x.id === student_id).last_activity_at = now();
      persist(); return r;
    },
    adminSaveCommission: async (student_id, patch) => { await load(); let r = db.commissions.find(x => x.student_id === student_id); if (!r) { r = { student_id }; db.commissions.push(r); } Object.assign(r, patch); persist(); return r; },
    adminSaveRow: async (table, pk, val, patch) => { await load(); const r = db[table].find(x => String(x[pk]) === String(val)); Object.assign(r, patch); persist(); return r; },
    adminAddRow: async (table, row) => { await load(); if (table === 'intakes' || table === 'doctors') row.id = Math.max(0, ...db[table].map(x => x.id)) + 1; db[table].push(row); persist(); return row; },
  };
}
