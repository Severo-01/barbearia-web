/* Barbearia · Sistema (login + painel). JavaScript puro + Supabase (somente chaves públicas). */
(() => {
'use strict';
const CFG = {
  url: 'https://tjwmylorppohtozyhuak.supabase.co',
  key: 'sb_publishable_29FN5to3ElLyvw8uJV8XCQ_9hPLhPEO',   // chave PÚBLICA. Nunca coloque secrets aqui.
  slug: 'barbearia', tz: 'America/Sao_Paulo', minPass: 8, home: window.APP_HOME || '../',
};
const sb = supabase.createClient(CFG.url, CFG.key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

// ---------- utilidades
const ROOT = window.APP_ROOT || document, BODY = window.APP_HOST || document.body;
const $ = (s, r = ROOT) => r.querySelector(s), $$ = (s, r = ROOT) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (c) => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const TZ = CFG.tz;
const fTime = (d) => new Date(d).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fDay = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short' });
const fDayLong = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' });
const ymd = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayStart = (s) => new Date(s + 'T00:00:00-03:00');          // Brasil sem horário de verão
const dow = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
const DOWN = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const ERR = {
  slot_unavailable: 'Esse horário acabou de ser ocupado. Escolha outro.', customer_overlap: 'Você já tem um agendamento nesse horário.',
  no_active_subscription: 'Você não tem um plano ativo.', no_credits: 'Seus créditos do plano acabaram.',
  plan_requires_included_services: 'A visita do plano inclui corte e barba.', too_late_to_cancel: 'Cancelamento fora do prazo. Fale com a barbearia.',
  not_cancelable: 'Este agendamento não pode mais ser cancelado.', already_has_subscription: 'Você já tem um plano em andamento.',
  forbidden: 'Você não tem permissão para isso.', invalid_services: 'Escolha ao menos um serviço.', not_authenticated: 'Faça login novamente.',
  staff_cannot_do_services: 'Este profissional não faz esses serviços.', not_changeable: 'Este agendamento não pode mais ser alterado.',
};
const errMsg = (e) => { const m = (e && e.message) || ''; for (const k in ERR) if (m.includes(k)) return ERR[k]; return /failed to fetch|network/i.test(m) ? 'Sem conexão. Verifique a internet.' : 'Algo deu errado. Tente de novo.'; };
let toastT;
function toast(t, ok) { const el = $('#toast'); el.textContent = t; el.className = 'show' + (ok ? ' ok' : ''); clearTimeout(toastT); toastT = setTimeout(() => { el.className = ''; }, 4200); }
const S = { user: null, profile: null, shop: null, role: null, services: [], staff: [], plans: [], settings: null, hours: [], cleanup: null };
const isAdmin = () => S.role === 'owner' || S.role === 'manager';
const waLink = (txt) => `https://wa.me/${(S.shop && S.shop.whatsapp) || ''}?text=${encodeURIComponent(txt)}`;
const STATUS = { confirmed: ['Confirmado', 'ok'], completed: ['Concluído', 'done'], canceled: ['Cancelado', 'bad'], no_show: ['Não compareceu', 'bad'], pending: ['Pendente', 'warn'] };
const badge = (s) => { const [t, c] = STATUS[s] || [s, '']; return `<span class="badge ${c}">${t}</span>`; };
const ICON = {
  home: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z', cal: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6', scissors: 'M6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8', wallet: 'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l2-3h12M16 14h.01',
  shop: 'M4 9l1-5h14l1 5M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M10 20v-6h4v6', agenda: 'M3 4h18v16H3zM3 9h18M8 4v16',
};
const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[n]}"/></svg>`;

// ---------- login / cadastro (só entra quem já criou conta)
let mode = 'entrar', handling = null;
const _q = new URLSearchParams(location.search), _h = new URLSearchParams(location.hash.split('?')[1] || '');
const OAUTH_ERR = _q.get('error_description') || _h.get('error_description') || '';
const MSG = document.createElement('p'); MSG.className = 'msg'; MSG.setAttribute('role', 'status'); MSG.hidden = true;
function msg(t, ok) {
  MSG.textContent = t || ''; MSG.hidden = !t; MSG.className = 'msg' + (ok ? ' ok' : '');
  if (!t) return;
  const host = $('#auth .card:not([hidden])'); if (host) host.appendChild(MSG);
  MSG.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function authView(v) { $('#boot').hidden = true; $('#shell').hidden = true; $('#auth').hidden = false; $('#view-login').hidden = v !== 'login'; $('#view-recovery').hidden = v !== 'recovery'; }
function setBusy(b) { $$('#auth button.btn').forEach((x) => { x.disabled = b; }); }
function traduz(m) {
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos. Se você ainda não tem conta, toque em "Criar conta" primeiro.';
  if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada e o spam).';
  if (/at least|too short/i.test(m)) return 'A senha precisa ter pelo menos ' + CFG.minPass + ' caracteres.';
  if (/weak|easy to guess|pwned/i.test(m)) return 'Essa senha é fraca. Use pelo menos ' + CFG.minPass + ' caracteres, misturando letras e números.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  if (/provider is not enabled|unsupported provider/i.test(m)) return 'O login com Google ainda não está ativado.';
  if (/failed to fetch|network/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.';
  return 'Algo deu errado: ' + m;
}
const saveIntent = (i) => { try { localStorage.setItem('auth_intent', JSON.stringify({ i, t: Date.now() })); return true; } catch (e) { return false; } };
function readIntent() {
  try { const raw = localStorage.getItem('auth_intent'); localStorage.removeItem('auth_intent'); if (!raw) return 'login'; const o = JSON.parse(raw); return (o.i === 'signup' && Date.now() - o.t < 600000) ? 'signup' : 'login'; } catch (e) { return 'login'; }
}
const INTENT = readIntent();
// destino pedido pela landing (ex.: agendar, planos) — guardado para depois do login
(() => {
  const go = _q.get('go'), plano = _q.get('plano');
  const hr = location.hash.replace(/^#\/?app\/?/, '');
  const dest = go ? go + (plano ? '?plano=' + plano : '') : hr;
  if (dest) { try { localStorage.setItem('post_login', dest); } catch (e) { /* ignora */ } }
  if (go) history.replaceState(null, '', location.pathname);
})();
const REDIRECT = location.origin + location.pathname;
function setMode(m) {
  mode = m;
  $('#tab-entrar').setAttribute('aria-pressed', m === 'entrar'); $('#tab-criar').setAttribute('aria-pressed', m === 'criar');
  $('#lbl-nome').hidden = m !== 'criar'; $('#dica').hidden = m !== 'criar';
  $('#btn-enviar').textContent = m === 'entrar' ? 'Entrar' : 'Criar conta';
  $('#btn-google').textContent = m === 'entrar' ? 'Entrar com Google' : 'Criar conta com Google';
  $('#btn-esqueci').hidden = m !== 'entrar'; $('#senha').autocomplete = m === 'entrar' ? 'current-password' : 'new-password'; msg('');
}
function validar() {
  const email = $('#email').value.trim(), senha = $('#senha').value;
  if (mode === 'criar' && $('#nome').value.trim().length < 2) return ['Digite seu nome completo.', 'nome'];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ['Digite um e-mail válido.', 'email'];
  if (!senha) return ['Digite sua senha.', 'senha'];
  if (mode === 'criar' && senha.length < CFG.minPass) return ['A senha precisa ter pelo menos ' + CFG.minPass + ' caracteres.', 'senha'];
  return null;
}
async function onSession(session) {
  const u = session.user;
  const { data: p, error } = await sb.from('profiles').select('full_name,phone,registered_at,marketing_consent').eq('id', u.id).maybeSingle();
  if (error || !p) { authView('login'); msg('Não foi possível ler seu cadastro agora. Tente novamente.'); return; }
  if (!p.registered_at) {
    if (INTENT === 'signup') {
      const { error: e2 } = await sb.rpc('complete_registration');
      if (e2) { await sb.auth.signOut(); setMode('criar'); authView('login'); msg('Não foi possível concluir o cadastro agora. Tente "Criar conta com Google" de novo.'); return; }
    } else {
      await sb.rpc('discard_unregistered_account'); await sb.auth.signOut();
      setMode('criar'); authView('login'); msg('Você ainda não tem uma conta. Crie sua conta primeiro (por e-mail ou com Google) e depois entre.'); return;
    }
  }
  await startApp(u, p);
}
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') { authView('recovery'); return; }
  if (session) {
    if (location.search.includes('code=') || location.hash.includes('access_token')) history.replaceState(null, '', location.pathname + (location.hash.startsWith('#/app') ? location.hash : ''));
    if (!handling) handling = new Promise((r) => setTimeout(r, 0)).then(() => onSession(session)).finally(() => { handling = null; });
  } else { S.user = null; authView('login'); }
});
$('#tab-entrar').onclick = () => setMode('entrar'); $('#tab-criar').onclick = () => setMode('criar');
$('#btn-google').onclick = async () => {
  if (location.protocol === 'file:') { msg('Abra por um endereço http(s) (site publicado ou localhost). O Google não funciona com o arquivo aberto direto.'); return; }
  if (!saveIntent(mode === 'criar' ? 'signup' : 'login')) { msg('Seu navegador está bloqueando o armazenamento do site. Abra no navegador normal (fora de aba anônima).'); return; }
  setBusy(true); msg('');
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: REDIRECT, queryParams: { prompt: 'select_account' } } });
  if (error) { msg(traduz(error.message)); setBusy(false); }
};
$('#form-email').onsubmit = async (e) => {
  e.preventDefault();
  const v = validar(); if (v) { msg(v[0]); $('#' + v[1]).focus(); return; }
  setBusy(true); msg('');
  const email = $('#email').value.trim(), password = $('#senha').value;
  if (mode === 'entrar') { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) msg(traduz(error.message)); }
  else {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: $('#nome').value.trim() }, emailRedirectTo: REDIRECT } });
    if (error) msg(traduz(error.message));
    else if (data.user && data.user.identities && data.user.identities.length === 0) msg('Este e-mail já tem uma conta. Toque em "Entrar" ou use "Esqueci minha senha".');
    else if (!data.session) msg('Conta criada! Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar a conta e depois entre.', true);
  }
  setBusy(false);
};
$('#btn-esqueci').onclick = async () => {
  const email = $('#email').value.trim(); if (!email) { msg('Digite seu e-mail primeiro.'); $('#email').focus(); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT });
  if (error) msg(traduz(error.message)); else msg('Se o e-mail existir, enviamos o link para redefinir a senha.', true);
};
$('#form-recovery').onsubmit = async (e) => {
  e.preventDefault();
  if ($('#nova').value.length < CFG.minPass) { msg('A senha precisa ter pelo menos ' + CFG.minPass + ' caracteres.'); $('#nova').focus(); return; }
  setBusy(true); const { error } = await sb.auth.updateUser({ password: $('#nova').value }); setBusy(false);
  if (error) { msg(traduz(error.message)); return; }
  const { data } = await sb.auth.getSession(); if (data.session) { msg(''); onSession(data.session); } else authView('login');
};
const TOKEN_HASH = _q.get('token_hash'), TOKEN_TYPE = _q.get('type');
if (TOKEN_HASH && TOKEN_TYPE) {
  history.replaceState(null, '', location.pathname);
  sb.auth.verifyOtp({ token_hash: TOKEN_HASH, type: TOKEN_TYPE }).then(({ error }) => {
    if (error) { authView('login'); msg('Este link expirou ou já foi usado. Peça um novo ("Esqueci minha senha") ou crie a conta novamente.'); }
    else if (TOKEN_TYPE !== 'recovery') { try { localStorage.setItem('just_confirmed', '1'); } catch (e) { /* ignora */ } }
  });
}
setMode('entrar');
if (OAUTH_ERR) { authView('login'); msg('Não foi possível concluir o login com o Google. Detalhe técnico: ' + OAUTH_ERR.replace(/\+/g, ' ')); }

// ---------- aplicação (depois do login)
const NAV = [
  { r: 'inicio', t: 'Início', i: 'home' }, { r: 'agendar', t: 'Agendar', i: 'cal' }, { r: 'meus', t: 'Meus agendamentos', i: 'list' },
  { r: 'planos', t: 'Planos', i: 'tag' }, { r: 'conta', t: 'Configurações', i: 'sliders' },
  { g: 'Gestão' },
  { r: 'agenda', t: 'Agenda', i: 'agenda', a: 'staff' }, { r: 'servicos', t: 'Serviços e preços', i: 'scissors', a: 'admin' },
  { r: 'clientes', t: 'Clientes', i: 'users', a: 'admin' }, { r: 'financeiro', t: 'Financeiro', i: 'wallet', a: 'admin' }, { r: 'barbearia', t: 'Barbearia', i: 'shop', a: 'admin' },
];
const allowed = (n) => !n.a || (n.a === 'admin' ? isAdmin() : (isAdmin() || S.role === 'staff'));
async function startApp(u, profile) {
  S.user = u; S.profile = profile;
  const { data: shop } = await sb.from('shops').select('*').eq('slug', CFG.slug).maybeSingle();
  if (!shop) { authView('login'); msg('Não foi possível carregar a barbearia. Tente novamente em instantes.'); return; }
  S.shop = shop;
  const [mem, sv, st, pl, se, ho] = await Promise.all([
    sb.from('shop_members').select('role').eq('shop_id', shop.id).eq('user_id', u.id).maybeSingle(),
    sb.from('services').select('*').eq('shop_id', shop.id).order('sort_order'), sb.from('staff').select('*').eq('shop_id', shop.id).order('created_at'),
    sb.from('plans').select('*').eq('shop_id', shop.id).order('sort_order'), sb.from('business_settings').select('*').eq('shop_id', shop.id).maybeSingle(),
    sb.from('business_hours').select('*').eq('shop_id', shop.id).is('staff_id', null),
  ]);
  S.role = (mem.data && mem.data.role) || null; S.services = sv.data || []; S.staff = st.data || []; S.plans = pl.data || []; S.settings = se.data; S.hours = ho.data || [];
  $('#who').textContent = first(profile.full_name) || u.email; $('#who2').textContent = first(profile.full_name) || u.email; $('#who-role').textContent = S.role ? ({ owner: 'Proprietário', manager: 'Gerente', staff: 'Profissional' })[S.role] : 'Cliente';
  $('#nav').innerHTML = NAV.filter((n) => n.g ? allowed(NAV[NAV.indexOf(n) + 1]) : allowed(n)).map((n) => n.g ? `<p class="nav-g">${n.g}</p>` : `<a href="#/app/${n.r}" data-r="${n.r}">${ico(n.i)}<span>${n.t}</span></a>`).join('');
  $('#boot').hidden = true; $('#auth').hidden = true; $('#shell').hidden = false;
  let dest = ''; try { dest = localStorage.getItem('post_login') || ''; localStorage.removeItem('post_login'); } catch (e) { /* ignora */ }
  if (dest) location.hash = '#/app/' + dest; else if (!/^#\/app\/./.test(location.hash)) location.hash = '#/app/inicio';
  render();
  try { if (localStorage.getItem('just_confirmed')) { localStorage.removeItem('just_confirmed'); toast('E-mail confirmado! Sua conta está ativa.', true); } } catch (e) { /* ignora */ }
}
function route() { const h = location.hash.replace(/^#\/?app\/?/, '').replace(/^#\/?/, ''); const [r, qs] = h.split('?'); return { r: r || 'inicio', p: new URLSearchParams(qs || '') }; }
const go = (r, q) => { location.hash = '#/app/' + r + (q ? '?' + q : ''); };
async function render() {
  if (!S.user) return;
  const { r, p } = route(); const n = NAV.find((x) => x.r === r);
  if (!n || !allowed(n)) { go('inicio'); return; }
  if (S.cleanup) { S.cleanup(); S.cleanup = null; }
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === r)); BODY.classList.remove('drawer');
  const el = $('#view'); el.onclick = null; el.innerHTML = '<p class="muted">Carregando…</p>';
  try { await VIEWS[r](el, p); } catch (e) { console.error(e); el.innerHTML = `<div class="card"><h2>Ops</h2><p>Não foi possível carregar esta página. <a href="#/app/${r}">Tentar de novo</a></p></div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);
$('#menu-btn').onclick = () => BODY.classList.toggle('drawer');
$('#scrim').onclick = () => BODY.classList.remove('drawer');
$('#logout').onclick = async () => { await sb.auth.signOut(); location.hash = ''; };

async function mySub() {
  const { data: s } = await sb.from('subscriptions').select('id,status,current_period_start,current_period_end,plans(name,price_cents,visits_per_month)')
    .eq('user_id', S.user.id).in('status', ['pending_payment', 'active', 'paused']).maybeSingle();
  if (!s) return { s: null, credits: 0, live: false, usable: false };
  const { data: c } = await sb.from('subscription_credits').select('delta').eq('subscription_id', s.id);
  const credits = (c || []).reduce((a, x) => a + x.delta, 0);
  const live = s.status === 'active' && new Date(s.current_period_end) > new Date();
  return { s, credits, live, usable: live && credits > 0 };
}
const subLabel = (m) => !m.s ? 'Sem plano' : m.s.status === 'pending_payment' ? 'Aguardando pagamento' : !m.live ? 'Vencido' : 'Ativo';

// ---------- views do cliente
const VIEWS = {};
VIEWS.inicio = async (el) => {
  const [{ data: ap }, sub] = await Promise.all([sb.rpc('my_appointments'), mySub()]);
  const nxt = (ap || []).filter((a) => a.status === 'confirmed' && new Date(a.start_at) > new Date()).sort((a, b) => new Date(a.start_at) - new Date(b.start_at))[0];
  el.innerHTML = `<h1>Olá, ${esc(first(S.profile.full_name) || 'bem-vindo')}</h1><p class="muted">O que você quer fazer hoje?</p>
  <div class="grid">
   <div class="card"><h3>Próximo agendamento</h3>${nxt ? `<p class="big">${esc(fDayLong(nxt.start_at))}</p><p>${fTime(nxt.start_at)} às ${fTime(nxt.end_at)} · ${esc(nxt.staff_name || 'Barbearia')}</p><p class="muted">${esc((nxt.services || []).join(' + '))}</p><a class="btn ghost" href="#/app/meus">Ver detalhes</a>` : `<p class="muted">Você não tem horários marcados.</p><a class="btn" href="#/app/agendar">Agendar agora</a>`}</div>
   <div class="card"><h3>Meu plano</h3><p class="big">${subLabel(sub)}</p>${sub.s ? `<p>${esc(sub.s.plans.name)}</p>${sub.live ? `<p class="muted">${sub.credits} visita(s) disponível(is) · vale até ${new Date(sub.s.current_period_end).toLocaleDateString('pt-BR', { timeZone: TZ })}</p>` : ''}` : '<p class="muted">Corte + barba com preço fixo por mês.</p>'}<a class="btn ghost" href="#/app/planos">${sub.s ? 'Ver plano' : 'Conhecer planos'}</a></div>
  </div>${isAdmin() || S.role === 'staff' ? '<div class="card"><h3>Gestão</h3><p class="muted">Abra a Agenda para ver os atendimentos de hoje.</p><a class="btn ghost" href="#/app/agenda">Abrir agenda</a></div>' : ''}`;
};

const B = { svc: new Set(), staff: 'any', date: '', slot: null, slots: [], plan: false, busy: false, loading: false, done: null };
VIEWS.agendar = async (el, p) => {
  const sub = await mySub(); if (!sub.usable) B.plan = false;
  const svcs = S.services.filter((s) => s.active), staffs = S.staff.filter((s) => s.active);
  const open = new Set(S.hours.map((h) => h.weekday)), today = ymd(new Date()), maxAdv = (S.settings && S.settings.max_advance_days) || 30;
  const days = []; for (let i = 0; i <= maxAdv && days.length < 14; i++) { const d = addDays(today, i); if (open.has(dow(d))) days.push(d); }
  const sum = () => { const sel = svcs.filter((s) => B.svc.has(s.id)); return { sel, dur: sel.reduce((a, s) => a + s.duration_min, 0), price: sel.reduce((a, s) => a + (B.plan && s.included_in_plans ? 0 : s.price_cents), 0) }; };
  const reset = () => { B.svc = new Set(); B.staff = 'any'; B.date = ''; B.slot = null; B.slots = []; B.plan = false; };
  const draw = () => {
    const t = sum(), ok = B.slot && t.sel.length;
    if (B.done) { const d = B.done; el.innerHTML = `<div class="card center"><div class="check">✓</div><h2>Agendamento confirmado!</h2><p class="big">${esc(fDayLong(d.start))}</p><p>${fTime(d.start)} · ${esc(d.staff)}</p><p class="muted">${esc(d.services)}</p><p>${esc(d.price)}</p><div class="row"><a class="btn" href="#/app/meus">Ver meus agendamentos</a><button class="btn ghost" data-a="again">Fazer outro agendamento</button></div></div>`; return; }
    el.innerHTML = `<h1>Agendar horário</h1>
    <div class="card"><h3>1. Serviços</h3><div class="list">${svcs.map((s) => { const inc = B.plan && s.included_in_plans; return `<label class="opt${B.svc.has(s.id) ? ' on' : ''}"><input type="checkbox" data-a="svc" data-v="${s.id}" ${B.svc.has(s.id) ? 'checked' : ''} ${inc ? 'disabled' : ''}><span><b>${esc(s.name)}</b><small>${s.duration_min} min</small></span><em>${inc ? 'Incluído no plano' : brl(s.price_cents)}</em></label>`; }).join('')}</div>
      ${sub.usable ? `<label class="opt plan${B.plan ? ' on' : ''}"><input type="checkbox" data-a="plan" ${B.plan ? 'checked' : ''}><span><b>Usar meu plano</b><small>${sub.credits} visita(s) disponível(is): corte + barba</small></span></label>` : ''}</div>
    <div class="card"><h3>2. Profissional</h3><div class="chips"><button class="chip${B.staff === 'any' ? ' on' : ''}" data-a="staff" data-v="any">Qualquer um</button>${staffs.map((s) => `<button class="chip${B.staff === s.id ? ' on' : ''}" data-a="staff" data-v="${s.id}">${s.photo_url ? `<img src="${esc((window.APP_PHOTOS || {})[s.photo_url] || s.photo_url)}" alt="" onerror="this.remove()">` : ''}${esc(s.name)}</button>`).join('')}</div></div>
    <div class="card"><h3>3. Dia</h3><div class="chips days">${days.map((d) => `<button class="chip${B.date === d ? ' on' : ''}" data-a="date" data-v="${d}"><small>${esc(new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short' }))}</small><b>${d.slice(8)}/${d.slice(5, 7)}</b></button>`).join('')}</div></div>
    <div class="card"><h3>4. Horário</h3>${!t.sel.length ? '<p class="muted">Escolha os serviços primeiro.</p>' : !B.date ? '<p class="muted">Escolha o dia.</p>' : B.loading ? '<p class="muted">Buscando horários…</p>' : !B.slots.length ? '<p class="muted">Sem horários livres neste dia para esses serviços. Tente outro dia.</p>' : `<div class="slots">${B.slots.map((x) => `<button class="slot${B.slot === x.t ? ' on' : ''}" data-a="slot" data-v="${x.t}">${fTime(x.t)}</button>`).join('')}</div>`}</div>
    <div class="card sum"><h3>Resumo</h3>${t.sel.length ? `<p>${esc(t.sel.map((s) => s.name).join(' + '))}</p><p class="muted">${t.dur} min${B.slot ? ' · ' + esc(fDay(B.slot)) + ' às ' + fTime(B.slot) : ''}</p><p class="big">${B.plan ? (t.price ? 'Plano + ' + brl(t.price) : 'Usa 1 visita do plano') : brl(t.price)}</p>` : '<p class="muted">Nenhum serviço escolhido.</p>'}<button class="btn" data-a="book" ${ok && !B.busy ? '' : 'disabled'}>${B.busy ? 'Confirmando…' : 'Confirmar agendamento'}</button><p class="muted small">O pagamento dos serviços avulsos é feito na barbearia.</p></div>`;
  };
  const loadSlots = async () => {
    B.slot = null; B.slots = []; if (!B.date || !B.svc.size) { draw(); return; }
    B.loading = true; draw();
    const { data, error } = await sb.rpc('get_availability', { p_shop: S.shop.id, p_service_ids: [...B.svc], p_date: B.date, p_staff: B.staff === 'any' ? null : B.staff });
    B.loading = false; if (error) toast(errMsg(error));
    const m = new Map(); (data || []).forEach((r) => { if (!m.has(r.slot_start)) m.set(r.slot_start, r.staff_id); });
    B.slots = [...m].map(([t, s]) => ({ t, s })); draw();
  };
  el.onclick = async (e) => {
    const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a, v = t.dataset.v;
    if (a === 'again') { reset(); B.done = null; draw(); return; }
    if (a === 'svc') { if (B.svc.has(v)) B.svc.delete(v); else B.svc.add(v); await loadSlots(); }
    else if (a === 'plan') { B.plan = t.checked; if (B.plan) S.services.filter((s) => s.included_in_plans && s.active).forEach((s) => B.svc.add(s.id)); await loadSlots(); }
    else if (a === 'staff') { B.staff = v; await loadSlots(); }
    else if (a === 'date') { B.date = v; await loadSlots(); }
    else if (a === 'slot') { B.slot = v; draw(); }
    else if (a === 'book') {
      const slot = B.slots.find((x) => x.t === B.slot); if (!slot) return;
      B.busy = true; draw(); const t0 = sum();
      const { error } = await sb.rpc('book_appointment', { p_shop: S.shop.id, p_staff: slot.s, p_service_ids: [...B.svc], p_start: B.slot, p_use_plan: B.plan });
      B.busy = false;
      if (error) { toast(errMsg(error)); if (/slot_unavailable|customer_overlap/.test(error.message)) await loadSlots(); else draw(); return; }
      B.done = { start: B.slot, staff: (S.staff.find((s) => s.id === slot.s) || {}).name || 'Barbearia', services: t0.sel.map((s) => s.name).join(' + '), price: B.plan ? (t0.price ? 'Plano + ' + brl(t0.price) : 'Usou 1 visita do plano') : brl(t0.price) };
      reset(); draw();
    }
  };
  if (p.get('plano') !== null && !sub.s) { go('planos', 'plano=' + p.get('plano')); return; }
  B.done = null; draw(); if (B.date && B.svc.size) loadSlots();
  const timer = setInterval(() => { if (B.date && B.svc.size && !B.busy && !B.done) loadSlots(); }, 45000);   // atualiza a agenda sozinha
  S.cleanup = () => clearInterval(timer);
};

VIEWS.meus = async (el) => {
  const { data, error } = await sb.rpc('my_appointments'); if (error) throw error;
  const now = new Date(), up = (data || []).filter((a) => a.status === 'confirmed' && new Date(a.start_at) > now).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const past = (data || []).filter((a) => !up.includes(a));
  const row = (a, cancel) => `<div class="item"><div><b>${esc(fDay(a.start_at))} · ${fTime(a.start_at)}–${fTime(a.end_at)}</b><p>${esc((a.services || []).join(' + '))}</p><p class="muted">${esc(a.staff_name || 'Barbearia')} · ${a.uses_plan ? 'Plano' : brl(a.total_price_cents)}</p></div><div class="side">${badge(a.status)}${cancel ? `<button class="btn ghost sm" data-cancel="${a.id}">Cancelar</button>` : ''}</div></div>`;
  el.innerHTML = `<h1>Meus agendamentos</h1><div class="card"><h3>Próximos</h3>${up.length ? up.map((a) => row(a, true)).join('') : '<p class="muted">Nenhum horário marcado. <a href="#/app/agendar">Agendar agora</a></p>'}</div>
  <div class="card"><h3>Histórico</h3>${past.length ? past.map((a) => row(a, false)).join('') : '<p class="muted">Ainda não há atendimentos.</p>'}</div>
  <p class="muted small">Cancelamento até ${Math.round(((S.settings && S.settings.cancel_window_min) || 120) / 60)} h antes do horário. Para reagendar, cancele e marque um novo horário.</p>`;
  el.onclick = async (e) => {
    const id = e.target.dataset.cancel; if (!id || !confirm('Cancelar este agendamento?')) return;
    const { error: er } = await sb.rpc('cancel_appointment', { p_appointment: id });
    if (er) { toast(errMsg(er)); return; } toast('Agendamento cancelado.', true); VIEWS.meus(el);
  };
};

VIEWS.planos = async (el, p) => {
  const sub = await mySub(), want = p.get('plano');
  const plans = S.plans.filter((x) => x.active);
  el.innerHTML = `<h1>Planos mensais</h1><p class="muted">Cada visita inclui corte + barba. Os demais serviços não estão inclusos no plano.</p>
  ${sub.s ? `<div class="card hl"><h3>Meu plano: ${esc(sub.s.plans.name)}</h3><p class="big">${subLabel(sub)}</p>${sub.live ? `<p>${sub.credits} visita(s) disponível(is) · vale até ${new Date(sub.s.current_period_end).toLocaleDateString('pt-BR', { timeZone: TZ })}</p><a class="btn" href="#/app/agendar">Agendar com o plano</a>` : sub.s.status === 'pending_payment' ? `<p>Para liberar suas visitas, combine o pagamento (${brl(sub.s.plans.price_cents)}) com a barbearia. Depois que o pagamento for confirmado, o plano é ativado.</p><a class="btn" target="_blank" rel="noopener" href="${waLink('Olá! Quero pagar o ' + sub.s.plans.name + ' (' + brl(sub.s.plans.price_cents) + ').')}">Combinar pagamento no WhatsApp</a>` : '<p>Seu plano venceu. Fale com a barbearia para renovar.</p>'}</div>` : ''}
  <div class="grid">${plans.map((x) => `<div class="card plan${String(x.visits_per_month) === want ? ' hl' : ''}"><h3>${esc(x.name)}</h3><p class="price"><small>R$</small>${(x.price_cents / 100).toFixed(0)}<small>/mês</small></p><ul>${(x.benefits || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul><button class="btn" data-plan="${x.id}" ${sub.s ? 'disabled' : ''}>${sub.s ? 'Você já tem um plano' : 'Quero este plano'}</button></div>`).join('')}</div>`;
  el.onclick = async (e) => {
    const id = e.target.dataset.plan; if (!id) return; e.target.disabled = true;
    const { error } = await sb.rpc('create_subscription', { p_shop: S.shop.id, p_plan: id });
    if (error) { toast(errMsg(error)); e.target.disabled = false; return; }
    toast('Pedido enviado! Combine o pagamento com a barbearia para ativar.', true); VIEWS.planos(el, new URLSearchParams());
  };
};

VIEWS.conta = async (el) => {
  const p = S.profile, prov = (S.user.identities || []).map((i) => i.provider).join(', ');
  el.innerHTML = `<h1>Configurações</h1><div class="card"><h3>Meus dados</h3><form id="f-conta" class="form" novalidate>
    <label>Nome completo<input id="c-nome" value="${esc(p.full_name)}" autocomplete="name"></label>
    <label>Telefone / WhatsApp<input id="c-tel" value="${esc(p.phone)}" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000"></label>
    <label>E-mail<input value="${esc(S.user.email)}" disabled></label><p class="muted small">Entrou com: ${esc(prov || '—')}</p>
    <label class="check"><input type="checkbox" id="c-mkt" ${p.marketing_consent ? 'checked' : ''}><span>Quero receber novidades e promoções da barbearia (opcional)</span></label>
    <button class="btn">Salvar</button></form></div>
  <div class="card"><h3>Privacidade (LGPD)</h3><p class="muted">Usamos seus dados só para agendamentos e planos. Você pode pedir acesso, correção ou exclusão dos seus dados quando quiser.</p>
   <a class="btn ghost" target="_blank" rel="noopener" href="${waLink('Olá! Quero solicitar acesso/correção/exclusão dos meus dados (LGPD).')}">Falar sobre meus dados</a></div>
  <div class="card"><button class="btn ghost" id="c-sair">Sair da conta</button></div>`;
  $('#c-sair').onclick = () => sb.auth.signOut().then(() => { location.hash = ''; });
  $('#f-conta').onsubmit = async (e) => {
    e.preventDefault(); const name = $('#c-nome').value.trim(); if (name.length < 2) { toast('Digite seu nome completo.'); return; }
    const mk = $('#c-mkt').checked, upd = { full_name: name, phone: $('#c-tel').value.trim() || null, marketing_consent: mk };
    if (mk !== !!p.marketing_consent) upd.marketing_consent_at = new Date().toISOString();
    const { error } = await sb.from('profiles').update(upd).eq('id', S.user.id);
    if (error) { toast(errMsg(error)); return; }
    Object.assign(S.profile, upd); $('#who').textContent = first(name); toast('Dados salvos.', true);
    if (mk !== !!p.marketing_consent) await sb.from('consents').insert({ user_id: S.user.id, purpose: 'marketing', version: '2026-11', granted: mk });
  };
};
window.__app = { S, VIEWS, CFG, sb, ROOT, helpers: { esc, brl, addDays, ymd, dayStart, dow, ico, toast, errMsg, badge, waLink, DOWN, fTime, fDay, fDayLong, first } };
})();
