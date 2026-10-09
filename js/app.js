/* Slipstream prototype. Plain JavaScript, no build step.
   Everything here is simulated in the browser. Money moves through ONE function (book) so the split is consistent everywhere. */
(function () {
  'use strict';
  const D = window.DATA;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[rint(0, arr.length - 1)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inr = (n, d) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const inr2 = n => inr(n, 2);
  const inrShort = n => '₹' + (n >= 1e7 ? (n / 1e7).toFixed(2) + ' Cr' : n >= 1e5 ? (n / 1e5).toFixed(1) + ' L' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' K' : n.toFixed(0));
  const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[rint(0, 15)]).join('');
  const clock = ts => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const sig = id => D.signals.find(s => s.id === id);
  const prod = id => D.products.find(p => p.id === id);
  const DEV = 'Torque & Co.';
  const BIZ = 'Orbit Logistics';

  let S, V;

  /* ---------- State ---------- */
  function fresh() {
    return {
      persona: 'overview',
      view: { driver: 'home', business: 'catalog', developer: 'catalog', oem: 'dashboard' },
      consent: { location: false, driving: true, battery: true, diagnostics: false, trips: false },
      installed: {}, openApp: null, licences: {}, invoices: [], openBiz: null,
      apps: D.apps.concat(D.bizApps).map(a => Object.assign({ rev: a.installs * a.price }, a)),
      wallet: 120.5, walletIn: 0, spent: 0,
      ledger: [], seq: 0, totals: { dataGross: 0, appGross: 0, driver: 0, dev: 0, oem: 0 },
      cut: 20, access: {}, accessLog: [],
      audit: [{ ts: Date.now() - 5 * 3600e3, text: 'Account created. Sharing was off by default.' }, { ts: Date.now() - 4 * 3600e3, text: 'Consent granted: Driving behaviour' }, { ts: Date.now() - 4 * 3600e3, text: 'Consent granted: Battery and energy' }],
      revoked: 312, apiKey: null, apiProduct: 'driving', apiOut: '',
      last: null, tick: 0, booking: null, running: true, simN: 0
    };
  }
  function freshV() { return { k: 0, t: 0, speed: 0, prevSpeed: 0, soc: 82, temp: 41, tyre: [33.1, 33, 32.8, 33.2], odo: 18432, brakes: 0, score: 86 }; }

  /* ---------- Money. Every payment goes through book() ---------- */
  function split(kind, gross) {
    const c = S.cut / 100;
    if (kind === 'data') return { driver: gross * (1 - c), dev: 0, oem: gross * c };
    if (kind === 'biz') { const p = D.bizPoolPct; return { driver: gross * p, dev: gross * (1 - c - p), oem: gross * c }; }
    return { driver: 0, dev: gross * (1 - c), oem: gross * c };
  }
  function entry(kind, title, gross, extra) { return Object.assign({ kind, title, gross }, split(kind, gross), extra || {}); }
  function book(e) {
    e.id = ++S.seq; e.ts = Date.now();
    S.ledger.unshift(e); if (S.ledger.length > 250) S.ledger.pop();
    const t = S.totals;
    if (e.kind === 'data') t.dataGross += e.gross; else t.appGross += e.gross;
    t.driver += e.driver; t.dev += e.dev; t.oem += e.oem;
    if (e.mine && e.driver > 0) { S.wallet += e.driver; S.walletIn += e.driver; }
    return e;
  }
  function month() {
    const m = D.series[D.series.length - 1], t = S.totals;
    const dataG = m.data * 1000 + t.dataGross, appG = m.app * 1000 + t.appGross;
    return { dataG, appG, gmv: dataG + appG, drv: m.data * 800 + t.driver, dev: m.app * 800 + t.dev, oem: (m.data + m.app) * 200 + t.oem };
  }
  const signalUsed = id => S.apps.some(a => a.status === 'live' && a.signals.includes(id));
  const estOf = s => s.est / 0.8 * (1 - S.cut / 100);
  const estTotal = () => D.signals.filter(s => S.consent[s.id] && signalUsed(s.id)).reduce((a, s) => a + estOf(s), 0);
  const pool = id => id === 'failfeed' ? D.failfeed.vehicles : Math.round(D.fleet * sig(id).share) + (S.consent[id] ? 1 : 0);
  const app = id => S.apps.find(a => a.id === id);
  const audit = text => { S.audit.unshift({ ts: Date.now(), text }); if (S.audit.length > 60) S.audit.pop(); };

  function setConsent(id, on) {
    if (S.consent[id] === on) return;
    S.consent[id] = on;
    if (!on) S.revoked++;
    audit(on ? 'Consent granted: ' + sig(id).name : 'Consent revoked: ' + sig(id).name + '. Developer keys stop receiving it immediately.');
  }

  function economyTick() {
    S.tick++;
    const on = D.signals.filter(s => S.consent[s.id] && signalUsed(s.id));
    if (on.length) {
      const net = on.reduce((a, s) => a + s.est / D.hoursPerMonth, 0);
      book(entry('data', 'Your vehicle: ' + on.map(s => s.short).join(', '), net / 0.8, { mine: true }));
      on.slice(0, 2).forEach(s => {
        const users = S.apps.filter(a => a.status === 'live' && a.signals.includes(s.id));
        S.accessLog.unshift({ ts: Date.now(), app: pick(users).name, signal: s.name, records: rint(40, 160) });
      });
      if (S.accessLog.length > 80) S.accessLog.length = 80;
    }
    const live = S.apps.filter(a => a.status === 'live'), liveC = live.filter(a => a.aud === 'customer'), liveB = live.filter(a => a.aud === 'business');
    const a = pick(live), s = sig(pick(a.signals)), rec = rint(25000, 60000), fee = rec / 1000 * s.rate;
    a.fees += fee;
    book(entry('data', a.name + ' read ' + rec.toLocaleString('en-IN') + ' ' + s.short + ' records', fee, { appId: a.id }));
    const n = rint(2, 6), names = []; let g = 0;
    for (let i = 0; i < n; i++) { const b = pick(liveC); g += b.price; b.installs++; b.rev += b.price; if (names.indexOf(b.name) < 0) names.push(b.name); }
    book(entry('app', n + ' subscriptions sold: ' + names.join(', '), g, {}));
    if (liveB.length && Math.random() < 0.06) { const b = pick(liveB); b.installs++; b.rev += b.price; book(entry('biz', 'A business licensed ' + b.name, b.price, { appId: b.id })); }
  }
  function fastForward() {
    const before = S.walletIn;
    for (let i = 0; i < D.hoursPerMonth; i++) economyTick();
    toast('One month of driving: you earned ' + inr2(S.walletIn - before) + '.');
    render();
  }
  function simulate() {
    S.simN++;
    const kind = S.simN % 3, live = S.apps.filter(x => x.status === 'live');
    if (kind === 1) { const a = pick(live.filter(x => x.aud === 'customer')); a.installs++; a.rev += a.price; S.last = book(entry('app', 'A new customer subscribed to ' + a.name, a.price, { appId: a.id })); }
    else if (kind === 2) { const a = pick(live), s = sig(pick(a.signals)), rec = rint(30000, 80000), fee = rec / 1000 * s.rate; a.fees += fee; S.last = book(entry('data', a.name + ' paid to read ' + rec.toLocaleString('en-IN') + ' ' + s.short + ' records', fee, { appId: a.id })); }
    else { const a = pick(live.filter(x => x.aud === 'business')); a.installs++; a.rev += a.price; S.last = book(entry('biz', 'A business licensed ' + a.name, a.price, { appId: a.id })); }
    refreshLive();
  }

  /* ---------- Telemetry (simulated) ---------- */
  function telemetryTick() {
    V.k++;
    const target = 48 + 22 * Math.sin(V.k / 9) + 12 * Math.sin(V.k / 3.3);
    V.prevSpeed = V.speed;
    V.speed = clamp(V.speed + (target - V.speed) * 0.35 + rnd(-1.5, 1.5), 0, 120);
    const drop = V.prevSpeed - V.speed;
    if (drop > 4.5) V.brakes++;
    V.t = (V.t + V.speed / 9000) % 1;
    V.odo += V.speed / 3600 * 12;
    V.soc = clamp(V.soc - V.speed * 0.00006, 8, 100);
    V.temp += (40 + V.speed * 0.16 - V.temp) * 0.05;
    V.tyre = V.tyre.map(p => p + rnd(-0.02, 0.02));
    V.score = clamp(V.score + (100 - Math.abs(drop) * 3.6 - V.score) * 0.03, 40, 99);
  }
  let PATH_LEN = 0;
  function pointAt(f) {
    const p = $('#trackPath');
    if (p && p.getTotalLength) { if (!PATH_LEN) PATH_LEN = p.getTotalLength(); const pt = p.getPointAtLength(f * PATH_LEN); return { x: pt.x, y: pt.y }; }
    const a = f * 6.283; return { x: 200 + 150 * Math.cos(a), y: 120 + 80 * Math.sin(a) };
  }
  function updateMap() { const pt = pointAt(V.t); $$('.cardot').forEach(c => { c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1)); }); }
  function mapSVG(showHazards) {
    const hz = showHazards ? D.hazards.map(h => { const p = pointAt(h); return '<circle class="hz" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="8"><title>Hard-braking spot</title></circle>'; }).join('') : '';
    return '<svg class="map" viewBox="0 0 400 240" role="img" aria-label="Live position on the circuit"><path class="trk-bg" d="' + D.trackD + '"/><path class="trk-line" d="' + D.trackD + '"/>' + hz + '<circle class="cardot" r="8" cx="60" cy="170"/></svg>';
  }

  /* ---------- Live bindings ---------- */
  function binds() {
    const m = month(), any = Object.values(S.consent).some(Boolean), disc = clamp((V.score - 60) / 40 * 25, 0, 25);
    const ahead = Math.min.apply(null, D.hazards.map(h => (h - V.t + 1) % 1)), meters = Math.round(ahead * 2400);
    return {
      speed: Math.round(V.speed), soc: Math.round(V.soc) + '%', temp: Math.round(V.temp) + ' °C',
      tyre: (V.tyre.reduce((a, b) => a + b, 0) / 4).toFixed(1) + ' psi', odo: Math.round(V.odo).toLocaleString('en-IN') + ' km', brakes: V.brakes,
      wallet: inr2(S.wallet), earned: inr2(S.walletIn), spent: inr2(S.spent), est: inr(estTotal()) + ' a month',
      score: Math.round(V.score), range: Math.round(V.soc * 3.9) + ' km', discount: Math.round(disc) + '%', premium: inr(Math.round(1850 * (1 - disc / 100))) + ' a month',
      tradein: inr(Math.max(500000, Math.round(1650000 - V.odo * 40))),
      hazard: (meters < 250 ? 'Ease off now: ' : '') + 'hard-braking spot in ' + meters + ' m, reported by 37 vehicles',
      gmv: inrShort(m.gmv), drv: inrShort(m.drv), dev: inrShort(m.dev), oem: inrShort(m.oem),
      vehicles: (D.fleet + (any ? 1 : 0)).toLocaleString('en-IN'), cut: S.cut + '%', revoked: S.revoked.toLocaleString('en-IN')
    };
  }
  const widths = () => ({ soc: V.soc, score: V.score });
  function refreshLive() {
    const b = binds();
    $$('[data-bind]').forEach(el => { const k = el.dataset.bind; if (k in b) { const v = String(b[k]); if (el.textContent !== v) el.textContent = v; } });
    const w = widths();
    $$('[data-w]').forEach(el => { const k = el.dataset.w; if (k in w) el.style.width = w[k] + '%'; });
    $$('[data-live]').forEach(el => { const f = LIVE[el.dataset.live]; if (!f) return; const h = f(); if (el._h !== h) { el.innerHTML = h; el._h = h; } });
    updateMap();
  }

  /* ---------- Live fragments ---------- */
  const LIVE = {
    bizApp() {
      const a = app(S.openBiz); if (!a || !BIZUI[a.id]) return '';
      return '<div class="kpis">' + BIZUI[a.id]().map(k => '<div class="kpi lane-b"><span class="kl">' + k[0] + '</span><b>' + k[1] + '</b></div>').join('') + '</div>';
    },
    lastSplit() {
      const e = S.last; if (!e) return '';
      const pc = x => (x / e.gross * 100).toFixed(1);
      const rows = [['d', 'Customers', e.driver], ['v', 'Developer', e.dev], ['o', 'OEM', e.oem]].filter(r => r[2] > 0);
      const who = { data: 'Paid by a developer for data access', app: 'Paid by an individual customer for an app', biz: 'Paid by a business for an app licence' }[e.kind];
      return '<p class="split-title">' + esc(e.title) + '</p><div class="amount">' + inr2(e.gross) + '</div><p class="note">' + who + '</p>' +
        '<div class="splitbar">' + rows.map(r => '<i class="seg ' + r[0] + '" style="width:' + pc(r[2]) + '%"></i>').join('') + '</div>' +
        '<ul class="legend">' + rows.map(r => '<li><span class="dot ' + r[0] + '"></span>' + r[1] + '<b>' + inr2(r[2]) + '</b><em>' + pc(r[2]) + '%</em></li>').join('') + '</ul>';
    },
    chart() {
      const rows = D.series.map((m, i) => {
        if (i < D.series.length - 1) return { l: m.m, d: m.data * 800, v: m.app * 800, o: (m.data + m.app) * 200 };
        const t = month(); return { l: m.m + ' live', d: t.drv, v: t.dev, o: t.oem };
      });
      const W = 680, H = 280, base = H - 34, top = 30, max = Math.max.apply(null, rows.map(r => r.d + r.v + r.o)), sc = (base - top) / max, slot = (W - 20) / rows.length, bw = slot * 0.6;
      let g = '';
      rows.forEach((r, i) => {
        const x = 20 + i * slot + (slot - bw) / 2; let y = base;
        [['d', r.d, '#1E9E62'], ['v', r.v, '#2A6F97'], ['o', r.o, '#8A4B9E']].forEach(p => { const h = p[1] * sc; y -= h; g += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + p[2] + '"/>'; });
        g += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle" font-size="12" fill="#14212B" font-family="Barlow">' + inrShort(r.d + r.v + r.o) + '</text>';
        g += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (base + 18) + '" text-anchor="middle" font-size="13" fill="#46535F" font-family="Barlow">' + r.l + '</text>';
      });
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto" role="img" aria-label="Monthly money moved, split by customers, developers and the OEM"><line x1="14" x2="' + W + '" y1="' + base + '" y2="' + base + '" stroke="#14212B" stroke-width="2"/>' + g + '</svg>';
    },
    ledgerTable() {
      if (!S.ledger.length) return '<p class="note">Nothing yet. The demo clock adds a payment every few seconds, or press "Fast-forward" in the customer app.</p>';
      const type = { data: 'Data fee', app: 'App sale', biz: 'Business licence' };
      return '<div class="scroll"><table class="tbl"><thead><tr><th>Time</th><th>Type</th><th>What happened</th><th class="num">Paid</th><th class="num">Customers</th><th class="num">Developer</th><th class="num">OEM</th></tr></thead><tbody>' +
        S.ledger.slice(0, 40).map(e => '<tr><td>' + clock(e.ts) + '</td><td>' + type[e.kind] + '</td><td>' + esc(e.title) + (e.mine ? ' <span class="chip on">you</span>' : '') + (e.own ? ' <span class="chip warn">Orbit</span>' : '') + '</td><td class="num">' + inr2(e.gross) + '</td><td class="num">' + (e.driver ? inr2(e.driver) : '-') + '</td><td class="num">' + (e.dev ? inr2(e.dev) : '-') + '</td><td class="num">' + inr2(e.oem) + '</td></tr>').join('') + '</tbody></table></div>';
    },
    audit() { return S.audit.slice(0, 8).map(a => '<div class="stat"><span>' + esc(a.text) + '</span><span class="note">' + clock(a.ts) + '</span></div>').join(''); },
    accessLog() {
      if (!S.accessLog.length) return '<p class="note">No access yet. Turn on a signal in "Data and consent" and the log fills in.</p>';
      return '<div class="scroll"><table class="tbl"><thead><tr><th>Time</th><th>App</th><th>Signal read</th><th class="num">Records</th></tr></thead><tbody>' + S.accessLog.slice(0, 8).map(a => '<tr><td>' + clock(a.ts) + '</td><td>' + esc(a.app) + '</td><td>' + esc(a.signal) + '</td><td class="num">' + a.records + '</td></tr>').join('') + '</tbody></table></div>';
    },
    cutExample() {
      const c = S.cut / 100, p = 499, b = 24999, pool = D.bizPoolPct;
      return '<p>On a ' + inr(p) + ' customer subscription, the OEM keeps <b>' + inr2(p * c) + '</b> and the developer receives <b>' + inr2(p * (1 - c)) + '</b>.</p>' +
        '<p>On a ' + inr(b) + ' business licence, the OEM keeps <b>' + inr2(b * c) + '</b>, customers who shared data receive <b>' + inr2(b * pool) + '</b> and the developer receives <b>' + inr2(b * (1 - c - pool)) + '</b>.</p>' +
        '<p>On a ' + inr(1000) + ' data fee, the OEM keeps <b>' + inr2(1000 * c) + '</b> and customers share <b>' + inr2(1000 * (1 - c)) + '</b>.</p>';
    },
    topApps() {
      const rows = S.apps.filter(a => a.status === 'live').sort((a, b) => b.rev - a.rev).slice(0, 6);
      return '<div class="scroll"><table class="tbl"><thead><tr><th>App</th><th>For</th><th>Developer</th><th class="num">Subscribers or licences</th><th class="num">Revenue</th></tr></thead><tbody>' + rows.map(a => '<tr><td>' + esc(a.name) + '</td><td>' + (a.aud === 'business' ? 'Businesses' : 'Customers') + '</td><td>' + esc(a.dev) + '</td><td class="num">' + a.installs.toLocaleString('en-IN') + '</td><td class="num">' + inrShort(a.rev) + '</td></tr>').join('') + '</tbody></table></div>';
    },
    devApps() {
      const mine = S.apps.filter(a => a.dev === DEV);
      let tot = 0, fees = 0;
      const share = a => a.aud === 'business' ? 1 - S.cut / 100 - D.bizPoolPct : 1 - S.cut / 100;
      const rows = mine.map(a => { const r = a.installs * a.price * share(a); if (a.status === 'live') { tot += r; fees += a.fees; } return '<tr><td>' + esc(a.name) + '</td><td>' + (a.aud === 'business' ? 'Businesses' : 'Customers') + '</td><td>' + statusChip(a.status) + '</td><td class="num">' + a.installs.toLocaleString('en-IN') + '</td><td class="num">' + inr(a.price) + '</td><td class="num">' + inr(r) + '</td><td class="num">' + inr(a.fees) + '</td></tr>'; }).join('');
      return '<div class="scroll"><table class="tbl"><thead><tr><th>App</th><th>For</th><th>Status</th><th class="num">Subscribers or licences</th><th class="num">Price a month</th><th class="num">Your monthly revenue</th><th class="num">Data fees paid</th></tr></thead><tbody>' + rows + '<tr><td><b>Total</b></td><td></td><td></td><td></td><td></td><td class="num"><b>' + inr(tot) + '</b></td><td class="num"><b>' + inr(fees) + '</b></td></tr></tbody></table></div>';
    },
    jobcard() {
      const b = S.booking; if (!b) return '';
      const steps = ['Booked by PitCrew Predict', 'Part reserved at the dealer', 'Bay scheduled at the workshop', 'Ready for pickup'];
      return '<h3>Shared job card</h3><p class="note">' + esc(D.dealers[b.dealer]) + ', ' + esc(D.slots[b.slot]) + '. The OEM, the dealer and the workshop all see this same card.</p><ul class="job">' + steps.map((s, i) => '<li class="' + (i <= b.step ? 'done' : '') + '">' + s + '</li>').join('') + '</ul>';
    }
  };
  const statusChip = s => s === 'live' ? '<span class="chip on">Live</span>' : s === 'pending' ? '<span class="chip warn">In review</span>' : '<span class="chip off">Rejected</span>';

  /* ---------- Chrome: tabs, sidebar, toast, modal ---------- */
  const NAV = {
    driver: [['home', 'Home'], ['consent', 'Data and consent'], ['store', 'App store'], ['apps', 'My apps'], ['wallet', 'Wallet and activity']],
    business: [['catalog', 'Business apps'], ['licences', 'My licences and invoices']],
    developer: [['catalog', 'Data catalog'], ['sandbox', 'API sandbox'], ['publish', 'Publish an app'], ['myapps', 'My apps and revenue']],
    oem: [['dashboard', 'Dashboard'], ['approvals', 'App approvals'], ['privacy', 'Privacy and audit'], ['ledger', 'Ledger']]
  };
  const WHO = { driver: ['d', 'Customer app', D.oem.car], business: ['b', 'Business portal', BIZ + ', fleet operator'], developer: ['v', 'Developer portal', DEV], oem: ['o', 'OEM console', 'Vehicle manufacturer'] };
    function go(p, v) {
    S.persona = p; if (v) S.view[p] = v;
    closeModal(); render(); window.scrollTo(0, 0);
  }
  function renderChrome() {
    $$('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.arg === S.persona ? 'page' : 'false'));
    $('#pauseBtn').textContent = S.running ? 'Pause clock' : 'Resume clock';
    const side = $('#side'), shell = $('#shell');
    if (!NAV[S.persona]) { shell.classList.add('solo'); side.innerHTML = ''; return; }
    shell.classList.remove('solo');
    const w = WHO[S.persona];
    side.innerHTML = '<div class="who ' + w[0] + '"><b>' + w[1] + '</b><span>' + esc(w[2]) + '</span></div>' + NAV[S.persona].map(n => '<button data-act="nav" data-arg="' + S.persona + ':' + n[0] + '" aria-current="' + (S.view[S.persona] === n[0] ? 'page' : 'false') + '">' + n[1] + '</button>').join('');
  }
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 4200); }
  function openModal(html) { const m = $('#modal'); m.innerHTML = '<div class="dialog" role="dialog" aria-modal="true">' + html + '</div>'; m.hidden = false; const b = $('.btn.primary', m) || $('.btn', m); if (b) b.focus(); }
  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  const head = (t, p) => '<div class="pagehead"><h1 style="font-size:40px">' + t + '</h1><p>' + p + '</p></div>';
  const sigChips = (ids, showState) => ids.map(id => '<span class="chip ' + (showState ? (S.consent[id] ? 'on' : 'off') : '') + '">' + sig(id).name + (showState ? (S.consent[id] ? ' (on)' : ' (off)') : '') + '</span>').join('');
  const kpiStrip = () => '<div class="kpis"><div class="kpi"><span class="kl">Money moved this month</span><b data-bind="gmv"></b></div><div class="kpi lane-d"><span class="kl">Paid to customers</span><b data-bind="drv"></b></div><div class="kpi lane-v"><span class="kl">Paid to developers</span><b data-bind="dev"></b></div><div class="kpi lane-o"><span class="kl">OEM revenue</span><b data-bind="oem"></b></div><div class="kpi"><span class="kl">Vehicles sharing data</span><b data-bind="vehicles"></b></div></div>';

  /* ---------- Views ---------- */
  const VIEWS = {};

  VIEWS.overview = () => '<section class="hero"><div><h1>Cars generate data. Customers get paid when it\'s used.</h1><p>Slipstream is the OEM\'s marketplace for vehicle data. Individual customers choose what to share and earn from it. Developers build apps on privacy-safe data. Customers subscribe to those apps, and outside businesses such as insurers, fleets, suppliers and dealerships license them. Every payment is split, and the OEM keeps a cut of each one.</p><div class="row"><button class="btn primary" data-act="tour">Start the guided demo</button><button class="btn dark" data-act="simulate">Simulate a payment</button></div></div><div class="hero-split"><h2>Latest payment, split</h2><div data-live="lastSplit"></div></div></section>' +
    kpiStrip() +
    '<section class="panel"><h2>How the loop works</h2><ol class="loop">' +
    [['The customer chooses', 'Switch on only the signals you are happy to share. Switch off any time.', [['driver:consent', 'Open consent']]],
     ['Data is made anonymous', 'VIN and exact position are removed before any developer sees a record.', [['developer:sandbox', 'See what is removed']]],
     ['A developer builds an app', 'Request data products, test in the sandbox, publish for review.', [['developer:catalog', 'Open the catalog']]],
     ['Customers and businesses buy', 'Individuals subscribe in the app store. Businesses license apps for their teams.', [['driver:store', 'Customer store'], ['business:catalog', 'Business apps']]],
     ['Every payment splits', 'Customers, developer and OEM each get their lane.', [['oem:dashboard', 'Open the dashboard']]]
    ].map(s => '<li><h3>' + s[0] + '</h3><p>' + s[1] + '</p>' + s[2].map(l => '<button class="link" data-act="nav" data-arg="' + l[0] + '">' + l[1] + '</button>').join('') + '</li>').join('') + '</ol></section>' +
    '<section class="panel"><h2>Challenges this prototype covers</h2><p class="note">The Telemetry Play is the core. The other four appear as apps and data products on the same marketplace.</p><dl class="covers">' +
    [['The Telemetry Play', 'The whole marketplace: consent, anonymisation, recurring revenue, and a split that includes the OEM.', 'oem:dashboard'],
     ['Zero DNF', 'PitCrew Predict warns a customer about a failing coolant pump. PitCrew Fleet Service does the same for whole fleets.', 'driver:apps'],
     ['The Two-Second Stop', 'Booking the repair creates one shared job card for the OEM, the dealer and the workshop.', 'driver:apps'],
     ['The Second Stint', 'OwnerPulse gives customers loyalty offers, and Dealer Loyalty Engine helps dealerships win them back.', 'business:catalog'],
     ['The Blind Corner', 'Part Pulse gives parts suppliers an early warning on component failures, from aggregated fleet data.', 'business:catalog']
    ].map(c => '<div><dt>' + c[0] + '</dt><dd>' + c[1] + '</dd><button class="link" data-act="nav" data-arg="' + c[2] + '">Show me</button></div>').join('') + '</dl></section>';

  VIEWS['driver:home'] = () => {
    const n = Object.values(S.consent).filter(Boolean).length;
    return head('Home', 'Your car, live. Everything on this screen is simulated, and the speed moves on its own.') +
      '<div class="grid-home"><section class="panel lane-d"><h2>' + D.oem.car + '</h2><p class="sub">Sharing ' + n + ' of ' + D.signals.length + ' data signals</p><div class="speed"><span data-bind="speed">0</span><small>km/h</small></div><div class="gauges">' +
      '<div class="gauge"><span class="gl">Battery</span><b data-bind="soc"></b><div class="bar"><i data-w="soc"></i></div></div><div class="gauge"><span class="gl">Motor temperature</span><b data-bind="temp"></b></div><div class="gauge"><span class="gl">Tyre pressure</span><b data-bind="tyre"></b></div><div class="gauge"><span class="gl">Odometer</span><b data-bind="odo"></b></div><div class="gauge"><span class="gl">Hard brakes this trip</span><b data-bind="brakes"></b></div></div></section>' +
      '<section class="panel lane-d"><h2>Live position</h2>' + mapSVG(false) + '<p class="note">Developers only ever see this as a 1 km grid square, and only if you share location.</p></section>' +
      '<section class="panel lane-d"><h2>Your wallet</h2><div class="walletnum" data-bind="wallet"></div><div class="stat"><span>Earned from your data in this demo</span><b data-bind="earned"></b></div><div class="stat"><span>Spent on apps</span><b data-bind="spent"></b></div><div class="stat"><span>Estimated earnings with your current switches</span><b data-bind="est"></b></div><div class="row"><button class="btn primary" data-act="ff">Fast-forward one month</button><button class="btn" data-act="withdraw">Withdraw to UPI</button></div><p class="note">Demo clock: every 2.5 seconds is one hour of driving.</p></section>' +
      '<section class="panel lane-d"><h2>What you are sharing</h2>' + D.signals.map(s => '<div class="stat"><span>' + s.name + '</span><span class="chip ' + (S.consent[s.id] ? 'on' : 'off') + '">' + (S.consent[s.id] ? 'Sharing' : 'Off') + '</span></div>').join('') + '<div class="row"><button class="btn" data-act="nav" data-arg="driver:consent">Change what you share</button></div></section></div>';
  };

  VIEWS['driver:consent'] = () => head('Data and consent', 'You decide what leaves your car. Each switch changes what developers can read, and it takes effect immediately.') +
    '<section class="panel lane-d"><div class="row between" style="margin-top:0"><div><span class="kl">Estimated earnings with your current switches</span><div class="big" data-bind="est"></div></div><div class="row" style="margin:0"><button class="btn" data-act="consentAll">Share everything</button><button class="btn danger" data-act="consentNone">Stop all sharing</button></div></div>' +
    D.signals.map(s => { const users = S.apps.filter(a => a.status === 'live' && a.signals.includes(s.id)); return '<div class="consent"><div><h3>' + s.name + '</h3><p class="note" style="margin-bottom:4px">' + s.desc + '</p><div>Used by ' + users.map(a => '<span class="chip">' + esc(a.name) + (a.aud === 'business' ? ' (business)' : '') + '</span>').join('') + '</div></div><div class="ctl"><div class="earn">' + inr(estOf(s)) + '<div class="note" style="font:400 14px Barlow">a month</div></div><button class="sw" role="switch" aria-checked="' + !!S.consent[s.id] + '" aria-label="Share ' + s.name + '" data-act="consent" data-arg="' + s.id + '"></button></div></div>'; }).join('') + '</section>' +
    '<section class="panel lane-d"><h2>What developers never receive</h2><p>Your VIN, name, phone number, home address, exact position, and the exact time of any reading. See the field-by-field list in the developer sandbox.</p></section>';

  VIEWS['driver:store'] = () => head('App store', 'Apps built on OEM vehicle data, for individual customers. Each card shows what the app reads and whether you have already allowed it.') +
    '<div class="apps">' + S.apps.filter(a => a.status === 'live' && a.aud === 'customer').map(a => '<article class="appcard"><h2>' + esc(a.name) + '</h2><div class="dev">by ' + esc(a.dev) + '</div><p style="margin-top:10px">' + esc(a.desc) + '</p><div>Reads: ' + sigChips(a.signals, true) + '</div><div class="tag">Addresses: ' + esc(a.tag) + '</div><div class="foot"><div class="price">' + inr(a.price) + '<small> a month</small></div>' + (S.installed[a.id] ? '<button class="btn" data-act="openApp" data-arg="' + a.id + '">Open</button>' : '<button class="btn primary" data-act="subscribe" data-arg="' + a.id + '">Subscribe</button>') + '</div></article>').join('') + '</div>';

  VIEWS['driver:apps'] = () => {
    const ids = Object.keys(S.installed);
    if (!ids.length) return head('My apps', 'Apps you subscribe to open here.') + '<section class="panel lane-d"><h2>No apps yet</h2><p>Subscribe to an app in the store and it opens here with your live vehicle data.</p><button class="btn primary" data-act="nav" data-arg="driver:store">Browse the store</button></section>';
    if (!S.openApp || !S.installed[S.openApp]) S.openApp = ids[0];
    const a = app(S.openApp), missing = a.signals.filter(s => !S.consent[s]);
    const gate = missing.length ? '<div class="locked"><h2>' + esc(a.name) + ' needs your permission</h2><p>It reads ' + missing.map(m => sig(m).name.toLowerCase()).join(' and ') + '. Turn ' + (missing.length > 1 ? 'them' : 'it') + ' on to start. You earn from ' + (missing.length > 1 ? 'them' : 'it') + ' too.</p><button class="btn primary" data-act="grant" data-arg="' + a.id + '">Turn on ' + missing.length + ' signal' + (missing.length > 1 ? 's' : '') + '</button></div>' : (APPUI[a.id] ? APPUI[a.id]() : '');
    return head('My apps', 'Each app only receives the signals you have switched on.') + '<div class="tabsbar">' + ids.map(i => '<button class="pill" aria-pressed="' + (i === S.openApp) + '" data-act="openApp" data-arg="' + i + '">' + esc(app(i).name) + '</button>').join('') + '</div><section class="panel lane-v"><h2>' + esc(a.name) + '</h2><p class="sub">by ' + esc(a.dev) + '</p>' + gate + '</section>';
  };

  const APPUI = {
    ecocoach: () => '<div class="grid2"><div><span class="kl">Eco score this trip</span><div class="big" data-bind="score"></div><div class="bar"><i data-w="score"></i></div></div><div><span class="kl">Estimated range</span><div class="big" data-bind="range"></div><p class="note">Hard brakes this trip: <b data-bind="brakes"></b></p></div></div><h3>Coaching</h3><ul><li>Lift off earlier before junctions. Each hard brake costs about 0.4 km of range.</li><li>Your speed is smoothest between 40 and 60 km/h. Hold it there on open roads.</li></ul>',
    safelap: () => '<div class="grid2"><div><span class="kl">Your driving discount today</span><div class="big" data-bind="discount"></div></div><div><span class="kl">Your premium</span><div class="big" data-bind="premium"></div><p class="note">Normal premium is ₹1,850 a month.</p></div></div><p class="note">Safe Lap sees braking and speed bands plus a 1 km grid square. It never sees where you live.</p>',
    pitcrew: () => '<div class="alert"><b>Coolant pump likely to fail in about 18 days</b><br>Confidence 82%. Wear has been rising for the last 6 weeks across 41 similar vehicles.<div class="row"><button class="btn primary" data-act="openBooking">Book the repair</button></div></div>' +
      [['Battery health', 94, ''], ['Brake pads', 71, ''], ['Coolant pump', 58, 'bad']].map(h => '<div class="health"><span>' + h[0] + '</span><div class="bar ' + h[2] + '"><i style="width:' + h[1] + '%"></i></div><b>' + h[1] + '%</b></div>').join('') + '<div class="health"><span>Tyre pressure</span><div></div><b data-bind="tyre"></b></div><div data-live="jobcard"></div>',
    ownerpulse: () => '<div class="grid2"><div><span class="kl">Estimated trade-in value today</span><div class="big" data-bind="tradein"></div><p class="note">Based on <span data-bind="odo"></span> and your service health.</p></div><div><span class="kl">Ownership health</span><div class="big">88 / 100</div></div></div><h3>Offers for you</h3><div class="stat"><span>Loyalty bonus of ₹1,20,000 on the OEM Volt 2, valid 30 days</span><button class="btn sm" data-act="saveOffer">Save offer</button></div><div class="stat"><span>Free battery health check at your next service</span><button class="btn sm" data-act="saveOffer">Save offer</button></div>',
    hazard: () => mapSVG(true) + '<div class="alert" style="margin-top:12px"><b data-bind="hazard"></b></div><p class="note">Red dots are places where many cars braked hard. Hazard Radar builds them from other customers\' anonymous braking events.</p>'
  };

  VIEWS['driver:wallet'] = () => head('Wallet and activity', 'What you earned, who read your data, and your privacy controls.') +
    '<div class="grid2"><section class="panel lane-d"><h2>Wallet</h2><div class="walletnum" data-bind="wallet"></div><div class="stat"><span>Earned in this demo</span><b data-bind="earned"></b></div><div class="stat"><span>Spent on apps</span><b data-bind="spent"></b></div><div class="row"><button class="btn primary" data-act="ff">Fast-forward one month</button><button class="btn" data-act="withdraw">Withdraw to UPI</button></div></section>' +
    '<section class="panel lane-d"><h2>Estimated earnings by signal</h2>' + D.signals.map(s => '<div class="stat"><span>' + s.name + '</span><b>' + (S.consent[s.id] && signalUsed(s.id) ? inr(estOf(s)) + ' a month' : 'Off') + '</b></div>').join('') + '</section></div>' +
    '<section class="panel lane-d"><h2>Who read your data</h2><div data-live="accessLog"></div></section>' +
    '<section class="panel lane-d"><h2>Your consent history</h2><div data-live="audit"></div><div class="row"><button class="btn" data-act="dl">Download my data</button><button class="btn danger" data-act="del">Delete my data</button></div></section>';

  VIEWS['developer:catalog'] = () => head('Data catalog', 'Data products from consenting OEM customers. You never receive a VIN, an exact position or an owner\'s identity.') +
    '<section class="panel lane-v"><div class="scroll"><table class="tbl"><thead><tr><th>Data product</th><th>What you receive</th><th class="num">Consenting vehicles</th><th class="num">Price per 1,000 records</th><th>Access</th></tr></thead><tbody>' +
    D.products.map(p => '<tr><td><b>' + esc(p.name) + '</b>' + (p.tag ? '<br><span class="chip warn">' + p.tag + '</span>' : '') + '</td><td>' + esc(p.treat) + '</td><td class="num">' + pool(p.id).toLocaleString('en-IN') + '</td><td class="num">' + inr(p.rate) + '</td><td>' + (S.access[p.id] ? '<span class="chip on">Approved</span>' : '<button class="btn sm" data-act="reqAccess" data-arg="' + p.id + '">Request access</button>') + '</td></tr>').join('') + '</tbody></table></div><p class="note" style="margin-top:12px">The OEM keeps ' + S.cut + '% of every fee. The rest goes to the customers who shared the data.</p></section>';

  VIEWS['developer:sandbox'] = () => {
    const rows = [['VIN', 'MM1VT4KP9N2038417', 'pid_a91f3c07e2', 'Rotating pseudonym that changes every 30 days'], ['Position', '18.52043, 73.85674', 'cell 18.52, 73.86', 'Rounded to a 1 km grid square'], ['Time', '10:42:17', '10:30 to 10:45', 'Rounded to 15 minutes'], ['Speed', '63.4 km/h', '60 to 80 km/h', 'Placed in a band'], ['Owner', 'Name, phone, address', 'Not included', 'Never leaves the OEM']];
    return head('API sandbox', 'Try the same calls your app will make. Access and consent are checked on every request.') +
      '<div class="grid2"><section class="panel lane-v"><h2>1. API key</h2><p>' + (S.apiKey ? 'Your sandbox key is ready.' : 'Generate a key to call the API.') + '</p>' + (S.apiKey ? '<pre class="code">' + S.apiKey + '</pre>' : '') + '<button class="btn primary" data-act="genKey">' + (S.apiKey ? 'Generate a new key' : 'Generate a key') + '</button></section>' +
      '<section class="panel lane-v"><h2>2. Make a call</h2><label class="f" for="apiProd">Data product</label><select id="apiProd" data-chg="apiProduct">' + D.products.map(p => '<option value="' + p.id + '"' + (p.id === S.apiProduct ? ' selected' : '') + '>' + esc(p.name) + (S.access[p.id] ? '' : ' (no access yet)') + '</option>').join('') + '</select><pre class="code">GET /v1/data/' + S.apiProduct + '?window=1h\nAuthorization: Bearer ' + (S.apiKey ? S.apiKey.slice(0, 14) + '...' : '(no key yet)') + '</pre><div class="row"><button class="btn primary" data-act="runApi">Send request</button></div></section></div>' +
      '<section class="panel lane-v"><h2>Response</h2><pre class="code" id="apiOut">' + esc(S.apiOut || 'Press "Send request" to see a response.') + '</pre></section>' +
      '<section class="panel lane-v"><h2>What changes before data reaches you</h2><div class="scroll"><table class="tbl"><thead><tr><th>Field</th><th>Inside the OEM</th><th>What you receive</th><th>How</th></tr></thead><tbody>' + rows.map(r => '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>').join('') + '</tbody></table></div></section>';
  };

  VIEWS['developer:publish'] = () => head('Publish an app', 'Submit your app for OEM review. Choose who it is for, and ask only for the signals the app really needs.') +
    '<section class="panel lane-v"><label class="f" for="pf-name">App name</label><input type="text" id="pf-name" value="TyreWise"><label class="f" for="pf-desc">One-line description</label><input type="text" id="pf-desc" value="Warns you when tyre pressure drifts and shows what low pressure costs you."><fieldset><legend>Who is it for?</legend><label class="check"><input type="radio" name="aud" value="customer" data-chg="audience" checked><span>Individual customers, priced from ₹99 to ₹1,499 a month</span></label><label class="check"><input type="radio" name="aud" value="business" data-chg="audience"><span>Businesses such as insurers, fleets, suppliers and dealerships, priced from ₹4,999 to ₹99,999 a month</span></label></fieldset><label class="f" for="pf-price">Price a month (₹)</label><input type="number" id="pf-price" value="199" min="1"><fieldset><legend>Data signals the app reads</legend>' +
    D.signals.map(s => '<label class="check"><input type="checkbox" class="pf-sig" value="' + s.id + '"' + (s.id === 'diagnostics' ? ' checked' : '') + '><span>' + s.name + ' <span class="note">(' + inr(s.rate) + ' per 1,000 records)</span></span></label>').join('') + '</fieldset><div class="row"><button class="btn primary" data-act="publish">Submit for review</button></div></section>';

  VIEWS['developer:myapps'] = () => head('My apps and revenue', 'Revenue is shown after the OEM\'s cut, so you see what you actually receive.') + '<section class="panel lane-v"><div data-live="devApps"></div><p class="note" style="margin-top:12px">The OEM\'s current cut is <b data-bind="cut"></b> of every payment. On business licences, a further ' + Math.round(D.bizPoolPct * 100) + '% goes to the customers whose data the app runs on.</p></section>';

  VIEWS['oem:dashboard'] = () => head('Dashboard', 'Revenue across the marketplace this year. The last bar is live.') + kpiStrip() +
    '<div class="grid2"><section class="panel lane-o"><h2>Money moved each month</h2><div data-live="chart"></div><div class="row"><span><span class="dot d"></span> Customers</span><span><span class="dot v"></span> Developers</span><span><span class="dot o"></span> OEM</span></div></section>' +
    '<section class="panel lane-o"><h2>The OEM\'s cut</h2><div class="big" data-bind="cut"></div><input type="range" min="10" max="35" value="' + S.cut + '" data-inp="cut" aria-label="OEM share of each payment"><p class="note">Applies to every new payment: app subscriptions, business licences and data fees. Drag it and watch the numbers move.</p><div data-live="cutExample"></div></section></div>' +
    '<section class="panel lane-o"><h2>Top apps</h2><div data-live="topApps"></div></section>';

  const checks = a => {
    const c = [], biz = a.aud === 'business', lo = biz ? 4999 : 99, hi = biz ? 99999 : 1499, kind = biz ? 'business licences' : 'customer apps';
    c.push(a.signals.length <= 3 ? ['ok', 'Asks for ' + a.signals.length + ' signal' + (a.signals.length > 1 ? 's' : '') + ', which is within the 3 signal guideline'] : ['warn', 'Asks for ' + a.signals.length + ' signals. Ask the developer to justify each one.']);
    c.push(['ok', 'Receives anonymised data only, never VIN or exact position']);
    c.push(a.price >= lo && a.price <= hi ? ['ok', 'Price is inside the ' + inr(lo) + ' to ' + inr(hi) + ' range for ' + kind] : ['fail', 'Price ' + inr(a.price) + ' is outside the ' + inr(lo) + ' to ' + inr(hi) + ' range for ' + kind]);
    if (a.signals.includes('location')) c.push(['ok', 'Location arrives as 1 km grid squares']);
    if (biz) c.push(['ok', 'Business buyers only see aggregated results, never single vehicles']);
    return c;
  };
  VIEWS['oem:approvals'] = () => {
    const pend = S.apps.filter(a => a.status === 'pending');
    return head('App approvals', 'Every app is checked against the privacy policy before it reaches customers or businesses.') +
      (pend.length ? pend.map(a => { const c = checks(a), bad = c.some(x => x[0] === 'fail'); return '<section class="panel lane-o"><h2>' + esc(a.name) + '</h2><p class="sub">by ' + esc(a.dev) + ' for ' + (a.aud === 'business' ? 'businesses' : 'individual customers') + ' at ' + inr(a.price) + ' a month</p><p>' + esc(a.desc) + '</p><div>Reads: ' + sigChips(a.signals, false) + '</div><h3>Policy checks</h3>' + c.map(x => '<div class="okline ' + (x[0] === 'ok' ? '' : x[0]) + '">' + x[1] + '</div>').join('') + '<div class="row"><button class="btn primary" data-act="approve" data-arg="' + a.id + '"' + (bad ? ' disabled' : '') + '>Approve</button><button class="btn danger" data-act="reject" data-arg="' + a.id + '">Reject</button></div></section>'; }).join('') : '<section class="panel lane-o"><h2>Nothing waiting</h2><p>New submissions from the developer portal show up here.</p></section>') +
      '<section class="panel lane-o"><h2>Catalog</h2><div class="scroll"><table class="tbl"><thead><tr><th>App</th><th>For</th><th>Developer</th><th>Status</th></tr></thead><tbody>' + S.apps.filter(a => a.status !== 'pending').map(a => '<tr><td>' + esc(a.name) + '</td><td>' + (a.aud === 'business' ? 'Businesses' : 'Customers') + '</td><td>' + esc(a.dev) + '</td><td>' + statusChip(a.status) + '</td></tr>').join('') + '</tbody></table></div></section>';
  };

  VIEWS['oem:privacy'] = () => head('Privacy and audit', 'Proof that consent is respected. Customers see the same history in their app.') +
    '<div class="grid2"><section class="panel lane-o"><h2>Share of enrolled vehicles sharing each signal</h2>' + D.signals.map(s => { const r = (D.fleet * s.share + (S.consent[s.id] ? 1 : 0)) / D.enrolled * 100; return '<div class="rate"><span>' + s.name + '</span><div class="bar"><i style="width:' + r.toFixed(1) + '%"></i></div><b>' + r.toFixed(0) + '%</b></div>'; }).join('') + '<div class="stat"><span>Consents revoked so far</span><b data-bind="revoked"></b></div></section>' +
    '<section class="panel lane-o"><h2>Rules enforced on every API call</h2>' + ['Consent is checked per record, not per month', 'VIN and exact position never leave the OEM', 'Location is rounded to a 1 km grid square', 'Aggregated products need 50 or more vehicles per group', 'A revoked signal stops flowing immediately', 'Every read is written to an audit log the customer can see'].map(t => '<div class="okline">' + t + '</div>').join('') + '</section></div>' +
    '<section class="panel lane-o"><h2>Latest consent events</h2><div data-live="audit"></div></section>';

  VIEWS['oem:ledger'] = () => head('Ledger', 'Every payment, and how it was split. Rows marked "you" come from the customer app.') + '<section class="panel lane-o"><div data-live="ledgerTable"></div></section>';

  /* ---------- Business portal ---------- */
  const tk = () => S.tick;
  const BIZUI = {
    insurerpro: () => [['Policies priced this month', (41200 + tk() * 9).toLocaleString('en-IN')], ['Average premium change', '-' + (6.2 + (tk() % 7) / 10).toFixed(1) + '%'], ['Risky policies flagged early', (118 + tk()).toLocaleString('en-IN')]],
    fleetservice: () => [['Vehicles monitored', '240'], ['Failures predicted this week', String(3 + Math.floor(tk() / 12))], ['Breakdowns avoided this month', String(5 + Math.floor(tk() / 9))]],
    partpulse: () => [['Coolant pump fault rate', (7.4 + (tk() % 9) / 10).toFixed(1) + ' per 10,000'], ['Regions with rising faults', '2 of 5'], ['Parts watched', '186']],
    dealerloyalty: () => [['Customers ready to switch', String(212 + tk())], ['Offers accepted this month', String(37 + Math.floor(tk() / 6))], ['Average trade-in uplift', '₹' + (42000 + (tk() % 11) * 300).toLocaleString('en-IN')]],
    fleetfuel: () => [['Fuel and energy saved', (8.1 + (tk() % 6) / 10).toFixed(1) + '%'], ['Vehicles in the plan', '240'], ['Savings this month', inr(182000 + tk() * 450)]]
  };
  VIEWS['business:catalog'] = () => head('Business apps', 'Apps built by developers on anonymised OEM vehicle data, licensed to businesses. Pay monthly, or pay for 10 months and get 12.') +
    '<div class="apps">' + S.apps.filter(a => a.status === 'live' && a.aud === 'business').map(a => '<article class="appcard biz"><h2>' + esc(a.name) + '</h2><div class="dev">by ' + esc(a.dev) + '</div><p style="margin-top:10px">' + esc(a.desc) + '</p><div>Best for: <span class="chip warn">' + esc(a.for) + '</span></div><div>Built on: ' + a.signals.map(id => '<span class="chip">' + sig(id).name + '</span>').join('') + '</div><div class="tag">Addresses: ' + esc(a.tag) + '</div><div class="foot"><div class="price">' + inr(a.price) + '<small> a month</small></div>' + (S.licences[a.id] ? '<button class="btn" data-act="openLicence" data-arg="' + a.id + '">Open</button>' : '<button class="btn primary" data-act="buyBiz" data-arg="' + a.id + '">Buy licence</button>') + '</div></article>').join('') + '</div>' +
    '<section class="panel lane-b"><h2>Why this is safe to buy</h2><p>You never receive raw vehicle data, and you never see a single car or owner. Every app here runs on anonymised data from customers who chose to share it, and every licence payment also pays those customers.</p></section>';

  VIEWS['business:licences'] = () => {
    const ids = Object.keys(S.licences);
    if (!ids.length) return head('My licences and invoices', 'Apps your business has licensed open here.') + '<section class="panel lane-b"><h2>No licences yet</h2><p>License an app and its dashboard opens here, built on anonymised vehicle data.</p><button class="btn primary" data-act="nav" data-arg="business:catalog">Browse business apps</button></section>';
    if (!S.openBiz || !S.licences[S.openBiz]) S.openBiz = ids[0];
    const a = app(S.openBiz), l = S.licences[a.id];
    return head('My licences and invoices', 'Dashboards for the apps ' + BIZ + ' has licensed, plus every invoice.') + '<div class="tabsbar">' + ids.map(i => '<button class="pill" aria-pressed="' + (i === S.openBiz) + '" data-act="openLicence" data-arg="' + i + '">' + esc(app(i).name) + '</button>').join('') + '</div>' +
      '<section class="panel lane-b"><h2>' + esc(a.name) + '</h2><p class="sub">by ' + esc(a.dev) + '. Licence active, billed ' + l.plan + ' at ' + inr(a.price) + ' a month.</p><div data-live="bizApp"></div><p class="note" style="margin-top:12px">Built on anonymised data from customers who chose to share it. You never see a single vehicle or owner.</p></section>' +
      '<section class="panel lane-b"><h2>Invoices</h2><div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>App</th><th>Billing</th><th class="num">Amount</th></tr></thead><tbody>' + S.invoices.map(i => '<tr><td>' + new Date(i.ts).toLocaleDateString('en-IN') + '</td><td>' + esc(i.app) + '</td><td>' + i.plan + '</td><td class="num">' + inr2(i.gross) + '</td></tr>').join('') + '</tbody></table></div></section>';
  };
  function openBuyBiz(id) {
    const a = app(id), c = S.cut / 100, p = D.bizPoolPct, pct = x => Math.round(x * 100) + '%';
    openModal('<h2>License ' + esc(a.name) + '</h2><p>' + inr(a.price) + ' a month from ' + esc(a.dev) + ', for ' + BIZ + '.</p><fieldset><legend>Billing</legend><label class="check"><input type="radio" name="plan" value="monthly" checked><span>Monthly: ' + inr(a.price) + ' a month</span></label><label class="check"><input type="radio" name="plan" value="annual"><span>Annual: ' + inr(a.price * 10) + ' a year (two months free)</span></label></fieldset><h3>Where each payment goes</h3><div class="splitbar"><i class="seg v" style="width:' + ((1 - c - p) * 100) + '%"></i><i class="seg d" style="width:' + (p * 100) + '%"></i><i class="seg o" style="width:' + (c * 100) + '%"></i></div><ul class="legend"><li><span class="dot v"></span>Developer<b>' + inr2(a.price * (1 - c - p)) + '</b><em>' + pct(1 - c - p) + '</em></li><li><span class="dot d"></span>Customers who shared data<b>' + inr2(a.price * p) + '</b><em>' + pct(p) + '</em></li><li><span class="dot o"></span>OEM<b>' + inr2(a.price * c) + '</b><em>' + pct(c) + '</em></li></ul><p class="note">Shown for one month. The same split applies to annual billing.</p><div class="row end"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="payBiz" data-arg="' + id + '">Pay by invoice</button></div>');
  }
  function buyBiz(id) {
    const a = app(id), r = $('input[name=plan]:checked'), plan = r ? r.value : 'monthly', gross = plan === 'annual' ? a.price * 10 : a.price;
    S.licences[id] = { plan, since: Date.now() };
    a.installs++; a.rev += gross;
    const e = book(entry('biz', BIZ + ' licensed ' + a.name + ' (' + plan + ')', gross, { appId: id, own: true }));
    S.invoices.unshift({ ts: Date.now(), app: a.name, plan, gross });
    S.last = e; S.openBiz = id; closeModal();
    toast('Licence active. ' + a.dev + ' receives ' + inr2(e.dev) + ', the OEM ' + inr2(e.oem) + ' and customers ' + inr2(e.driver) + '.');
    go('business', 'licences');
  }

  /* ---------- Render ---------- */
  function render() {
    renderChrome();
    const key = NAV[S.persona] ? S.persona + ':' + S.view[S.persona] : S.persona;
    $('#main').innerHTML = VIEWS[key]();
    refreshLive();
  }

  /* ---------- Actions ---------- */
  function openBuy(id) {
    const a = app(id), missing = a.signals.filter(s => !S.consent[s]), c = S.cut / 100, canWallet = S.wallet >= a.price;
    openModal('<h2>Subscribe to ' + esc(a.name) + '</h2><p>' + inr(a.price) + ' a month from ' + esc(a.dev) + '.</p><h3>Where your ' + inr(a.price) + ' goes</h3><div class="splitbar"><i class="seg v" style="width:' + ((1 - c) * 100) + '%"></i><i class="seg o" style="width:' + (c * 100) + '%"></i></div><ul class="legend"><li><span class="dot v"></span>Developer<b>' + inr2(a.price * (1 - c)) + '</b><em>' + Math.round((1 - c) * 100) + '%</em></li><li><span class="dot o"></span>OEM<b>' + inr2(a.price * c) + '</b><em>' + Math.round(c * 100) + '%</em></li></ul><h3>Data this app reads</h3><div>' + sigChips(a.signals, true) + '</div>' +
      (missing.length ? '<label class="check"><input type="checkbox" id="grant" checked><span>Also turn on ' + missing.map(m => sig(m).name.toLowerCase()).join(' and ') + '. You earn from sharing them.</span></label>' : '') +
      '<div class="row end"><button class="btn" data-act="closeModal">Cancel</button><button class="btn" data-act="pay" data-arg="' + id + '|wallet"' + (canWallet ? '' : ' disabled') + '>Pay from wallet (' + inr2(S.wallet) + ')</button><button class="btn primary" data-act="pay" data-arg="' + id + '|upi">Pay with UPI</button></div>');
  }
  function buy(id, method) {
    const a = app(id);
    if (method === 'wallet' && S.wallet < a.price) { toast('Your wallet balance is too low. Pay with UPI instead.'); return; }
    const g = $('#grant'); if (g && g.checked) a.signals.forEach(s => setConsent(s, true));
    if (method === 'wallet') S.wallet -= a.price;
    S.spent += a.price; S.installed[id] = true; a.installs++; a.rev += a.price;
    const e = book(entry('app', 'You subscribed to ' + a.name, a.price, { mine: true, appId: id }));
    S.last = e; S.openApp = id; closeModal();
    toast('Subscribed. ' + a.dev + ' receives ' + inr2(e.dev) + ' and the OEM receives ' + inr2(e.oem) + '.');
    go('driver', 'apps');
  }
  function openBooking() {
    openModal('<h2>Book the coolant pump repair</h2><p>PitCrew Predict has already sent the fault details and part number, so the workshop can have the part ready.</p><fieldset><legend>Service centre</legend>' + D.dealers.map((d, i) => '<label class="check"><input type="radio" name="dealer" value="' + i + '"' + (i === 0 ? ' checked' : '') + '><span>' + d + '</span></label>').join('') + '</fieldset><fieldset><legend>Time</legend>' + D.slots.map((d, i) => '<label class="check"><input type="radio" name="slot" value="' + i + '"' + (i === 0 ? ' checked' : '') + '><span>' + d + '</span></label>').join('') + '</fieldset><div class="row end"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="confirmBooking">Confirm booking</button></div>');
  }
  function confirmBooking() {
    const d = $('input[name=dealer]:checked'), s = $('input[name=slot]:checked');
    const b = { dealer: d ? +d.value : 0, slot: s ? +s.value : 0, step: 0 };
    S.booking = b; closeModal(); toast('Booked. One job card now exists for the OEM, the dealer and the workshop.');
    [1, 2, 3].forEach(n => setTimeout(() => { if (S.booking === b) { b.step = n; refreshLive(); } }, n * 1800));
    if (S.persona !== 'driver' || S.view.driver !== 'apps') { S.openApp = 'pitcrew'; go('driver', 'apps'); } else render();
  }
  function publishApp(o) {
    if (S.apps.some(a => a.name.toLowerCase() === o.name.toLowerCase())) { toast(o.name + ' is already submitted.'); return false; }
    S.apps.push({ id: 'u' + (S.apps.length + 1), name: o.name, dev: DEV, aud: o.aud || 'customer', for: 'Businesses', tag: 'The Telemetry Play', price: o.price, signals: o.signals, desc: o.desc, status: 'pending', installs: 0, fees: 0, rev: 0 });
    audit('App submitted for review: ' + o.name); return true;
  }
  function apiCall() {
    const p = prod(S.apiProduct);
    if (!S.apiKey) return { status: 401, body: { error: 'missing_api_key', hint: 'Generate a key first.' } };
    if (!S.access[p.id]) return { status: 403, body: { error: 'no_access', hint: 'Request access to "' + p.name + '" in the data catalog.' } };
    const recs = [];
    for (let i = 0; i < 3; i++) {
      recs.push(p.id === 'failfeed' ? { part: pick(['Coolant pump CP-7731', 'Brake sensor BS-2210', 'Inverter fan IF-9004']), region: pick(['West', 'South', 'North']), faults_per_10k_vehicles: +rnd(2, 19).toFixed(1) } : { pid: 'pid_' + hex(10), cell: (18.5 + rint(0, 9) / 100).toFixed(2) + ',' + (73.8 + rint(0, 9) / 100).toFixed(2), window: '10:' + pick(['00', '15', '30', '45']), value_band: pick(['low', 'medium', 'high']) });
    }
    return { status: 200, body: { product: p.id, consenting_vehicles: pool(p.id), k_anonymity: 50, records: recs } };
  }

  const ACT = {
    nav(arg) { const [p, v] = arg.split(':'); go(p, v || null); },
    buyBiz(id) { if (S.licences[id]) { ACT.openLicence(id); return; } openBuyBiz(id); },
    payBiz(id) { buyBiz(id); },
    openLicence(id) { S.openBiz = id; go('business', 'licences'); },
    simulate() { simulate(); toast('A payment was split. Watch the three lanes.'); },
    consent(id) { setConsent(id, !S.consent[id]); render(); },
    consentAll() { D.signals.forEach(s => setConsent(s.id, true)); render(); },
    consentNone() { D.signals.forEach(s => setConsent(s.id, false)); render(); toast('All sharing is off. Developers can no longer read your data.'); },
    ff() { fastForward(); },
    withdraw() { toast('Demo only: in production this sends ' + inr2(S.wallet) + ' to your UPI ID.'); },
    dl() { toast('Demo only: this would export every record shared from your car.'); },
    del() { toast('Demo only: this would erase your history and stop all sharing.'); },
    subscribe(id) { openBuy(id); },
    pay(arg) { const [id, m] = arg.split('|'); buy(id, m); },
    closeModal() { closeModal(); },
    openApp(id) { S.openApp = id; if (S.persona !== 'driver' || S.view.driver !== 'apps') go('driver', 'apps'); else render(); },
    grant(id) { app(id).signals.forEach(s => setConsent(s, true)); toast('Signals turned on.'); render(); },
    openBooking() { openBooking(); },
    confirmBooking() { confirmBooking(); },
    saveOffer() { toast('Offer saved to your wallet.'); },
    reqAccess(id) { S.access[id] = true; toast('Access approved. Consent is still checked on every call.'); render(); },
    genKey() { S.apiKey = 'sk_test_' + hex(24); render(); },
    runApi() { const r = apiCall(); S.apiOut = 'HTTP ' + r.status + '\n' + JSON.stringify(r.body, null, 2); render(); },
    publish() {
      const name = $('#pf-name').value.trim(), sigs = $$('.pf-sig:checked').map(c => c.value), au = $('input[name=aud]:checked');
      if (!name) { toast('Give the app a name first.'); return; }
      if (!sigs.length) { toast('Choose at least one data signal.'); return; }
      if (publishApp({ name, desc: $('#pf-desc').value.trim() || 'No description', price: Math.max(1, +$('#pf-price').value || 199), signals: sigs, aud: au ? au.value : 'customer' })) { toast(name + ' was submitted. The OEM will review it.'); go('developer', 'myapps'); }
    },
    approve(id) { const a = app(id); a.status = 'live'; audit('App approved: ' + a.name); toast(a.name + ' is live in the app store.'); render(); },
    reject(id) { const a = app(id); a.status = 'rejected'; toast(a.name + ' was rejected.'); render(); },
    pause() { S.running = !S.running; renderChrome(); },
    resetDemo() { S = fresh(); V = freshV(); S.last = entry('app', 'Example: one EcoCoach subscription', 299); tourI = -1; renderTour(); closeModal(); render(); toast('Demo reset.'); },
    tour() { tourShow(0); }, tourNext() { if (tourI >= TOUR.length - 1) { tourI = -1; renderTour(); } else tourShow(tourI + 1); },
    tourBack() { if (tourI > 0) tourShow(tourI - 1); }, tourExit() { tourI = -1; renderTour(); },
    tourDo() { const a = TOUR[tourI].action; if (a) a.fn(); }
  };
  const INP = { cut(v) { S.cut = +v; refreshLive(); } };
  const CHG = { apiProduct(v) { S.apiProduct = v; render(); }, audience(v) { const el = $('#pf-price'); if (el) el.value = v === 'business' ? 14999 : 199; } };

  /* ---------- Guided demo ---------- */
  const TOUR = [
    { p: 'overview', title: 'The idea', text: 'Cars already stream data that nobody pays customers for. Slipstream lets customers sell access on their own terms, lets developers build apps on it, lets customers and businesses buy those apps, and gives the OEM a cut of every payment. Watch the split on the right.', action: { label: 'Simulate a payment', fn: () => simulate() } },
    { p: 'driver', v: 'consent', title: 'The customer decides', text: 'Every switch controls what developers can read. Turn everything on and watch the monthly estimate rise.', action: { label: 'Turn on all signals', fn: () => ACT.consentAll() } },
    { p: 'driver', v: 'wallet', title: 'The customer gets paid', text: 'Earnings arrive as apps read the data, and the access log shows exactly who did. This jumps ahead one month of driving.', action: { label: 'Fast-forward one month', fn: () => fastForward() } },
    { p: 'developer', v: 'catalog', title: 'The developer finds data', text: 'Developers browse data products, see how many vehicles consent and what each costs. Note the supplier feed for The Blind Corner.', action: { label: 'Request access to all products', fn: () => { D.products.forEach(p => S.access[p.id] = true); render(); } } },
    { p: 'developer', v: 'sandbox', title: 'Privacy you can inspect', text: 'The sandbox returns anonymised records only. The table below shows what is removed before data leaves the OEM.', action: { label: 'Generate a key and send a request', fn: () => { S.apiKey = S.apiKey || 'sk_test_' + hex(24); S.apiProduct = 'driving'; S.access.driving = true; const r = apiCall(); S.apiOut = 'HTTP ' + r.status + '\n' + JSON.stringify(r.body, null, 2); render(); } } },
    { p: 'developer', v: 'publish', title: 'The developer ships an app', text: 'Submit an app for OEM review and choose who it is for: individual customers or businesses. TyreWise is prefilled so you can send it in one click.', action: { label: 'Submit TyreWise for review', fn: () => { if (publishApp({ name: 'TyreWise', desc: 'Warns you when tyre pressure drifts and shows what low pressure costs you.', price: 199, signals: ['diagnostics'], aud: 'customer' })) toast('TyreWise was submitted. The OEM will review it.'); } } },
    { p: 'oem', v: 'approvals', title: 'The OEM reviews', text: 'Each submission is checked against the privacy policy. FleetFuel Saver asks for four signals, so it gets a warning. Approve to publish.', action: { label: 'Approve everything waiting', fn: () => { S.apps.filter(a => a.status === 'pending').forEach(a => { if (!checks(a).some(x => x[0] === 'fail')) a.status = 'live'; }); toast('Approved apps are now live.'); render(); } } },
    { p: 'driver', v: 'store', title: 'A customer subscribes', text: 'Each card shows what the app reads and whether the customer has already allowed it. Subscribing shows exactly where the money goes.', action: { label: 'Subscribe to PitCrew Predict', fn: () => openBuy('pitcrew') } },
    { p: 'driver', v: 'apps', title: 'The app uses the data', text: 'PitCrew Predict spots a failing coolant pump. Booking the repair creates one shared job card for the OEM, the dealer and the workshop.', action: { label: 'Book the repair', fn: () => { if (!S.installed.pitcrew) { toast('Subscribe to PitCrew Predict first.'); return; } S.openApp = 'pitcrew'; if (app('pitcrew').signals.some(s => !S.consent[s])) ACT.grant('pitcrew'); openBooking(); } } },
    { p: 'business', v: 'catalog', title: 'A business licenses an app', text: 'Outside businesses buy apps built on the same anonymised data. A licence costs far more than a customer app, and every payment splits three ways: developer, OEM, and the customers whose data the app runs on.', action: { label: 'License Part Pulse', fn: () => { if (S.licences.partpulse) { toast('Part Pulse is already licensed.'); return; } openBuyBiz('partpulse'); } } },
    { p: 'oem', v: 'dashboard', title: 'The OEM earns on every payment', text: 'Every subscription, licence and data fee carries the OEM\'s cut. Raise it and the split changes everywhere, including what customers and developers receive.', action: { label: 'Raise the cut to 25%', fn: () => { S.cut = 25; render(); } } }
  ];
  let tourI = -1;
  function tourShow(i) { tourI = i; const t = TOUR[i]; go(t.p, t.v || null); renderTour(); }
  function renderTour() {
    const el = $('#tour');
    if (tourI < 0) { el.hidden = true; return; }
    const t = TOUR[tourI]; el.hidden = false;
    el.innerHTML = '<p class="ts">Step ' + (tourI + 1) + ' of ' + TOUR.length + '</p><h3>' + t.title + '</h3><p>' + t.text + '</p>' + (t.action ? '<div class="row"><button class="btn primary" data-act="tourDo">' + t.action.label + '</button></div>' : '') + '<div class="row between"><button class="btn ghost" data-act="tourBack"' + (tourI === 0 ? ' disabled' : '') + '>Back</button><button class="btn ghost" data-act="tourExit">Exit</button><button class="btn ghost" data-act="tourNext">' + (tourI === TOUR.length - 1 ? 'Finish' : 'Next') + '</button></div>';
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', e => {
    if (e.target.id === 'modal') { closeModal(); return; }
    const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    const f = ACT[el.dataset.act]; if (f) f(el.dataset.arg, el, e);
  });
  document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el.value, el); });
  document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el.value, el); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* ---------- Start ---------- */
  S = fresh(); V = freshV();
  S.last = entry('app', 'Example: one EcoCoach subscription', 299);
  for (let i = 0; i < 6; i++) telemetryTick();
  render();
  setInterval(() => { telemetryTick(); refreshLive(); }, 600);
  setInterval(() => { if (S.running) { economyTick(); refreshLive(); } }, 2500);

  // Exposed for the automated smoke test only
  window.__slipstream = { go, ACT, get S() { return S; }, TOUR, tourShow, economyTick, apiCall, render };
})();
