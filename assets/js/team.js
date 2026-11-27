// Settings → Team (owner only): invite counsellors, rename, change email or role,
// deactivate / reactivate, resend the set-password email. Nothing is deleted.
import { $, h, esc, toast, fmtDateTime } from './core.js';

const ROLE = { owner: 'Owner', counsellor: 'Counsellor' };

export async function renderTeam(v, api, myEmail) {
  const card = h(`<div class="card"><h3>Team</h3>
    <p class="muted small">Counsellors can track and update students and use the Knowledge Hub. They never see commission or Settings. To remove someone, deactivate them — their history stays and you can reactivate later.</p>
    <div id="teamList" class="muted small">Loading…</div></div>`);
  const add = h(`<div class="card" style="max-width:640px"><h3>Invite a team member</h3>
    <form><div class="formgrid">
      <div class="field"><label>Name *</label><input name="full_name" required placeholder="e.g. SAC Counsellor 2"></div>
      <div class="field"><label>Email *</label><input name="email" type="email" required></div>
      <div class="field"><label>Role</label><select name="role"><option value="counsellor">Counsellor</option><option value="owner">Owner (full access)</option></select></div>
    </div><p class="muted small">They get an email from Supabase with a link to set their own password. You never see or send their password.</p>
    <button class="btn" type="submit">Send invitation</button></form></div>`);
  v.append(card, add);

  async function load() {
    const box = $('#teamList', card);
    try {
      const { team } = await api.teamAdmin('list');
      box.className = '';
      box.innerHTML = `<div class="tablewrap"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead><tbody>${team.map(m => {
        const me = m.email === myEmail;
        const status = !m.active ? '<span class="pill withdrawn">Deactivated</span>' : m.invited_pending ? '<span class="pill deferred">Invite pending</span>' : '<span class="pill active">Active</span>';
        return `<tr data-id="${esc(m.user_id)}">
          <td><input data-f="full_name" value="${esc(m.full_name || '')}" placeholder="Name"></td>
          <td><input data-f="email" type="email" value="${esc(m.email || '')}"></td>
          <td><select data-f="role" ${me ? 'disabled' : ''}>${Object.entries(ROLE).map(([k, l]) => `<option value="${k}" ${k === m.role ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td>${status}</td>
          <td class="small">${m.last_sign_in_at ? esc(fmtDateTime(m.last_sign_in_at)) : '—'}</td>
          <td><div class="actions">
            <button class="btn small ghost" data-a="save">Save</button>
            ${me ? '<span class="muted small">You</span>' : `
              <button class="btn small ghost" data-a="resend">Send set-password email</button>
              <button class="btn small ghost" data-a="${m.active ? 'off' : 'on'}">${m.active ? 'Deactivate' : 'Reactivate'}</button>`}
          </div></td></tr>`;
      }).join('')}</tbody></table></div>`;
    } catch (err) { box.className = 'notice err'; box.textContent = err.message; }
  }

  card.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const tr = b.closest('tr'), id = tr.dataset.id, a = b.dataset.a;
    try {
      if (a === 'save') {
        const val = f => tr.querySelector(`[data-f="${f}"]`).value;
        await api.teamAdmin('update', { user_id: id, full_name: val('full_name'), email: val('email'), role: val('role') });
        toast('Saved');
      }
      if (a === 'resend') { await api.teamAdmin('resend', { user_id: id }); toast('Email sent'); }
      if (a === 'off') { if (!confirm('Deactivate this person? They will be logged out and cannot log in until you reactivate them.')) return; await api.teamAdmin('set_active', { user_id: id, active: false }); toast('Deactivated'); }
      if (a === 'on') { await api.teamAdmin('set_active', { user_id: id, active: true }); toast('Reactivated'); }
      await load();
    } catch (err) { toast(err.message, 'err'); }
  };

  $('form', add).onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try { await api.teamAdmin('invite', d); toast(`Invitation sent to ${d.email}`); e.target.reset(); await load(); }
    catch (err) { toast(err.message, 'err'); }
  };

  load();
}
