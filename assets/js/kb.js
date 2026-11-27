// Knowledge Hub: one place for counsellors to find SAC's approved answers
// while on a call or chat, log the enquiry, and send corrections to the owner.
import { $, $$, h, esc, toast, copy, fmtDateTime } from './core.js';

const CHANNELS = [['phone', 'Phone call'], ['whatsapp', 'WhatsApp'], ['tidio', 'Website chat (Tidio)'], ['email', 'Email'], ['walk_in', 'Walk-in'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['other', 'Other']];
const ASKERS = [['student', 'Student'], ['parent', 'Parent / sponsor'], ['operator', 'Operator / business'], ['haa', 'HAA'], ['other', 'Other']];
const OUTCOMES = [['answered', 'Answered'], ['gap', 'Not in the Hub (new question)'], ['escalated', 'Passed to Suraj'], ['open', 'Follow-up needed'], ['converted', 'Became a student'], ['closed', 'Closed']];
const CATS = { cpl: 'Pilot training (CPL)', caan: 'CAAN & licensing', compass: 'COMPASS test', visa_work: 'Visa & work (CPT/OPT)', costs: 'Costs & fees', ame: 'AME & engineering', sac_policy: 'About SAC' };

let state = { tab: 'answers', q: '', cat: '', scope: '', verifiedOnly: false };
let cache = null;

const opts = (list, val, blank) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') + list.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(val ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');

// Turn [text](url) and bare links into safe clickable links; keep line breaks.
function richText(s) {
  let t = esc(s || '');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`);
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  return t;
}
const plain = s => (s || '').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2');

function scopeOf(r) {
  const c = r.channels || [];
  if (c.includes('website') || c.includes('tidio')) return { k: 'public', label: 'Public', cls: 'active' };
  if (c.includes('counselling')) return { k: 'counselling', label: 'Counsellors only', cls: 'deferred' };
  return { k: 'internal', label: 'Internal', cls: 'withdrawn' };
}

export async function renderKnowledge(v, api, ctx) {
  const owner = ctx.role === 'owner';
  v.append(h(`<div class="card"><div class="toolbar" style="align-items:center">
      <h3 style="margin:0;flex:1">Knowledge Hub</h3>
      <div class="subtabs" id="kbTabs" style="margin:0">
        <button data-k="answers">Answers</button>
        <button data-k="log">Log an enquiry</button>
        <button data-k="remarks">Remarks</button>
        <button data-k="enquiries">Enquiry log</button>
        ${owner ? '<button data-k="facts">Facts</button><button data-k="export">Export</button>' : ''}
      </div></div>
      <p class="muted small" style="margin:6px 0 0">Answer callers from here, not from memory. <b>Verified</b> answers are approved by Suraj. <b>Not yet verified</b> answers may be out of date — check with Suraj before quoting them. Spot a mistake? Press <b>Remark</b>.</p></div>`));
  const body = h('<div></div>'); v.append(body);
  $('#kbTabs', v).onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; state.tab = b.dataset.k; draw(); };

  if (!cache) {
    body.innerHTML = '<div class="card muted">Loading answers…</div>';
    try { cache = await api.kbLoad(); } catch (err) { body.innerHTML = `<div class="card notice err">${esc(err.message)}</div>`; return; }
  }

  function draw() {
    $$('#kbTabs button', v).forEach(b => b.classList.toggle('active', b.dataset.k === state.tab));
    body.innerHTML = '';
    ({ answers: drawAnswers, log: () => drawLog(), remarks: drawRemarks, enquiries: drawEnquiries, facts: drawFacts, export: drawExport })[state.tab]();
  }

  // ---------- answers ----------
  function drawAnswers() {
    const bar = h(`<div class="card"><div class="toolbar">
      <input id="kbq" placeholder="Search a question or keyword… e.g. CPT, NOC, medical, cost" style="flex:1;min-width:240px" value="${esc(state.q)}">
      <select id="kbcat">${opts(Object.entries(CATS), state.cat, 'All topics')}</select>
      <select id="kbscope">${opts([['public', 'Public answers'], ['counselling', 'Counsellors only'], ...(owner ? [['internal', 'Internal']] : [])], state.scope, 'All answers')}</select>
      <label class="check" style="padding:6px 8px"><input type="checkbox" id="kbver" ${state.verifiedOnly ? 'checked' : ''}><span>Verified only</span></label>
      </div><div class="muted small" id="kbcount"></div></div>`);
    const list = h('<div></div>');
    body.append(bar, list);
    const words = s => s.toLowerCase().split(/\s+/).filter(Boolean);
    const render = () => {
      state.q = $('#kbq', bar).value; state.cat = $('#kbcat', bar).value; state.scope = $('#kbscope', bar).value; state.verifiedOnly = $('#kbver', bar).checked;
      const ws = words(state.q);
      const rows = cache.qa.filter(r => (!state.cat || r.category === state.cat) && (!state.scope || scopeOf(r).k === state.scope) && (!state.verifiedOnly || r.status === 'approved'))
        .map(r => {
          if (!ws.length) return { r, score: r.status === 'approved' ? 1 : 0 };
          const qtext = [r.question, ...(r.variants || [])].join(' ').toLowerCase();
          const atext = `${r.answer_short_rendered || ''} ${r.answer_long_rendered || ''}`.toLowerCase();
          let score = 0;
          for (const w of ws) { if (qtext.includes(w)) score += 3; else if (atext.includes(w)) score += 1; else return null; }
          if (r.status === 'approved') score += 0.5;
          return { r, score };
        }).filter(Boolean).sort((a, b) => b.score - a.score);
      $('#kbcount', bar).textContent = `${rows.length} answer${rows.length === 1 ? '' : 's'}${ws.length ? ' — best matches first' : ''}`;
      list.innerHTML = '';
      rows.slice(0, 60).forEach(({ r }) => list.append(answerCard(r)));
      if (rows.length > 60) list.append(h(`<div class="muted small" style="padding:8px">Showing the first 60 — narrow your search.</div>`));
      if (!rows.length) list.append(h(`<div class="card"><b>No answer found.</b><p class="muted small">Don't guess. Tell the caller you will confirm and get back to them, then log it as a new question.</p><button class="btn small" data-newq>Log as a new question</button></div>`));
    };
    let t; $('#kbq', bar).oninput = () => { clearTimeout(t); t = setTimeout(render, 150); };
    $('#kbcat', bar).onchange = render; $('#kbscope', bar).onchange = render; $('#kbver', bar).onchange = render;
    list.onclick = e => { if (e.target.closest('[data-newq]')) { state.tab = 'log'; drawLogWith({ question_text: state.q, outcome: 'gap' }); } };
    render(); $('#kbq', bar).focus();
  }

  function answerCard(r) {
    const sc = scopeOf(r), ver = r.status === 'approved';
    const c = h(`<div class="card" style="padding:14px 16px">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <b style="flex:1;min-width:220px;color:var(--navy)">${esc(r.question)}</b>
        <span class="pill ${sc.cls}">${sc.label}</span>
        <span class="pill ${ver ? 'studying' : 'deferred'}">${ver ? 'Verified' : 'Not yet verified'}</span>
        ${r.needs_review ? `<span class="pill visa_refused" title="${esc(r.review_reason || '')}">Under review</span>` : ''}
      </div>
      <div style="margin-top:8px;white-space:pre-line">${richText(r.answer_short_rendered)}</div>
      ${r.answer_long_rendered ? `<details style="margin-top:8px"><summary class="small" style="cursor:pointer;color:var(--navy)">Full answer</summary><div class="small" style="margin-top:6px;white-space:pre-line">${richText(r.answer_long_rendered)}</div></details>` : ''}
      ${!ver ? '<div class="notice warn small" style="margin-top:8px">Not yet verified by Suraj — confirm before quoting figures or rules.</div>' : ''}
      <div class="actions" style="margin-top:10px">
        <button class="btn small ghost" data-c="short">Copy for chat</button>
        ${r.answer_long_rendered ? '<button class="btn small ghost" data-c="long">Copy full answer</button>' : ''}
        <button class="btn small ghost" data-c="log">Log this enquiry</button>
        <button class="btn small ghost" data-c="remark">Remark</button>
      </div><div class="rbox"></div></div>`);
    c.onclick = e => {
      const a = e.target.closest('[data-c]')?.dataset.c; if (!a) return;
      if (a === 'short') copy(plain(r.answer_short_rendered), 'Copied');
      if (a === 'long') copy(plain(r.answer_long_rendered), 'Full answer copied');
      if (a === 'log') { state.tab = 'log'; drawLogWith({ question_text: r.question, matched_qa_id: r.id, outcome: 'answered' }); }
      if (a === 'remark') remarkForm($('.rbox', c), r);
    };
    return c;
  }

  function remarkForm(box, r) {
    if (box.firstChild) { box.innerHTML = ''; return; }
    const f = h(`<form style="margin-top:10px"><div class="field"><label>What is wrong or missing?</label><textarea name="remark" rows="2" required placeholder="e.g. Student asked about X and this answer doesn't cover it / fee has changed"></textarea></div>
      <div class="field"><label>Suggested answer (optional)</label><textarea name="suggested_answer" rows="3"></textarea></div>
      <button class="btn small" type="submit">Send to Suraj</button></form>`);
    f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      try { await api.kbAddRemark({ qa_id: r.id, remark: d.remark, suggested_answer: d.suggested_answer || null, author_name: ctx.email || null }); toast('Remark sent — thank you'); box.innerHTML = ''; }
      catch (err) { toast(err.message, 'err'); }
    };
    box.append(f);
  }

  // ---------- log an enquiry ----------
  function drawLog() { drawLogWith({}); }
  function drawLogWith(pre) {
    $$('#kbTabs button', v).forEach(b => b.classList.toggle('active', b.dataset.k === 'log'));
    body.innerHTML = '';
    const studentOpts = opts((ctx.students || []).map(s => [s.id, `${s.full_name} (${s.code})`]), pre.student_id, '— not a registered student —');
    const qaOpts = opts(cache.qa.map(r => [r.id, r.question.slice(0, 110)]), pre.matched_qa_id, '— none / not found —');
    const f = h(`<div class="card" style="max-width:760px"><h3>Log an enquiry</h3>
      <p class="muted small">Takes 20 seconds. This is how we learn which questions come up most and which answers are missing.</p>
      <form><div class="formgrid">
        <div class="field" style="grid-column:1/-1"><label>What did they ask? *</label><textarea name="question_text" rows="2" required>${esc(pre.question_text || '')}</textarea></div>
        <div class="field"><label>Channel *</label><select name="channel" required>${opts(CHANNELS, pre.channel || 'phone', null)}</select></div>
        <div class="field"><label>Who asked?</label><select name="asker_type">${opts(ASKERS, 'student', null)}</select></div>
        <div class="field"><label>Name</label><input name="asker_name"></div>
        <div class="field"><label>Phone / email</label><input name="asker_contact"></div>
        <div class="field" style="grid-column:1/-1"><label>Registered student</label><select name="student_id">${studentOpts}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Answer used</label><select name="matched_qa_id">${qaOpts}</select></div>
        <div class="field"><label>Outcome *</label><select name="outcome" required>${opts(OUTCOMES, pre.outcome || 'answered', null)}</select></div>
        <div class="field"><label>How did they find us?</label><select name="lead_source">${opts(['Instagram', 'Facebook', 'Google Ads', 'Website', 'TikTok', 'Expo', 'Referral', 'Other'].map(x => [x, x]), '', '—')}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
      </div><button class="btn" type="submit">Save enquiry</button></form></div>`);
    body.append(f);
    $('form', f).onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      for (const k in d) if (d[k] === '') d[k] = null;
      if (d.matched_qa_id) d.matched_qa_id = Number(d.matched_qa_id);
      d.logged_by = ctx.email || null;
      try { await api.kbLogEnquiry(d); toast('Enquiry logged'); e.target.reset(); }
      catch (err) { toast(err.message, 'err'); }
    };
  }

  // ---------- remarks ----------
  async function drawRemarks() {
    const c = h(`<div class="card"><h3>Remarks & corrections</h3><p class="muted small">${owner ? 'Counsellors\' notes on answers. Accept means you will update the answer (ask Claude to apply it); reject with a short reply.' : 'Your notes to Suraj on answers, and his replies.'}</p><div class="muted small">Loading…</div></div>`);
    body.append(c);
    try {
      const rows = await api.kbRemarks();
      const qn = id => cache.qa.find(r => r.id === id)?.question || '(answer not visible)';
      c.lastElementChild.remove();
      if (!rows.length) { c.append(h('<p class="muted">No remarks yet.</p>')); return; }
      rows.forEach(r => {
        const it = h(`<div style="padding:10px 0;border-top:1px solid var(--line)">
          <div style="display:flex;gap:8px;flex-wrap:wrap"><b style="flex:1">${esc(qn(r.qa_id))}</b><span class="pill ${r.status === 'open' ? 'deferred' : r.status === 'accepted' ? 'studying' : 'withdrawn'}">${esc(r.status)}</span></div>
          <div class="small" style="margin-top:4px">${esc(r.remark)}</div>
          ${r.suggested_answer ? `<div class="small muted" style="margin-top:4px;white-space:pre-line"><b>Suggested:</b> ${esc(r.suggested_answer)}</div>` : ''}
          ${r.owner_reply ? `<div class="small" style="margin-top:4px"><b>Suraj:</b> ${esc(r.owner_reply)}</div>` : ''}
          <div class="muted small">${esc(r.author_name || '')} · ${fmtDateTime(r.created_at)}</div>
          ${owner && r.status === 'open' ? `<div class="actions" style="margin-top:6px"><input placeholder="Reply (optional)" style="flex:1;min-width:180px"><button class="btn small" data-r="accepted">Accept</button><button class="btn small ghost" data-r="rejected">Reject</button></div>` : ''}</div>`);
        it.onclick = async e => {
          const b = e.target.closest('[data-r]'); if (!b) return;
          try { await api.kbResolveRemark(r.id, b.dataset.r, $('input', it).value || null); toast('Saved'); draw(); }
          catch (err) { toast(err.message, 'err'); }
        };
        c.append(it);
      });
    } catch (err) { c.lastElementChild.textContent = err.message; }
  }

  // ---------- enquiry log ----------
  async function drawEnquiries() {
    const c = h(`<div class="card"><h3>Enquiry log</h3><div class="muted small">Loading…</div></div>`);
    body.append(c);
    try {
      const rows = await api.kbEnquiries();
      const qn = id => cache.qa.find(r => r.id === id)?.question || '';
      const gaps = rows.filter(r => r.outcome === 'gap').length;
      c.lastElementChild.remove();
      c.append(h(`<p class="muted small">${rows.length} logged · <b>${gaps}</b> not covered by the Hub yet${owner && gaps ? ' — ask Claude to write answers for these' : ''}.</p>`));
      c.append(h(`<div class="tablewrap"><table class="tbl"><thead><tr><th>When</th><th>Channel</th><th>Question</th><th>Answer used</th><th>Outcome</th><th>By</th></tr></thead><tbody>${rows.map(r => `<tr><td class="small">${fmtDateTime(r.received_at)}</td><td>${esc(r.channel)}</td><td>${esc(r.question_text)}${r.asker_name ? `<br><small class="muted">${esc(r.asker_name)}</small>` : ''}</td><td class="small">${esc(qn(r.matched_qa_id))}</td><td>${esc((OUTCOMES.find(o => o[0] === r.outcome) || [, r.outcome])[1])}</td><td class="small">${esc(r.logged_by || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nothing logged yet.</td></tr>'}</tbody></table></div>`));
    } catch (err) { c.lastElementChild.textContent = err.message; }
  }

  // ---------- facts (owner) ----------
  function drawFacts() {
    const rows = [...cache.facts].sort((a, b) => String(a.category).localeCompare(String(b.category)) || a.key.localeCompare(b.key));
    const val = f => f.value_text ?? (f.value_num != null ? `${f.value_num}${f.unit ? ' ' + f.unit : ''}` : '—');
    body.append(h(`<div class="card"><h3>Facts used inside answers</h3><p class="muted small">Change a fact once (ask Claude) and every answer that uses it updates and is flagged for review.</p>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Fact</th><th>Value</th><th>Source</th><th>Checked</th><th>Public</th></tr></thead><tbody>${rows.map(f => `<tr><td>${esc(f.label)}<br><small class="mono muted">${esc(f.key)}</small></td><td><b>${esc(val(f))}</b></td><td class="small">${esc(f.source_ref || '')}</td><td class="small">${esc(f.verified_on || '—')}</td><td>${f.is_public ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody></table></div></div>`));
  }

  // ---------- export (owner) ----------
  function drawExport() {
    const c = h(`<div class="card" style="max-width:760px"><h3>Export for Tidio</h3>
      <p class="small">Downloads every answer published to Tidio (approved or draft, not under review, not retired) as a Question/Answer CSV — the format Tidio's <b>Upload CSV</b> accepts. Do this after each batch of changes, then replace the old CSV items in Tidio.</p>
      <div class="actions"><button class="btn" data-x>Download Tidio CSV</button></div><div class="muted small" id="xout"></div></div>`);
    body.append(c);
    $('[data-x]', c).onclick = async () => {
      try {
        const rows = await api.kbTidioExport();
        const cell = x => `"${String(x ?? '').replace(/"/g, '""')}"`;
        const csv = '\ufeff' + [['Question', 'Answer'], ...rows.map(r => [r.question, r.answer])].map(r => r.map(cell).join(',')).join('\r\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `SAC_Tidio_QA_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        $('#xout', c).textContent = `${rows.length} answers exported.`;
      } catch (err) { toast(err.message, 'err'); }
    };
  }

  draw();
}
