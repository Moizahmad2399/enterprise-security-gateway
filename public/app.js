let token = null, expAt = 0, timer = null;
const $ = (id) => document.getElementById(id);
const api = '/api/v1';

/* ---------- helpers ---------- */
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg; $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3800);
}
async function call(method, path, body) {
  const r = await fetch(api + path, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, data };
}
const busy = (btn, on) => { btn.classList.toggle('loading', on); btn.disabled = on; };
const shake = () => { const c = $('card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); };

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
  const reg = tab.dataset.tab === 'register';
  $('ink').style.transform = reg ? 'translateX(100%)' : 'none';
  $('loginForm').classList.toggle('hidden', reg); $('regForm').classList.toggle('hidden', !reg);
}));
document.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
  const i = $(b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password';
}));
document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
  $('lEmail').value = b.dataset.demo; $('lPass').value = 'Test@12345'; $('lPass').focus();
}));

/* password strength */
$('rPass').addEventListener('input', (e) => {
  const v = e.target.value;
  const s = [v.length >= 8, /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
  $('meterBar').style.width = (v ? s * 25 : 0) + '%';
  $('meterBar').style.background = ['#fb7185', '#fb7185', '#fbbf24', '#34d399', '#34d399'][s];
  $('meterTxt').textContent = v ? ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'][s] : 'Use a mix of letters, numbers and symbols';
});

/* ---------- auth ---------- */
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('loginBtn'); busy(btn, true);
  const { status, ok, data } = await call('POST', '/auth/login', { email: $('lEmail').value.trim(), password: $('lPass').value });
  busy(btn, false);
  if (ok) return enter(data);
  shake();
  toast(status === 429 ? 'Too many attempts. Rate limit hit, wait 15 minutes.' : status === 423 ? 'Account locked after repeated failures.' : data.error || 'Login failed', 'err');
});

$('regForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('regBtn'); busy(btn, true);
  const { ok, data } = await call('POST', '/auth/register', { name: $('rName').value.trim(), email: $('rEmail').value.trim(), password: $('rPass').value });
  busy(btn, false);
  if (!ok) { shake(); return toast(data.error || 'Registration failed', 'err'); }
  toast('Account created. You can sign in now.', 'ok');
  $('lEmail').value = $('rEmail').value; document.querySelector('[data-tab="login"]').click(); $('lPass').focus();
});

function enter({ accessToken, user }) {
  token = accessToken;
  expAt = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000;
  $('uName').textContent = user.name; $('uEmail').textContent = user.email;
  $('avatar').textContent = (user.name || '?')[0].toUpperCase();
  $('uRole').textContent = user.role; $('uRole').className = 'role ' + user.role;
  $('authView').classList.add('hidden'); $('dashView').classList.remove('hidden');
  $('console').className = 'console'; $('console').textContent = 'Pick a route to test your role\'s permissions.';
  startTimer();
}
function leave() {
  token = null; clearInterval(timer);
  $('dashView').classList.add('hidden'); $('authView').classList.remove('hidden'); $('lPass').value = '';
}

/* ---------- token countdown ---------- */
function startTimer() {
  clearInterval(timer);
  const total = 15 * 60 * 1000, C = 326.7;
  const tick = () => {
    const left = Math.max(0, expAt - Date.now());
    const m = String(Math.floor(left / 60000)).padStart(2, '0'), s = String(Math.floor(left / 1000) % 60).padStart(2, '0');
    $('ttl').textContent = `${m}:${s}`;
    $('ringFg').style.strokeDashoffset = C * (1 - left / total);
    $('ringFg').style.stroke = left < 120000 ? 'var(--err)' : 'var(--b)';
    if (left === 0) { clearInterval(timer); silentRefresh(); }
  };
  tick(); timer = setInterval(tick, 1000);
}
async function silentRefresh(manual) {
  const { ok, data } = await call('POST', '/auth/refresh');
  if (ok) { enter(data); if (manual) toast('Tokens rotated. New access + refresh token issued.', 'ok'); return true; }
  if (manual || token) toast(data.error || 'Session expired', 'err');
  leave(); return false;
}
$('refreshBtn').addEventListener('click', () => silentRefresh(true));
$('logoutBtn').addEventListener('click', async () => { await call('POST', '/auth/logout'); leave(); toast('Logged out. Refresh token revoked.', 'ok'); });

/* ---------- RBAC playground ---------- */
const routes = {
  profile: ['GET', '/employee/profile'],
  payroll: ['POST', '/payroll/approve', {}],
  delete: ['DELETE', '/users/64b000000000000000000000'],
};
document.querySelectorAll('.route').forEach((b) => b.addEventListener('click', async () => {
  const [m, p, body] = routes[b.dataset.r];
  $('console').textContent = 'Calling…';
  const { status, ok, data } = await call(m, p, body);
  $('console').className = 'console' + (status === 403 || status === 401 ? ' denied' : '');
  $('console').textContent = `${m} ${api}${p}\nHTTP ${status} ${ok ? 'OK' : status === 403 ? 'FORBIDDEN' : ''}\n\n${JSON.stringify(data, null, 2)}`;
}));

/* ---------- boot: restore session from httpOnly cookie (also finishes OAuth login) ---------- */
(async () => {
  const q = new URLSearchParams(location.search);
  if (q.get('oauth') === 'failed') toast('GitHub login failed.', 'err');
  if (q.has('oauth')) history.replaceState({}, '', '/');
  const { ok, data } = await call('POST', '/auth/refresh');
  if (ok) { enter(data); if (q.get('oauth') === 'success') toast('Signed in with GitHub', 'ok'); }
})();
