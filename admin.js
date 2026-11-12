/* Barbearia · Painel da barbearia (agenda, serviços, clientes, financeiro, configurações). Carrega depois de app.js. */
(() => {
'use strict';
const { S, VIEWS, sb, helpers: H } = window.__app;
const { esc, brl, addDays, ymd, dayStart, DOWN, toast, errMsg, badge, fTime, fDay, fDayLong } = H;
const ROOT = window.__app.ROOT;
const $ = (s, r = ROOT) => r.querySelector(s), $$ = (s, r = ROOT) => [...r.querySelectorAll(s)];
const isAdmin = () => S.role === 'owner' || S.role === 'manager';
const reais = (c) => ((c || 0) / 100).toFixed(2).replace('.', ',');
const toCents = (v) => { let s = String(v).trim(); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = parseFloat(s); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN; };
const rng = (s) => { const m = String(s).match(/^[\[(]"?([^",]+)"?,"?([^"\])]+)"?[\])]$/); if (!m) return null; const f = (x) => new Date(x.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')); return [f(m[1]), f(m[2])]; };
const hhmm = (t) => (t || '').slice(0, 5);
const wa = (t) => H.waLink(t);

// ---------- AGENDA
const AG = { day: '' };
VIEWS.agenda = async (el) => {
  if (!AG.day) AG.day = ymd(new Date());
  const from = dayStart(AG.day), to = dayStart(addDays(AG.day, 1));
  const [{ data, error }, bl] = await Promise.all([
    sb.rpc('admin_appointments', { p_shop: S.shop.id, p_from: from.toISOString(), p_to: to.toISOString() }),
    isAdmin() ? sb.from('blocked_times').select('id,staff_id,reason,during').eq('shop_id', S.shop.id) : Promise.resolve({ data: [] }),
  ]);
  if (error) throw error;
  const list = data || [], active = list.filter((a) => a.status === 'confirmed' || a.status === 'completed');
  const blocks = (bl.data || []).map((b) => ({ ...b, r: rng(b.during) })).filter((b) => b.r && b.r[0] < to && b.r[1] > from);
  const groups = {}; list.forEach((a) => { (groups[a.staff_name] = groups[a.staff_name] || []).push(a); });
  const act = (a) => !isAdmin() ? '' : a.status === 'confirmed' ? `<button class="btn sm" data-st="completed" data-id="${a.id}">Concluir</button><button class="btn ghost sm" data-st="no_show" data-id="${a.id}">Faltou</button><button class="btn ghost sm" data-cancel="${a.id}">Cancelar</button>` : (a.status === 'completed' || a.status === 'no_show') ? `<button class="btn ghost sm" data-st="confirmed" data-id="${a.id}">Reabrir</button>` : '';
  el.innerHTML = `<h1>Agenda</h1><div class="bar row between"><div class="row"><button class="btn ghost sm" data-d="-1" aria-label="Dia anterior">‹</button><b class="cap">${esc(fDayLong(from))}</b><button class="btn ghost sm" data-d="1" aria-label="Próximo dia">›</button></div><button class="btn ghost sm" data-d="0">Hoje</button></div>
  <div class="kpis"><div class="kpi"><small>Atendimentos</small><b>${active.length}</b></div><div class="kpi"><small>Concluídos</small><b>${list.filter((a) => a.status === 'completed').length}</b></div><div class="kpi"><small>Cancelados / faltas</small><b>${list.filter((a) => a.status === 'canceled' || a.status === 'no_show').length}</b></div></div>
  ${Object.keys(groups).length ? Object.entries(groups).map(([n, arr]) => `<div class="card"><h3>${esc(n)}</h3>${arr.map((a) => `<div class="item"><div><b>${fTime(a.start_at)}–${fTime(a.end_at)} · ${esc(a.customer_name || 'Cliente')}</b><p>${esc((a.services || []).join(' + '))}</p><p class="muted">${a.customer_phone ? `<a href="tel:${esc(a.customer_phone)}">${esc(a.customer_phone)}</a> · ` : ''}${a.uses_plan ? 'Plano' : brl(a.total_price_cents)}</p></div><div class="side">${badge(a.status)}<div class="row wrap">${act(a)}</div></div></div>`).join('')}</div>`).join('') : '<div class="card"><p class="muted">Nenhum agendamento neste dia.</p></div>'}
  ${isAdmin() ? `<div class="card"><h3>Bloqueios de agenda</h3>${blocks.length ? blocks.map((b) => `<div class="item"><div><b>${fTime(b.r[0])}–${fTime(b.r[1])} · ${esc((S.staff.find((s) => s.id === b.staff_id) || {}).name || 'Todos os profissionais')}</b><p class="muted">${esc(b.reason || 'Sem motivo')}</p></div><button class="btn ghost sm" data-delb="${b.id}">Remover</button></div>`).join('') : '<p class="muted">Nenhum bloqueio neste dia.</p>'}
    <form id="f-block" class="form" novalidate><h4>Novo bloqueio</h4><div class="two"><label>Profissional<select id="b-staff"><option value="">Todos</option>${S.staff.filter((s) => s.active).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label>Motivo<input id="b-why" placeholder="Folga, compromisso…"></label><label>Início<input id="b-ini" type="time" value="12:00"></label><label>Fim<input id="b-fim" type="time" value="13:00"></label></div><button class="btn ghost">Bloquear neste dia</button></form></div>` : ''}`;
  el.onclick = async (e) => {
    const t = e.target;
    if (t.dataset.d !== undefined) { AG.day = t.dataset.d === '0' ? ymd(new Date()) : addDays(AG.day, +t.dataset.d); VIEWS.agenda(el); return; }
    if (t.dataset.st) { const { error: er } = await sb.rpc('admin_set_appointment_status', { p_appointment: t.dataset.id, p_status: t.dataset.st }); if (er) toast(errMsg(er)); else { toast('Atualizado.', true); VIEWS.agenda(el); } }
    if (t.dataset.cancel && confirm('Cancelar este agendamento? O cliente será avisado por você.')) { const { error: er } = await sb.rpc('cancel_appointment', { p_appointment: t.dataset.cancel }); if (er) toast(errMsg(er)); else { toast('Cancelado.', true); VIEWS.agenda(el); } }
    if (t.dataset.delb) { const { error: er } = await sb.from('blocked_times').delete().eq('id', t.dataset.delb); if (er) toast(errMsg(er)); else VIEWS.agenda(el); }
  };
  const fb = $('#f-block'); if (fb) fb.onsubmit = async (e) => {
    e.preventDefault(); const ini = $('#b-ini').value, fim = $('#b-fim').value;
    if (!ini || !fim || fim <= ini) { toast('Informe um início e um fim válidos.'); return; }
    const a = dayStart(AG.day).getTime(), t0 = new Date(a + (+ini.slice(0, 2) * 60 + +ini.slice(3)) * 60000), t1 = new Date(a + (+fim.slice(0, 2) * 60 + +fim.slice(3)) * 60000);
    const { error: er } = await sb.from('blocked_times').insert({ shop_id: S.shop.id, staff_id: $('#b-staff').value || null, during: `[${t0.toISOString()},${t1.toISOString()})`, reason: $('#b-why').value.trim() || null, created_by: S.user.id });
    if (er) toast(errMsg(er)); else { toast('Horário bloqueado.', true); VIEWS.agenda(el); }
  };
};

// ---------- SERVIÇOS E PREÇOS
VIEWS.servicos = async (el) => {
  const [sv, pl] = await Promise.all([sb.from('services').select('*').eq('shop_id', S.shop.id).order('sort_order'), sb.from('plans').select('*').eq('shop_id', S.shop.id).order('sort_order')]);
  S.services = sv.data || []; S.plans = pl.data || [];
  const srow = (s) => `<div class="erow" data-t="svc" data-id="${s ? s.id : 'new'}"><label>Serviço<input data-f="name" value="${esc(s && s.name)}" placeholder="Nome"></label><label>Preço (R$)<input data-f="price" inputmode="decimal" value="${s ? reais(s.price_cents) : ''}" placeholder="0,00"></label><label>Duração (min)<input data-f="dur" inputmode="numeric" value="${s ? s.duration_min : ''}" placeholder="20"></label><label class="check"><input type="checkbox" data-f="inc" ${s && s.included_in_plans ? 'checked' : ''}><span>No plano</span></label><label class="check"><input type="checkbox" data-f="act" ${!s || s.active ? 'checked' : ''}><span>Ativo</span></label><button class="btn sm" data-save>${s ? 'Salvar' : 'Adicionar'}</button></div>`;
  const prow = (p) => `<div class="erow" data-t="plan" data-id="${p.id}"><label>Plano<input data-f="name" value="${esc(p.name)}"></label><label>Preço/mês (R$)<input data-f="price" inputmode="decimal" value="${reais(p.price_cents)}"></label><label>Visitas/mês<input data-f="vis" inputmode="numeric" value="${p.visits_per_month}"></label><label class="check"><input type="checkbox" data-f="act" ${p.active ? 'checked' : ''}><span>Ativo</span></label><button class="btn sm" data-save>Salvar</button></div>`;
  el.innerHTML = `<h1>Serviços e preços</h1><p class="muted">Agendamentos antigos guardam o preço e a duração da época. Mudanças valem para novos agendamentos.</p>
  <div class="card"><h3>Serviços</h3>${S.services.map(srow).join('')}<h4>Novo serviço</h4>${srow(null)}</div>
  <div class="card"><h3>Planos mensais</h3>${S.plans.map(prow).join('')}<p class="muted small">Cada visita do plano inclui os serviços marcados como "No plano".</p></div>`;
  el.onclick = async (e) => {
    if (!e.target.hasAttribute('data-save')) return;
    const r = e.target.closest('.erow'), g = (f) => $(`[data-f="${f}"]`, r), t = r.dataset.t, id = r.dataset.id, name = g('name').value.trim(), price = toCents(g('price').value);
    if (name.length < 2 || Number.isNaN(price)) { toast('Preencha o nome e um preço válido.'); return; }
    let q;
    if (t === 'svc') {
      const dur = parseInt(g('dur').value, 10); if (!(dur > 0)) { toast('Informe a duração em minutos.'); return; }
      const row = { name, price_cents: price, duration_min: dur, included_in_plans: g('inc').checked, active: g('act').checked };
      q = id === 'new' ? sb.from('services').insert({ ...row, shop_id: S.shop.id, sort_order: S.services.length + 1 }).select('id').single() : sb.from('services').update(row).eq('id', id).select('id');
    } else {
      const vis = parseInt(g('vis').value, 10); if (!(vis > 0)) { toast('Informe as visitas por mês.'); return; }
      const benefits = [vis + ' cortes por mês', 'Barba em todas as visitas'];
      q = sb.from('plans').update({ name, price_cents: price, visits_per_month: vis, active: g('act').checked, benefits }).eq('id', id).select('id');
    }
    const { data, error } = await q;
    if (error || !data || (Array.isArray(data) && !data.length)) { toast(error ? errMsg(error) : 'Sem permissão para alterar.'); return; }
    if (t === 'svc' && id === 'new') { const act = S.staff.filter((s) => s.active); if (act.length) await sb.from('staff_services').insert(act.map((s) => ({ staff_id: s.id, service_id: data.id }))); }
    toast('Salvo.', true); VIEWS.servicos(el);
  };
};

// ---------- CLIENTES
VIEWS.clientes = async (el) => {
  const { data, error } = await sb.rpc('admin_customers', { p_shop: S.shop.id }); if (error) throw error;
  const PL = { pending_payment: 'Aguardando pagamento', active: 'Ativo', paused: 'Pausado', canceled: 'Cancelado', expired: 'Vencido' };
  const draw = (q) => {
    const rows = (data || []).filter((c) => !q || (c.full_name || '').toLowerCase().includes(q) || (c.phone || '').includes(q));
    $('#cl-body').innerHTML = rows.length ? rows.map((c) => `<tr><td><b>${esc(c.full_name || 'Sem nome')}</b><br><small class="muted">desde ${new Date(c.joined + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</small></td><td>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'}</td><td>${c.visits}</td><td>${c.last_visit ? esc(fDay(c.last_visit)) : '—'}</td><td>${c.plan_name ? esc(c.plan_name) + '<br><small class="muted">' + (PL[c.plan_status] || '') + '</small>' : '—'}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Nenhum cliente encontrado.</td></tr>';
  };
  el.innerHTML = `<h1>Clientes</h1><div class="card"><input id="cl-q" type="search" placeholder="Buscar por nome ou telefone" aria-label="Buscar cliente"><div class="scroll"><table class="tbl"><thead><tr><th>Cliente</th><th>Telefone</th><th>Visitas</th><th>Última visita</th><th>Plano</th></tr></thead><tbody id="cl-body"></tbody></table></div><p class="muted small">Aparecem clientes que já agendaram ou contrataram um plano. Dados pessoais só para quem tem permissão.</p></div>`;
  draw(''); $('#cl-q').oninput = (e) => draw(e.target.value.trim().toLowerCase());
};

// ---------- FINANCEIRO
const FIN = { p: '30d' };
VIEWS.financeiro = async (el) => {
  const today = ymd(new Date()); let a = today, b = addDays(today, 1);
  if (FIN.p === '7d') a = addDays(today, -6); else if (FIN.p === '30d') a = addDays(today, -29);
  else if (FIN.p === 'mes') { a = today.slice(0, 8) + '01'; const d = new Date(a + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); b = d.toISOString().slice(0, 10); }
  const [fin, subs] = await Promise.all([sb.rpc('admin_finance', { p_shop: S.shop.id, p_from: dayStart(a).toISOString(), p_to: dayStart(b).toISOString() }), sb.rpc('admin_subscriptions', { p_shop: S.shop.id })]);
  if (fin.error) throw fin.error; const f = fin.data || {}, rows = subs.data || [], max = Math.max(1, ...(f.by_day || []).map((x) => x.cents));
  const PT = { hoje: 'Hoje', '7d': '7 dias', '30d': '30 dias', mes: 'Este mês' }, ST = { pending_payment: 'Aguardando pagamento', active: 'Ativo', paused: 'Pausado', canceled: 'Cancelado', expired: 'Vencido' };
  el.innerHTML = `<h1>Financeiro</h1><div class="chips">${Object.entries(PT).map(([k, v]) => `<button class="chip${FIN.p === k ? ' on' : ''}" data-p="${k}">${v}</button>`).join('')}</div>
  <div class="kpis"><div class="kpi hl"><small>Recebido no período</small><b>${brl((f.received_cents || 0) + (f.plans_confirmed_cents || 0))}</b><em>Atendimentos concluídos ${brl(f.received_cents)} + planos confirmados ${brl(f.plans_confirmed_cents)}</em></div>
   <div class="kpi"><small>Agendado (a realizar)</small><b>${brl(f.scheduled_cents)}</b><em>${f.confirmed || 0} atendimento(s) confirmado(s)</em></div>
   <div class="kpi"><small>Contratado por mês</small><b>${brl(f.contracted_monthly_cents)}</b><em>${f.active_subscriptions || 0} assinatura(s) ativa(s)</em></div></div>
  <div class="kpis"><div class="kpi"><small>Concluídos</small><b>${f.completed || 0}</b></div><div class="kpi"><small>Cancelados</small><b>${f.canceled || 0}</b></div><div class="kpi"><small>Faltas</small><b>${f.no_show || 0}</b></div></div>
  <div class="card"><h3>Receita por dia (concluídos)</h3>${(f.by_day || []).length ? `<div class="bars">${f.by_day.map((x) => `<div class="bcol" title="${esc(x.day)}: ${brl(x.cents)}"><i style="height:${Math.max(4, Math.round(x.cents / max * 100))}%"></i><small>${x.day.slice(8)}</small></div>`).join('')}</div>` : '<p class="muted">Ainda não há atendimentos concluídos neste período. Marque como "Concluir" na Agenda.</p>'}</div>
  <div class="card"><h3>Serviços mais procurados</h3>${(f.top_services || []).length ? (f.top_services).map((x) => `<div class="item"><b>${esc(x.name)}</b><span>${x.count}×</span></div>`).join('') : '<p class="muted">Sem dados no período.</p>'}</div>
  <div class="card"><h3>Assinaturas</h3>${rows.length ? rows.map((s) => `<div class="item"><div><b>${esc(s.customer_name || 'Cliente')} · ${esc(s.plan_name)}</b><p class="muted">${brl(s.price_cents)}/mês · ${esc(ST[s.status] || s.status)}${s.status === 'active' ? ` · ${s.credits_left} visita(s) restante(s)` : ''}${s.customer_phone ? ' · ' + esc(s.customer_phone) : ''}</p></div>${s.status === 'pending_payment' ? `<button class="btn sm" data-act="${s.id}">Confirmar pagamento e ativar</button>` : ''}</div>`).join('') : '<p class="muted">Nenhuma assinatura ainda.</p>'}
   <p class="muted small">Os pagamentos ainda não são online: você confirma manualmente quando receber (Pix, dinheiro ou cartão). "Recebido" só conta atendimentos concluídos e planos que você ativou. Não confunda com valor agendado ou contratado.</p></div>`;
  el.onclick = async (e) => {
    if (e.target.dataset.p) { FIN.p = e.target.dataset.p; VIEWS.financeiro(el); return; }
    if (e.target.dataset.act && confirm('Confirmar que o pagamento foi recebido e ativar o plano?')) { const { error } = await sb.rpc('activate_subscription', { p_subscription: e.target.dataset.act }); if (error) toast(errMsg(error)); else { toast('Plano ativado.', true); VIEWS.financeiro(el); } }
  };
};

// ---------- BARBEARIA (configurações do estabelecimento)
VIEWS.barbearia = async (el) => {
  const [sh, se, ho, st] = await Promise.all([sb.from('shops').select('*').eq('id', S.shop.id).single(), sb.from('business_settings').select('*').eq('shop_id', S.shop.id).single(),
    sb.from('business_hours').select('*').eq('shop_id', S.shop.id).is('staff_id', null), sb.from('staff').select('*').eq('shop_id', S.shop.id).order('created_at')]);
  Object.assign(S.shop, sh.data); S.settings = se.data; S.hours = ho.data || []; S.staff = st.data || [];
  const hrow = (d) => { const h = S.hours.find((x) => x.weekday === d); return `<div class="erow hrow" data-d="${d}"><label class="check"><input type="checkbox" data-f="open" ${h ? 'checked' : ''}><span><b>${DOWN[d]}</b></span></label><label>Abre<input type="time" data-f="o" value="${h ? hhmm(h.open_time) : '09:00'}"></label><label>Fecha<input type="time" data-f="c" value="${h ? hhmm(h.close_time) : '18:00'}"></label><label>Almoço de<input type="time" data-f="bs" value="${h ? hhmm(h.break_start) : '12:00'}"></label><label>até<input type="time" data-f="be" value="${h ? hhmm(h.break_end) : '13:00'}"></label></div>`; };
  const s = S.settings;
  el.innerHTML = `<h1>Barbearia</h1>
  <div class="card"><h3>Dados do estabelecimento</h3><form id="f-shop" class="form" novalidate><div class="two"><label>Nome<input id="s-name" value="${esc(S.shop.name)}"></label><label>Telefone<input id="s-phone" value="${esc(S.shop.phone)}"></label><label>WhatsApp (só números, com 55)<input id="s-wa" inputmode="numeric" value="${esc(S.shop.whatsapp)}"></label><label>Endereço<input id="s-addr" value="${esc(S.shop.address)}"></label></div><button class="btn">Salvar dados</button></form></div>
  <div class="card"><h3>Horário de funcionamento</h3><form id="f-hours" class="form" novalidate>${[2, 3, 4, 5, 6, 0, 1].map(hrow).join('')}<p class="muted small">Dias desmarcados ficam fechados. Nenhum atendimento começa ou continua no horário de almoço.</p><button class="btn">Salvar horários</button></form></div>
  <div class="card"><h3>Regras de agendamento</h3><form id="f-rules" class="form" novalidate><div class="two"><label>Intervalo entre horários (min)<input id="r-step" inputmode="numeric" value="${s.slot_step_min}"></label><label>Antecedência mínima (min)<input id="r-min" inputmode="numeric" value="${s.min_notice_min}"></label><label>Agendar até (dias à frente)<input id="r-max" inputmode="numeric" value="${s.max_advance_days}"></label><label>Cancelar até (min antes)<input id="r-can" inputmode="numeric" value="${s.cancel_window_min}"></label></div><button class="btn">Salvar regras</button></form></div>
  <div class="card"><h3>Equipe</h3>${S.staff.map((p) => `<div class="erow" data-staff="${p.id}"><label>Profissional<input data-f="name" value="${esc(p.name)}"></label><label class="check"><input type="checkbox" data-f="act" ${p.active ? 'checked' : ''}><span>Ativo</span></label><button class="btn sm" data-save>Salvar</button></div>`).join('')}<h4>Novo profissional</h4><div class="erow" data-staff="new"><label>Nome<input data-f="name" placeholder="Nome"></label><span></span><button class="btn sm" data-save>Adicionar</button></div></div>`;
  const num = (id, min) => { const v = parseInt($(id).value, 10); return Number.isFinite(v) && v >= min ? v : NaN; };
  $('#f-shop').onsubmit = async (e) => {
    e.preventDefault(); const name = $('#s-name').value.trim(); if (name.length < 2) { toast('Digite o nome.'); return; }
    const { data, error } = await sb.from('shops').update({ name, phone: $('#s-phone').value.trim() || null, whatsapp: $('#s-wa').value.replace(/\D/g, '') || null, address: $('#s-addr').value.trim() || null }).eq('id', S.shop.id).select('id');
    if (error || !data.length) toast(error ? errMsg(error) : 'Só o proprietário pode alterar estes dados.'); else toast('Dados salvos.', true);
  };
  $('#f-hours').onsubmit = async (e) => {
    e.preventDefault();
    for (const r of $$('.hrow')) {
      const d = +r.dataset.d, g = (f) => $(`[data-f="${f}"]`, r), ex = S.hours.find((x) => x.weekday === d);
      if (!g('open').checked) { if (ex) { const { error } = await sb.from('business_hours').delete().eq('id', ex.id); if (error) { toast(errMsg(error)); return; } } continue; }
      const o = g('o').value, c = g('c').value, bs = g('bs').value || null, be = g('be').value || null;
      if (!o || !c || c <= o || (!!bs !== !!be) || (bs && (bs >= be || bs < o || be > c))) { toast(`Confira os horários de ${DOWN[d]}.`); return; }
      const row = { shop_id: S.shop.id, staff_id: null, weekday: d, open_time: o, close_time: c, break_start: bs, break_end: be };
      const { error } = ex ? await sb.from('business_hours').update(row).eq('id', ex.id) : await sb.from('business_hours').insert(row);
      if (error) { toast(errMsg(error)); return; }
    }
    toast('Horários salvos.', true); VIEWS.barbearia(el);
  };
  $('#f-rules').onsubmit = async (e) => {
    e.preventDefault(); const v = { slot_step_min: num('#r-step', 5), min_notice_min: num('#r-min', 0), max_advance_days: num('#r-max', 1), cancel_window_min: num('#r-can', 0) };
    if (Object.values(v).some(Number.isNaN) || v.slot_step_min > 60) { toast('Confira os números (intervalo de 5 a 60 minutos).'); return; }
    const { error } = await sb.from('business_settings').update(v).eq('shop_id', S.shop.id); if (error) toast(errMsg(error)); else { Object.assign(S.settings, v); toast('Regras salvas.', true); }
  };
  el.onclick = async (e) => {
    const r = e.target.closest('[data-staff]'); if (!r || !e.target.hasAttribute('data-save')) return;
    const name = $('[data-f="name"]', r).value.trim(); if (name.length < 2) { toast('Digite o nome.'); return; }
    if (r.dataset.staff === 'new') {
      const { data, error } = await sb.from('staff').insert({ shop_id: S.shop.id, name }).select('id').single(); if (error) { toast(errMsg(error)); return; }
      const sv = S.services.filter((x) => x.active); if (sv.length) await sb.from('staff_services').insert(sv.map((x) => ({ staff_id: data.id, service_id: x.id })));
    } else {
      const { error } = await sb.from('staff').update({ name, active: $('[data-f="act"]', r).checked }).eq('id', r.dataset.staff); if (error) { toast(errMsg(error)); return; }
    }
    toast('Equipe atualizada.', true); VIEWS.barbearia(el);
  };
};
})();
