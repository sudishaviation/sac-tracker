// Renders the student / parent portal from a payload.
import {
  STAGES, STATUS_LABEL, DOCTOR_GROUPS, esc, h, $, $$, money, fmtDate, fmtDateTime, isComplete, byKey,
  trackSteps, currentStage, stageDone, departureUnlocked, expectation, studentCanEdit, nextAction,
  feeRows, studentWarnings, toast, copy, parentLink, reminderItems,
} from './core.js';

const SOCIAL_KEYS = { whatsapp: 'social_whatsapp', instagram: 'social_instagram', facebook: 'social_facebook', youtube: 'social_youtube', linkedin: 'social_linkedin' };

// "X paid" reads like a finished task on the Next-step card, so show it as an action: "Pay X".
// [label](https://…) in step help becomes a link (help text is written by SAC admins only)
const linkify = t => esc(t).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
const nextTitle = t => /^(.*\S) paid$/.test(t) ? 'Pay ' + t.replace(/ paid$/, '') : t;

export function renderPortal(root, p, opts = {}) {
  const editable = p.viewer === 'student' && opts.onSave;
  const state = root._state || (root._state = { tab: 'visa', open: {} });
  const steps = p.steps, keyed = byKey(steps);
  const vStage = currentStage(steps, 'visa');
  const stageInfo = STAGES.visa[Math.min(vStage, 7) - 1];
  const dUnlocked = departureUnlocked(steps);
  const na = nextAction(p);
  const prog = p.program || {}, intake = p.intake || {};

  root.innerHTML = '';
  if (opts.banner) root.append(h(opts.banner));
  root.append(h(`<section class="pass" aria-label="Your boarding pass">
    <div class="pass-main">
      <div class="pass-head"><span>BOARDING PASS</span><span>SAC <i>×</i> HAA</span></div>
      <div class="route">
        <div class="ap"><b>KTM</b><small>Kathmandu</small></div>
        <div class="route-line"><span class="dash"></span><span class="route-plane">✈</span><span class="dash"></span></div>
        <div class="ap"><b>HIO</b><small>Hillsboro, OR</small></div>
      </div>
      <div class="pass-grid">
        <div><label>Passenger</label><b>${esc(p.student.full_name)}</b></div>
        <div><label>Flight</label><b>${esc(prog.short_name || '—')}</b></div>
        <div><label>Intake</label><b>${esc(intake.label || '—')}</b></div>
        <div><label>Gate</label><b>${vStage > 7 ? 'Visa done' : `${vStage}/7 · ${esc(stageInfo.name)}`}</b></div>
      </div>
    </div>
    <div class="pass-stub">
      <label>Student ID</label><b class="mono">${esc(p.student.code)}</b>
      <div class="barcode" aria-hidden="true"></div>
      <small>${esc(prog.category || '')}${p.student.visa_type && !(prog.category || '').includes(p.student.visa_type) ? ` · ${esc(p.student.visa_type)}` : ''}</small>
    </div>
  </section>`));

  if (p.student.status && p.student.status !== 'active') {
    const label = { deferred: 'Your application is deferred.', withdrawn: 'Your application is withdrawn.', visa_refused: 'Visa refused — talk to SAC about your options.', completed: 'Journey complete. Welcome to HAA!', visa_granted: 'Visa granted. Next: departure steps and travel.', studying: 'You are studying at HAA. Keep this page for your records.' }[p.student.status];
    if (label) root.append(h(`<div class="notice info">${esc(label)}</div>`));
  }
  if (p.student.visa_type === 'M-1' && (p.settings || {}).m1_note) root.append(h(`<div class="notice info"><b>M-1 visa.</b> ${esc(p.settings.m1_note)}</div>`));
  studentWarnings(p).forEach(w => root.append(h(`<div class="notice warn">⚠️ ${esc(w.text)}</div>`)));

  // Next action
  let naHtml;
  if (na.mine) {
    naHtml = `<div class="next"><div class="next-label">${p.viewer === 'parent' ? 'Student’s next step' : 'Your next step'}</div>
      <div class="next-title">${esc(nextTitle(na.mine.title))}</div>
      <button class="btn small ghost" data-jump="${esc(na.mine.key)}">Go to step →</button></div>`;
  } else if (na.waiting) {
    const when = na.exp ? ` · expected by <b>${fmtDate(na.exp.to)}</b>` : '';
    const who = na.waiting.status === 'pending' ? 'Waiting for SAC to confirm' : 'Waiting on HAA / authorities';
    naHtml = `<div class="next wait"><div class="next-label">${who}</div>
      <div class="next-title">${esc(na.waiting.title)}</div><div class="muted">Nothing to do right now${when}.</div></div>`;
  } else {
    naHtml = `<div class="next done"><div class="next-label">All clear</div><div class="next-title">Everything is up to date 🎉</div></div>`;
  }
  root.append(h(naHtml));

  // Everything else still open (short list; first 5, rest behind a toggle)
  const rem = reminderItems(p);
  const mainKey = na.mine?.key;
  const booked = rem.booked;
  const bookedTitles = new Set(booked.map(b => b.title));
  const others = rem.todoSteps.filter(s => s.key !== mainKey && !bookedTitles.has(s.title));
  if (others.length || booked.length || rem.waiting.length) {
    // Most important first: booked dates, then open steps in journey order, then items waiting on SAC. Show 3.
    const items = [
      ...booked.map(b => `<li class="bk"><span>📅</span><div><b>${esc(b.title)}</b><small>${esc(b.dt ? fmtDateTime(b.date) : fmtDate(b.date))}</small></div></li>`),
      ...others.map(s => `<li><span>○</span><div><button class="linkish" data-jump="${esc(s.key)}">${esc(nextTitle(s.title))}</button></div></li>`),
      ...rem.waiting.map(s => `<li class="wt"><span>⏳</span><div>${esc(s.title)}<small>Waiting for SAC to confirm</small></div></li>`),
    ];
    const showAll = state.alsoAll, LIMIT = 3;
    const more = items.length > LIMIT ? `<button class="also-toggle ${showAll ? 'open' : ''}" data-also="1" aria-expanded="${showAll}"><span>${showAll ? 'Show fewer' : `Show all ${items.length} pending items`}</span><i class="chev">⌄</i></button>` : '';
    root.append(h(`<section class="also"><h4>${p.viewer === 'parent' ? 'Other things still open' : 'Also to do'} <span class="muted small">(${items.length})</span></h4><ul>${(showAll ? items : items.slice(0, LIMIT)).join('')}</ul>${more}</section>`));
  }

  // Flight path
  const fp = h(`<section class="flightpath" aria-label="Visa journey progress"><div class="fp-line"></div></section>`);
  STAGES.visa.forEach(s => {
    const cls = s.n < vStage ? 'done' : s.n === vStage ? 'now' : '';
    fp.append(h(`<button class="fp-node ${cls}" data-stage="${s.n}" title="${esc(s.sub)}">
      <span class="dot">${s.n < vStage ? '✓' : s.n}</span><span class="fp-name">${esc(s.name)}</span></button>`));
  });
  const pct = Math.min(100, ((Math.min(vStage, 8) - 1) / 6) * 100);
  fp.append(h(`<div class="fp-plane" style="left:calc(${Math.min(pct, 100)}% * 0.857 + 7.1%)">✈</div>`));
  root.append(fp);

  // Tabs
  const tabs = [['visa', 'Journey'], ['fees', 'Fees & payments']];
  if (p.viewer === 'student') tabs.push(['share', 'Parent link']);
  const tabBar = h(`<nav class="tabs" role="tablist"></nav>`);
  tabs.forEach(([k, l]) => tabBar.append(h(`<button role="tab" class="${state.tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`)));
  root.append(tabBar);
  const panel = h(`<section class="panel"></section>`);
  root.append(panel);

  if (state.tab === 'visa') {
    const ob = trackSteps(steps, 'onboard');
    if (state.obTop === undefined) state.obTop = ob.some(s => !isComplete(s));   // fixed for the session so the block never jumps
    const obDone = ob.every(isComplete);
    if (ob.length && state.obTop) panel.append(stageBlock('Before take-off', 'Community & free Pre-Flight Academy', ob, state.open.ob ?? true, obDone ? 'done' : 'now', 'ob'));
    STAGES.visa.forEach(s => {
      const list = trackSteps(steps, 'visa').filter(x => x.stage === s.n);
      if (!list.length) return;
      const st = stageDone(steps, 'visa', s.n) ? 'done' : s.n === vStage ? 'now' : s.n < vStage ? 'wait' : 'later';
      const open = state.open['v' + s.n] ?? (st === 'now');
      panel.append(stageBlock(`${s.n}. ${s.name}`, s.sub, list, open, st, 'v' + s.n));
    });
    // Departure (Nepal NOCs, medical) — same tab, locked until HAA's official acceptance
    panel.append(h(`<h3 class="subhead">Departure — medical &amp; NOCs</h3>`));
    if (!dUnlocked) {
      panel.append(h(`<div class="notice info">🔒 Opens after your <b>official acceptance</b> from HAA. Then you do your CAAN medical, CAAN NOC and Ministry of Education NOC — needed to transfer tuition from Nepal and to show immigration when you fly.</div>`));
    }
    const dStage = currentStage(steps, 'departure');
    STAGES.departure.forEach(s => {
      const list = trackSteps(steps, 'departure').filter(x => x.stage === s.n);
      if (!list.length) return;
      const st = stageDone(steps, 'departure', s.n) ? 'done' : (dUnlocked && s.n === dStage) ? 'now' : 'later';
      const open = state.open['d' + s.n] ?? (st === 'now');
      panel.append(stageBlock(`${s.n}. ${s.name}`, s.sub, list, open, st, 'd' + s.n, !dUnlocked));
    });
    if (ob.length && !state.obTop) panel.append(stageBlock('Community', 'SAC channels', ob, state.open.ob ?? false, obDone ? 'done' : 'now', 'ob'));
  } else if (state.tab === 'fees') {
    panel.append(feesBlock(p));
  } else if (state.tab === 'share') {
    const link = parentLink(p.student.parent_token);
    panel.append(h(`<div class="card">
      <h3>Share with your parents or sponsor</h3>
      <p>This private link lets them follow your progress, fees and payment status. They cannot change anything. Share it only with people you trust.</p>
      <div class="linkbox"><input readonly value="${esc(link)}"><button class="btn" data-copy="${esc(link)}">Copy link</button></div>
      <p class="muted small">Lost control of the link? Ask SAC to reset it.</p></div>`));
  }

  // Contact footer
  const st = p.settings || {};
  root.append(h(`<footer class="help-foot">Questions? Email <a href="mailto:${esc(st.contact_email)}">${esc(st.contact_email)}</a>${st.contact_phone ? ` · ${esc(st.contact_phone)}` : ''}.
    <br><span class="muted">Fees, intakes and timelines are indicative and can change — always confirm with SAC before paying.</span></footer>`));

  // ---------- events ----------
  root.onclick = async e => {
    if (e.target.closest('[data-also]')) { state.alsoAll = !state.alsoAll; return renderPortal(root, p, opts); }
    const t = e.target.closest('[data-tab],[data-stage-toggle],[data-jump],[data-stage],[data-copy],[data-act]');
    if (!t) return;
    if (t.dataset.tab) { state.tab = t.dataset.tab; renderPortal(root, p, opts); return; }
    if (t.dataset.copy) { copy(t.dataset.copy, 'Link copied'); return; }
    if (t.dataset.stageToggle) { const k = t.dataset.stageToggle; const blk = t.closest('.stage'); state.open[k] = !blk.classList.contains('open'); blk.classList.toggle('open'); return; }
    if (t.dataset.stage) { state.tab = 'visa'; state.open['v' + t.dataset.stage] = true; renderPortal(root, p, opts); $(`[data-stage-key="v${t.dataset.stage}"]`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (t.dataset.jump) {
      const s = keyed[t.dataset.jump];
      state.tab = 'visa';
      if (s.track !== 'onboard') state.open[(s.track === 'visa' ? 'v' : 'd') + s.stage] = true;
      renderPortal(root, p, opts);
      const el = $(`[data-step="${s.key}"]`, root); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.classList.add('flash');
      return;
    }
    if (t.dataset.act && editable) {
      const card = t.closest('[data-step]'); const key = card.dataset.step;
      const data = readFields(card);
      const act = t.dataset.act;
      if (act === 'edit') { (state.edit ||= {})[key] = true; renderPortal(root, p, opts); $(`[data-step="${key}"]`, root)?.scrollIntoView({ block: 'center' }); return; }
      if (state.edit) delete state.edit[key];
      if (act === 'done' || act === 'update' || act === 'state') {
        const missing = requiredMissing(keyed[key], data);
        if (missing) { toast(`Please fill: ${missing}`, 'err'); return; }
      }
      const done = act === 'undo' ? false : act === 'state' ? data.state === 'Done' : true;
      await save(key, done, data);
    }
  };
  root.onchange = async e => {
    const inp = e.target;
    if (!editable) return;
    const card = inp.closest('[data-step]'); if (!card) return;
    const s = keyed[card.dataset.step];
    if (inp.type === 'checkbox' && s.fields.every(f => f.t === 'check')) {
      const data = readFields(card);
      const all = s.fields.every(f => data[f.k]);
      await save(s.key, all, data);
    }
    if (inp.dataset.k && s.fields.find(f => f.k === inp.dataset.k)?.t === 'doctor') {
      const info = card.querySelector('.doc-info');
      const d = p.doctors.find(x => String(x.id) === inp.value);
      if (info) info.innerHTML = d ? doctorHtml(d) : '';
    }
  };

  async function save(key, done, data) {
    try {
      const np = await opts.onSave(key, done, data);
      renderPortal(root, np, opts);
      toast(done ? (keyed[key].needs_verify ? 'Sent to SAC for confirmation' : 'Nice! Step completed') : 'Saved');
    } catch (err) { toast(err.message || 'Could not save', 'err'); }
  }

  // ---------- builders ----------
  function stageBlock(title, sub, list, open, st, key, locked = false) {
    const doneN = list.filter(s => !s.optional && isComplete(s)).length, tot = list.filter(s => !s.optional).length;
    const blk = h(`<div class="stage ${open ? 'open' : ''} st-${st}" ${key ? `data-stage-key="${key}"` : ''}>
      <button class="stage-head" data-stage-toggle="${key || 'ob'}">
        <span class="stage-mark">${st === 'done' ? '✓' : st === 'now' ? '●' : st === 'wait' ? '⏳' : '○'}</span>
        <span class="stage-title"><b>${esc(title)}</b><small>${esc(sub)}</small></span>
        <span class="stage-count">${tot ? `${doneN}/${tot}` : ''}</span><span class="chev">⌄</span>
      </button><div class="stage-body"></div></div>`);
    const body = $('.stage-body', blk);
    list.forEach(s => body.append(stepCard(s, locked)));
    return blk;
  }

  function stepCard(s, locked) {
    const canEdit = editable && !locked && studentCanEdit(s) && p.student.status !== 'withdrawn';
    const fee = s.fee_key ? p.fees.find(f => f.key === s.fee_key) : null;
    const exp = expectation(s, keyed);
    const icon = s.status === 'done' ? '✓' : s.status === 'pending' ? '⏳' : s.status === 'na' ? '–' : '';
    const card = h(`<article class="step st-${s.status}" data-step="${esc(s.key)}">
      <div class="tick">${icon}</div>
      <div class="step-body">
        <div class="step-title">${esc(s.title)} ${s.optional ? '<span class="tag">optional</span>' : ''}
          ${s.status !== 'todo' ? `<span class="chip c-${s.status}">${STATUS_LABEL[s.status]}</span>` : ''}</div>
        ${s.help ? `<p class="help">${linkify(s.help)}</p>` : ''}
      </div></article>`);
    const body = $('.step-body', card);
    if (s.key === 'doc_financial' && p.program) body.append(h(`<p class="pofc">Your program requires proof of financial capability of <b>${money(p.program.pofc_usd, 'USD')}</b>.</p>`));
    if (fee) body.append(h(`<p class="fee">💳 ${money(s.key === 'tuition_transfer' ? p.program?.tuition_usd : fee.amount, fee.currency)} · paid to ${esc(fee.payee)} · ${fee.refundable ? 'refundable' : 'non-refundable'}${fee.note ? ` — ${esc(fee.note)}` : ''}</p>`));
    if (s.key === 'sac_fee_1' || s.key === 'sac_fee_2') body.append(h(`<p class="muted small">${esc(p.settings.sac_bank_info || '')}</p>`));
    if (s.key === 'haa_application' && p.settings.haa_application_url) body.append(h(`<p><a href="${esc(p.settings.haa_application_url)}" target="_blank" rel="noopener">Open HAA application ↗</a></p>`));
    if (s.key === 'moest_noc' && p.settings.moest_noc_url) body.append(h(`<p><a href="${esc(p.settings.moest_noc_url)}" target="_blank" rel="noopener">MoEST NOC portal ↗</a></p>`));
    if (s.key === 'caan_noc_docs' && p.settings.caan_fssd) body.append(h(`<p class="muted small">${esc(p.settings.caan_fssd)}</p>`));
    if (exp) body.append(h(`<p class="expect ${exp.overdue ? 'late' : ''}">🕒 Expected ${fmtDate(exp.from, { day: 'numeric', month: 'short' })} – ${fmtDate(exp.to)}${exp.overdue ? ' · taking longer than usual, SAC is following up' : ''}</p>`));
    if (s.status === 'done' && s.done_at && !s.fields.some(f => f.k === 'date')) body.append(h(`<p class="muted small">Completed ${fmtDate(s.done_at)}</p>`));

    if (canEdit && s.fields.length && s.fields.every(f => f.t === 'check')) {
      body.append(checkList(s, true));
    } else if (canEdit && s.status === 'done' && !state.edit?.[s.key]) {
      const summary = summaryHtml(s);
      if (summary) body.append(h(`<div class="summary">${summary}</div>`));
      body.append(h(`<div class="actions">${s.fields.length ? '<button class="btn link" data-act="edit">Edit</button>' : ''}<button class="btn link" data-act="undo">Undo</button></div>`));
    } else if (canEdit) {
      const form = h(`<div class="fields"></div>`);
      s.fields.forEach(f => form.append(fieldInput(f, s.data[f.k])));
      body.append(form);
      const btns = h(`<div class="actions"></div>`);
      if (s.fields.some(f => f.k === 'state')) btns.append(h(`<button class="btn" data-act="state">Save</button>`));
      else {
        if (s.status === 'todo') btns.append(h(`<button class="btn" data-act="done">${s.needs_verify ? 'I’ve done this' : 'Mark as done'}</button>`));
        if (s.status === 'done' && s.fields.length) btns.append(h(`<button class="btn ghost" data-act="update">Update</button>`));
      }
      if (s.status === 'pending' || s.status === 'done') btns.append(h(`<button class="btn link" data-act="undo">Undo</button>`));
      body.append(btns);
    } else {
      if (s.fields.every(f => f.t === 'check') && s.fields.length) body.append(checkList(s, false));
      else {
        const summary = summaryHtml(s);
        if (summary) body.append(h(`<div class="summary">${summary}</div>`));
      }
      if (locked) card.classList.add('locked');
    }
    return card;
  }

  function summaryHtml(s) {
    return s.fields.map(f => {
      const v = s.data?.[f.k]; if (v === undefined || v === '' || v === null || f.t === 'check') return '';
      let shown = v;
      if (f.t === 'date') shown = fmtDate(v); else if (f.t === 'datetime') shown = fmtDateTime(v);
      else if (f.t === 'doctor') { const d = p.doctors.find(x => String(x.id) === String(v)); shown = d ? d.name : v; }
      return `<span><label>${esc(f.l)}</label> ${esc(shown)}</span>`;
    }).filter(Boolean).join('');
  }

  function checkList(s, enabled) {
    const box = h(`<div class="checks"></div>`);
    s.fields.forEach(f => {
      const url = s.key === 'social_follow' ? p.settings[SOCIAL_KEYS[f.k]] : null;
      box.append(h(`<label class="check"><input type="checkbox" data-k="${esc(f.k)}" ${s.data?.[f.k] ? 'checked' : ''} ${enabled ? '' : 'disabled'}>
        <span>${esc(f.l)}</span>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="open">Open ↗</a>` : ''}</label>`));
    });
    return box;
  }

  function fieldInput(f, v) {
    const id = 'f' + Math.random().toString(36).slice(2, 8);
    let input;
    if (f.t === 'date') input = `<input type="date" id="${id}" data-k="${f.k}" value="${esc(v || '')}">`;
    else if (f.t === 'datetime') input = `<input type="datetime-local" id="${id}" data-k="${f.k}" value="${esc(v || '')}">`;
    else if (f.t === 'select') input = `<select id="${id}" data-k="${f.k}"><option value="">Choose…</option>${(f.o || []).map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (f.t === 'doctor') {
      const grp = (f.o || [])[0];
      const docs = p.doctors.filter(d => d.grp === grp);
      input = `<select id="${id}" data-k="${f.k}"><option value="">Choose a doctor (${esc(DOCTOR_GROUPS[grp] || '')})…</option>${docs.map(d => `<option value="${d.id}" ${String(d.id) === String(v) ? 'selected' : ''}>${esc(d.name)} — ${esc(d.address)}</option>`).join('')}</select>
        <div class="doc-info">${(() => { const d = docs.find(x => String(x.id) === String(v)); return d ? doctorHtml(d) : ''; })()}</div>
        <p class="muted small">List from CAAN FSSD — it can change. Confirm with CAAN or SAC. SAC can book the appointment for you.</p>`;
    } else if (f.t === 'check') input = `<input type="checkbox" id="${id}" data-k="${f.k}" ${v ? 'checked' : ''}>`;
    else if (f.t === 'number') input = `<input type="number" inputmode="decimal" step="0.01" min="0" id="${id}" data-k="${f.k}" value="${esc(v ?? '')}">`;
    else input = `<input type="text" id="${id}" data-k="${f.k}" value="${esc(v || '')}">`;
    return h(`<div class="field"><label for="${id}">${esc(f.l)}</label>${input}</div>`);
  }
}

function doctorHtml(d) {
  return `<div class="doc"><b>${esc(d.name)}</b><br>${esc(d.address)}<br>📞 ${esc(d.phone || '')}${d.email ? ` · ✉️ <a href="mailto:${esc(d.email)}">${esc(d.email)}</a>` : ''}</div>`;
}

export function readFields(card) {
  const data = {};
  $$('[data-k]', card).forEach(i => { data[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value; });
  return data;
}

function requiredMissing(s, data) {
  // payment steps need a date + reference; doctor steps need a doctor; select-only steps need a value
  const req = s.fields.filter(f => (s.needs_verify && f.t !== 'check') || f.t === 'doctor' || f.k === 'result' || f.k === 'sevis_id' || f.k === 'when' || f.k === 'passport_expiry');
  const miss = req.filter(f => !data[f.k]).map(f => f.l);
  return miss.length ? miss.join(', ') : null;
}

function feesBlock(p) {
  const rows = feeRows(p).filter(r => r.key !== 'tuition');   // tuition is billed by HAA directly — SAC does not track it
  const wrap = h(`<div></div>`);
  if (p.program) wrap.append(h(`<div class="card prog">
    <h3>${esc(p.program.name)}</h3>
    <div class="kv"><span>Total tuition (paid to HAA in instalments)</span><b>${money(p.program.tuition_usd, 'USD')}</b></div>
    <div class="notice info" style="margin:8px 0"><b>Tuition is paid in instalments.</b> HAA invoices you directly for each upcoming payment and due date. Check your HAA payment portal; HAA also emails every invoice to your HAA email address.</div>
    <div class="kv"><span>Proof of financial capability</span><b>${money(p.program.pofc_usd, 'USD')}</b></div>
    <p class="muted small">Financial capability can be a bank student loan or a sponsor (parents / immediate family). It is required for HAA admission and your I-20.</p></div>`));
  const tbl = h(`<div class="card"><h3>Fees & payments</h3><div class="fees"></div>
    <p class="muted small">SAC only receives the SAC service fee. All other fees are paid directly to HAA, the US government, CAAN, MoEST or doctors — SAC is not involved in their refunds.</p></div>`);
  const list = $('.fees', tbl);
  const label = { paid: '✓ Paid', pending: '⏳ Awaiting SAC confirmation', todo: 'Not yet', na: 'Not needed' };
  rows.forEach(r => list.append(h(`<div class="fee-row ${r.state}">
    <div><b>${esc(r.label)}</b>${r.optional ? ' <span class="tag">optional</span>' : ''}<small>${esc(r.payee)} · ${r.refundable ? 'refundable' : 'non-refundable'}${r.note ? ` — ${esc(r.note)}` : ''}</small></div>
    <div class="amt">${money(r.amount, r.currency)}</div>
    <div class="state s-${r.state}">${label[r.state]}</div></div>`)));
  wrap.append(tbl);
  return wrap;
}

