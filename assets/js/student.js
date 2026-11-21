import { getApi, DEMO } from './api.js';
import { renderPortal } from './journey.js';
import { TERMS, CONSENT } from './legal.js';
import { $, h, toast, esc } from './core.js';

const api = await getApi();
const KEY = 'sac-student-token';
let token = sessionStorage.getItem(KEY);

if (DEMO) {
  $('#demo').append(h(`<div class="demo-bar">Demo mode · sample data only. Try <b>SAC-DEMO1</b> / PIN <b>123456</b> (also DEMO2–DEMO4). <button id="resetDemo">Reset demo</button></div>`));
  $('#resetDemo').onclick = () => { api.reset(); sessionStorage.clear(); location.reload(); };
}

function showLogin(msg) {
  $('#app').hidden = true; $('#logout').hidden = true; $('#login').hidden = false;
  if (msg) { $('#loginErr').textContent = msg; $('#loginErr').hidden = false; }
}

async function showPortal(p) {
  $('#login').hidden = true; $('#app').hidden = false; $('#logout').hidden = false;
  if (!p.student.ack_terms_at || !p.student.ack_consent_at) p = await askConsent(p);
  renderPortal($('#app'), p, {
    onSave: async (key, done, data) => {
      try { return await api.studentUpdate(token, key, done, data); }
      catch (e) { if (e.code === 'SESSION_EXPIRED') { logout(e.message); } throw e; }
    },
  });
}

function askConsent(p) {
  return new Promise(resolve => {
    const m = h(`<div class="modal"><div class="modal-box">
      <header><h3>Welcome aboard, ${esc(p.student.full_name.split(' ')[0])}! ✈</h3><div class="muted small">One quick step before we start.</div></header>
      <div class="scroll">
        <ul class="sum">
          <li><b>Fees.</b> SAC’s service fee is NPR 50,000. The first NPR 30,000 is non-refundable. Fees you pay to HAA, the US government, CAAN, MoEST or doctors are separate.</li>
          <li><b>No guarantee.</b> SAC guides you. HAA, the US government, CAAN and MoEST decide admission, visa and NOCs.</li>
          <li><b>Your data.</b> SAC records your details and documents to run your application, and shares them only with the offices that need them.</li>
        </ul>
        <details class="fold"><summary>Read the full Fees &amp; Non-Refund terms</summary><div class="foldbody">${TERMS}</div></details>
        <details class="fold"><summary>Read the full Data Consent</summary><div class="foldbody">${CONSENT}</div></details>
      </div>
      <footer>
        <label class="check"><input type="checkbox" id="a1"><span>I have read and agree to the <b>Fees &amp; Non-Refund terms</b> and the <b>Data Consent</b>.</span></label>
        <button class="btn" id="accept" disabled>Accept &amp; continue</button>
      </footer></div></div>`);
    document.body.append(m);
    $('#a1', m).onchange = () => { $('#accept', m).disabled = !$('#a1', m).checked; };
    $('#accept', m).onclick = async () => {
      try { const np = await api.studentAck(token); m.remove(); resolve(np); }
      catch (e) { toast(e.message, 'err'); }
    };
  });
}

async function logout(msg) {
  if (token) await api.studentLogout(token);
  sessionStorage.removeItem(KEY); token = null; showLogin(msg);
}

$('#logout').onclick = () => logout();
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  $('#loginErr').hidden = true;
  const btn = e.submitter; btn.disabled = true;
  try {
    const r = await api.studentLogin($('#code').value, $('#pin').value);
    token = r.token; sessionStorage.setItem(KEY, token);
    $('#pin').value = '';
    await showPortal(r.portal);
  } catch (err) { showLogin(err.message); }
  finally { btn.disabled = false; }
};

if (token) {
  try { await showPortal(await api.studentPortal(token)); }
  catch (e) { sessionStorage.removeItem(KEY); token = null; showLogin(); }
} else showLogin();
