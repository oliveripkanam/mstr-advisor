(async function () {
  const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : (typeof v === 'number' ? v.toFixed(2) : String(v)));
  const colorCls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'neutral');
  const debug = (typeof window !== 'undefined') && /(?:[?&])debug=1(?:&|$)/.test(window.location.search);

  const TERM_INFO = {
    btc_1d_beta: { title: 'BTC 1D × Beta', desc: 'Derived from BTC-USD daily returns multiplied by rolling beta of MSTR to BTC. Source: Yahoo Finance via yfinance (BTC-USD, MSTR); beta computed on 60-day rolling window.' },
    trend_short: { title: 'Short-term Trend', desc: 'Combines distance to 20/50DMA and 20DMA slope to capture near-term trend direction and strength. Source: MSTR daily closes from Yahoo Finance; moving averages computed locally.' },
    momentum: { title: 'Momentum', desc: 'RSI(14) deviation from neutral (50) blended with 10-day rate of change. Positive when momentum builds. Source: MSTR daily OHLC from Yahoo Finance.' },
    mean_reversion: { title: 'Mean Reversion', desc: 'Penalizes large deviations from 20DMA and uses Bollinger %B to detect extremes where price tends to snap back. Source: MSTR daily closes from Yahoo Finance.' },
    vix_risk: { title: 'VIX Risk', desc: 'A proxy for market fear; higher levels imply risk-off conditions. We invert/normalize VIX so higher VIX lowers score. Source: ^VIX from Yahoo Finance.' },
    usd_risk: { title: 'USD (DXY/UUP)', desc: 'A stronger USD can pressure risk assets. We use UUP (ETF tracking the Dollar Index) daily changes; rising USD subtracts from score. Source: UUP from Yahoo Finance.' },
    tech_beta: { title: 'Tech Beta (QQQ)', desc: 'Captures exposure to broader tech. Computed as QQQ daily return times rolling beta of MSTR to QQQ. Source: QQQ and MSTR from Yahoo Finance.' },
    atr_penalty: { title: 'ATR% Penalty', desc: 'Volatility tax: ATR(14) as a percent of price; elevated volatility reduces risk-adjusted attractiveness. Source: MSTR daily high/low/close from Yahoo Finance.' },
    news_short: { title: 'News Sentiment (24–48h)', desc: 'Headline sentiment summarizing last 1–2 days; positive coverage adds, negative subtracts. Source: RSS feeds (Google News, Coindesk) parsed and scored by backend.' },
    btc_1w_regime: { title: 'BTC 1W Regime', desc: 'Weekly return/regime context for BTC affects MSTR materially due to BTC exposure. Source: BTC-USD from Yahoo Finance; 5-day change normalized.' },
    trend_struct: { title: 'Trend Structure', desc: 'Medium-horizon structure using 20/50DMA relationship and slopes, indicating trend health beyond the very short term. Source: MSTR Yahoo Finance.' },
    macro_risk: { title: 'Macro Risk (VIX, USD)', desc: 'Composite of VIX level and USD strength; higher macro stress dampens risk appetite. Source: ^VIX and UUP from Yahoo Finance.' },
    momentum_week: { title: 'Weekly Momentum', desc: 'Four-week rate of change signaling persistent moves across weeks. Source: MSTR Yahoo Finance.' },
    wk52_structure: { title: '52-Week Structure', desc: 'Proximity to 52-week high; closeness can indicate strength, while far below may indicate weakness or value depending on context. Source: MSTR Yahoo Finance.' },
    news_week: { title: 'News (7d)', desc: 'Aggregate sentiment across the last week; sustained positive/negative coverage influences weekly stance. Source: backend RSS sentiment.' },
    market_beta_week: { title: 'Market Beta (QQQ 1W)', desc: 'Weekly beta-adjusted exposure to tech market moves via QQQ. Source: QQQ & MSTR from Yahoo Finance.' },
    btc_1m_regime: { title: 'BTC 1M Regime', desc: 'Monthly BTC return/regime; a key driver given MSTR’s BTC holdings. Source: BTC-USD from Yahoo Finance; 21-trading-day change normalized.' },
    trend_long: { title: 'Long Trend', desc: 'Longer-horizon structure via 50/200DMA slope/cross capturing secular trend direction. Source: MSTR Yahoo Finance.' },
    momentum_quarter: { title: 'Quarter Momentum', desc: 'Three-month rate of change for medium-term momentum. Source: MSTR Yahoo Finance.' },
    atr_penalty_month: { title: 'ATR% Penalty (1M)', desc: 'Monthly volatility regime using ATR% averaged over ~1 month; penalizes unstable periods. Source: MSTR Yahoo Finance.' },
    news_month: { title: 'News (30d)', desc: 'Monthly aggregate sentiment; prolonged positive or negative narratives affect medium-term stance. Source: backend RSS sentiment.' },
    market_beta_month: { title: 'Market Beta (QQQ 1M)', desc: 'Monthly beta-adjusted linkage to QQQ, reflecting market tide over a longer horizon. Source: QQQ & MSTR from Yahoo Finance.' }
  };

  async function fetchSnapshot() {
    const isPages = typeof window !== 'undefined' && /github\.io$/.test(window.location.hostname);
    const repo = 'mstr-advisor';
    const basePath = isPages ? `/${repo}` : '';
    const localList = [
      `${basePath}/data/public/model_snapshot.json`,
      'data/public/model_snapshot.json',
      '../data/public/model_snapshot.json'
    ];
    const pagesOnly = [
      `/${repo}/data/public/model_snapshot.json`,
      `/mstr-advisor/data/public/model_snapshot.json`
    ];
    const rawList = [
      'https://raw.githubusercontent.com/oliveripkanam/mstr-advisor/main/data/public/model_snapshot.json',
      'https://raw.githubusercontent.com/oliveripkanam/mstr-advisor/revamp/data/public/model_snapshot.json'
    ];
    const candidates = (isPages ? [...pagesOnly, ...rawList] : [...localList, ...rawList])
      .map(u => u + (u.includes('?') ? '' : `?t=${Date.now()}`));
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return res.json();
      } catch (_) { /* try next */ }
    }
    throw new Error('Failed to load model_snapshot.json');
  }

  function renderSummary(d) {
    const dt = new Date(d.asof);
    const hk = dt.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: true }).replace(',', '');
    document.getElementById('asof').innerHTML = `Last update: <strong>${hk} HKT</strong>`;
    const actionEl = document.getElementById('action');
    actionEl.textContent = d.blended.action;
    actionEl.className = 'badge ' + (d.blended.score > 10 ? 'pos' : d.blended.score < -10 ? 'neg' : 'neutral');
    document.getElementById('blended').textContent = fmt(d.blended.score);
    // Seed price from snapshot for initial render; live updater will overwrite
    document.getElementById('price').textContent = fmt(d.levels.price);
    document.getElementById('ma20').textContent = fmt(d.levels.ma20);
    document.getElementById('atr').textContent = fmt(d.levels.atr);
  }

  function renderPlan(d) {
    const p = d.plan || {};
    document.getElementById('entry_low').textContent = fmt(p.entry_low);
    document.getElementById('entry_high').textContent = fmt(p.entry_high);
    document.getElementById('stop').textContent = fmt(p.stop);
    document.getElementById('t2r').textContent = fmt(p.target_2r);
    document.getElementById('t3r').textContent = fmt(p.target_3r);
  }

  function renderPred(d) {
    const pr = d.predictions || {};
    const pd = pr.daily || {}; const pw = pr.weekly || {}; const pm = pr.monthly || {};
    document.getElementById('p_d').textContent = `${fmt(pd.predicted_close)} (${fmt((pd.expected_return||0)*100)}%)`;
    document.getElementById('p_w').textContent = `${fmt(pw.predicted_close)} (${fmt((pw.expected_return||0)*100)}%)`;
    document.getElementById('p_m').textContent = `${fmt(pm.predicted_close)} (${fmt((pm.expected_return||0)*100)}%)`;
    document.getElementById('p_b').textContent = `±${fmt(pd.vol_band)} (D), ±${fmt(pw.vol_band)} (W), ±${fmt(pm.vol_band)} (M)`;
  }

  function toTable(terms) {
    const rows = terms.map((t) => {
      const cls = colorCls(t.points);
      const meta = TERM_INFO[t.name] || { title: t.name, desc: '' };
      const tip = `${meta.desc}\nCurrent: ${fmt(t.value)}  |  Weight: ${(t.weight*100).toFixed(0)}%  |  Points: ${fmt(t.points)}`;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        return `
          <tr class="mrow" data-key="${t.name}">
            <td><button class="mterm" data-key="${t.name}">${meta.title}</button></td>
            <td>${fmt(t.value)}</td>
            <td>${(t.weight*100).toFixed(0)}%</td>
            <td class="points ${cls}">${fmt(t.points)}</td>
          </tr>
          <tr class="mdetail" data-key="${t.name}"><td colspan="4"><div class="mdesc" hidden><div class="title">${meta.title}</div><div class="desc">${tip.replace(/\n/g,'<br/>')}</div></div></td></tr>
        `;
      }
      return `<tr>
        <td class="tooltip" tabindex="0"><span>${meta.title}</span><div class="tip"><button class="tip-close" aria-label="Close">×</button><div class="title">${meta.title}</div><div class="desc">${tip.replace(/\n/g,'<br/>')}</div></div></td>
        <td>${fmt(t.value)}</td>
        <td>${(t.weight*100).toFixed(0)}%</td>
        <td class="points ${cls}">${fmt(t.points)}</td>
      </tr>`;
    }).join('');
    return `<table><thead><tr><th>Term</th><th>Value</th><th>Weight</th><th>Points</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderEquations(d) {
    const h = d.horizons;
    const container = document.getElementById('horizons');
    container.innerHTML = '';

    const sections = [
      ['Daily', h.daily],
      ['Weekly', h.weekly],
      ['Monthly', h.monthly],
    ];

    sections.forEach(([title, obj]) => {
      const sec = document.createElement('div');
      sec.className = 'h-section';
      const scoreCls = colorCls(obj.score);
      sec.innerHTML = `
        <div class="h-title">
          <h3>${title} <span class="badge ${scoreCls}">${fmt(obj.score)}</span></h3>
          <div class="subtle">Score: <span class="points ${scoreCls}">${fmt(obj.score)}</span></div>
        </div>
        ${toTable(obj.terms || [])}
      `;
      container.appendChild(sec);
    });
  }

  function renderMath(d) {
    const blend = d.blended?.weights || { daily: 0.5, weekly: 0.3, monthly: 0.2 };
    const host = document.getElementById('math_eq');
    host.innerHTML = '';

    const mkLine = (label, obj) => {
      const line = document.createElement('div');
      line.className = 'eq-line';
      const name = document.createElement('div');
      name.className = 'eq-name';
      name.textContent = label;
      line.appendChild(name);

      const pills = document.createElement('div');
      pills.className = 'eq-pills';
      (obj.terms||[]).forEach((t, i) => {
        if (i > 0) {
          const plus = document.createElement('span');
          plus.className = 'eq-plus';
          plus.textContent = '+';
          pills.appendChild(plus);
        }
        const pill = document.createElement('div');
        pill.className = 'pill ' + colorCls(t.points);
        pill.innerHTML = `<span class="w">${(t.weight*100).toFixed(0)}%</span> · <span>${TERM_INFO[t.name]?.title||t.name}</span> <span class="v">(${fmt(t.value)})</span>`;
        pills.appendChild(pill);
      });
      line.appendChild(pills);

      const total = document.createElement('div');
      total.className = 'eq-total points ' + colorCls(obj.score);
      total.textContent = `${fmt(obj.score)} pts`;
      line.appendChild(total);

      return line;
    };

    host.appendChild(mkLine('Daily', d.horizons.daily));
    host.appendChild(mkLine('Weekly', d.horizons.weekly));
    host.appendChild(mkLine('Monthly', d.horizons.monthly));

    const blended = document.createElement('div');
    blended.className = 'eq-line';
    blended.innerHTML = `
      <div class="eq-name">Blended</div>
      <div class="eq-pills">
        <div class="pill">${fmt(blend.daily*100)}% · Daily</div>
        <span class="eq-plus">+</span>
        <div class="pill">${fmt(blend.weekly*100)}% · Weekly</div>
        <span class="eq-plus">+</span>
        <div class="pill">${fmt(blend.monthly*100)}% · Monthly</div>
      </div>
      <div class="eq-total points ${colorCls(d.blended.score)}">${fmt(d.blended.score)} pts</div>
    `;
    host.appendChild(blended);
  }

  function setupTimers() {
    const timers = [
      { key: 'price', label: 'Price (hot.json)', intervalMs: 15*60*1000, source: 'https://raw.githubusercontent.com/oliveripkanam/mstr-advisor/hotdata/data/public/hot.json' },
      { key: 'news', label: 'News & sentiment', intervalMs: 10*60*1000, source: null },
      { key: 'snapshot', label: 'Snapshot (scores)', intervalMs: 60*60*1000, source: null },
      { key: 'daily', label: 'Daily datasets', intervalMs: 24*60*60*1000, source: null },
      { key: 'weekly', label: 'ML retrain', intervalMs: 7*24*60*60*1000, source: null },
    ];
    const host = document.getElementById('timers');
    if (!host) return;
    host.innerHTML = '';
    const now = Date.now();
    timers.forEach(t => {
      const box = document.createElement('div');
      box.className = 'col';
      const span = document.createElement('span');
      span.className = 'label';
      span.textContent = t.label;
      const val = document.createElement('span');
      val.className = 'value';
      val.id = `timer_${t.key}`;
      val.textContent = '—';
      box.appendChild(span);
      box.appendChild(val);
      host.appendChild(box);
    });

    function fmtCountdown(ms) {
      const s = Math.max(0, Math.floor(ms/1000));
      const h = Math.floor(s/3600);
      const m = Math.floor((s%3600)/60);
      const sec = s%60;
      if (h) return `${h}h ${m}m ${sec}s`;
      if (m) return `${m}m ${sec}s`;
      return `${sec}s`;
    }

    function roundUpTo(nextBaseMs, intervalMs) {
      return Math.ceil(nextBaseMs / intervalMs) * intervalMs;
    }

    // Compute next cron-like boundaries in UTC
    function nextBoundaryUtc(nowMs, minutesStep) {
      const d = new Date(nowMs);
      const m = d.getUTCMinutes();
      const nextM = minutesStep * Math.ceil((m + d.getUTCSeconds()/60) / minutesStep);
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), nextM, 0, 0));
      return next.getTime();
    }

    function nextDailyUtc(nowMs) {
      const d = new Date(nowMs);
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()+1, 0, 0, 0, 0));
      return next.getTime();
    }

    function nextWeeklyUtc(nowMs) {
      const d = new Date(nowMs);
      const day = d.getUTCDay();
      const daysUntilMonday = (8 - day) % 7; // Monday = 1
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilMonday, 0, 0, 0, 0));
      return next.getTime();
    }

    let lastPriceUtc = null;
    async function updateLastPriceTime() {
      try {
        const r = await fetch('https://raw.githubusercontent.com/oliveripkanam/mstr-advisor/hotdata/data/public/hot.json?t=' + Date.now(), { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j && j.asof_utc) lastPriceUtc = Date.parse(j.asof_utc);
        }
      } catch(_) {}
    }
    updateLastPriceTime();
    setInterval(updateLastPriceTime, 60*1000);

    function tick() {
      const now = Date.now();
      timers.forEach(t => {
        let nextTs;
        if (t.key === 'price') {
          // next 0,15,30,45 minute in UTC
          nextTs = nextBoundaryUtc(now, 15);
        } else if (t.key === 'news') {
          nextTs = nextBoundaryUtc(now, 10);
        } else if (t.key === 'snapshot') {
          nextTs = nextBoundaryUtc(now, 60);
        } else if (t.key === 'daily') {
          nextTs = nextDailyUtc(now);
        } else if (t.key === 'weekly') {
          nextTs = nextWeeklyUtc(now);
        }
        const nextIn = nextTs - now;
        const el = document.getElementById(`timer_${t.key}`);
        if (el) el.textContent = nextIn <= 0 ? 'running…' : `next in ${fmtCountdown(nextIn)}`;
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  function renderChart(d) {
    const ctx = document.getElementById('chart').getContext('2d');
    const labels = (d.series?.close || []).map(p => p.t);
    const ds = (key, color) => ({
      label: key.toUpperCase(),
      data: (d.series?.[key] || []).map(p => p.v),
      borderColor: color,
      backgroundColor: 'transparent',
      tension: 0.2,
      borderWidth: 1.6,
      pointRadius: 0,
    });
    // live/prev close caches
    let livePrice = null;
    let prevClose = null;

    // live marker disabled
    const liveMarkerPlugin = { id: 'liveMarker', afterDraw() { /* disabled */ } };

    Chart.register(liveMarkerPlugin);

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          ds('close', '#4aa3ff'),
          ds('ma20', '#ffd166'),
          ds('ma60', '#06d6a0'),
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#e8eef6' } }, tooltip: { enabled: false } },
        scales: {
          x: { ticks: { color: '#9fb0c3', maxTicksLimit: 8 }, grid: { display: false } },
          y: { ticks: { color: '#9fb0c3' }, grid: { color: '#1f2633' } }
        }
      }
    });

    async function fetchHot() {
      const isPages = typeof window !== 'undefined' && /github\.io$/.test(window.location.hostname);
      const repo = 'mstr-advisor';
      const urls = [
        'https://raw.githubusercontent.com/oliveripkanam/mstr-advisor/hotdata/data/public/hot.json',
        'https://raw.githubusercontent.com/oliveripkanam/mstr-advisor/main/data/public/hot.json',
        isPages ? `/mstr-advisor/data/public/hot.json` : '/data/public/hot.json',
        'data/public/hot.json',
        '../data/public/hot.json'
      ].map(u => u + `?t=${Date.now()}`);
      let best = null;
      let bestTs = -1;
      const seen = [];
      for (const url of urls) {
        try {
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) continue;
          const j = await r.json();
          const ts = j && j.asof_utc ? Date.parse(j.asof_utc) : 0;
          seen.push({ url, ts, asof_utc: j?.asof_utc });
          if (ts > bestTs) { bestTs = ts; best = { url, json: j }; }
        } catch (_) { /* next */ }
      }
      if (debug) {
        try { console.debug('[hot] candidates', seen); } catch (_) {}
        if (best) { console.debug('[hot] selected', best.url, best.json?.asof_utc); }
      }
      return best;
    }

    async function refreshLive() {
      const res = await fetchHot();
      const hot = res && res.json;
      if (hot) {
        const p = typeof hot.price === 'number' ? hot.price : (typeof hot.last_price === 'number' ? hot.last_price : null);
        if (typeof p === 'number') livePrice = p;
        const pc = typeof hot.prev_close === 'number' ? hot.prev_close : (typeof hot.previous_close === 'number' ? hot.previous_close : null);
        if (typeof pc === 'number') prevClose = pc;
        const asofDate = new Date(hot.asof_utc || Date.now());
        const hk = asofDate.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: true }).replace(',', '');
        const src = res.url.replace(/\?t=.*/, '');
        const asofEl = document.getElementById('asof');
        const stale = (Date.now() - asofDate.getTime()) > 15*60*1000;
        asofEl.innerHTML = `Last update: <strong>${hk} HKT${stale ? ' (stale)' : ''}</strong> · <a href="${src}" target="_blank" rel="noopener">price source</a>`;
        asofEl.classList.add('notice');
        if (debug) { try { console.debug('[hot] render', { src, asof_hkt: hk, stale }); } catch (_) {} }
        // Update the Summary price with live value if available
        const priceEl = document.getElementById('price');
        if (priceEl && typeof livePrice === 'number') priceEl.textContent = fmt(livePrice);
        chart.draw();
      }
    }

    // seed from last close
    const closeSeries = (d.series?.close || []).map(p => p.v).filter(v => typeof v === 'number');
    if (closeSeries.length > 0) {
      prevClose = closeSeries[closeSeries.length - 1];
      livePrice = prevClose;
      chart.draw();
    }
    refreshLive();
    setInterval(refreshLive, 60000);
  }

  try {
    const data = await fetchSnapshot();
    renderSummary(data);
    renderPlan(data);
    renderPred(data);
    renderEquations(data);
    renderMath(data);
    setupTimers();
    renderChart(data);
    // Mobile-only: expand/collapse rows
    const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const horizons = document.getElementById('horizons');
      horizons.addEventListener('click', function (e) {
        const btn = e.target && e.target.closest ? e.target.closest('.mterm') : null;
        if (!btn) return;
        const key = btn.getAttribute('data-key');
        const row = horizons.querySelector(`tr.mdetail[data-key="${key}"]`);
        if (row) {
          row.classList.toggle('open');
          const box = row.querySelector('.mdesc');
          if (box) {
            const isHidden = box.hasAttribute('hidden');
            if (isHidden) box.removeAttribute('hidden'); else box.setAttribute('hidden','');
          }
        }
      });
    }
  } catch (e) {
    document.getElementById('asof').textContent = 'Failed to load data';
    console.error(e);
  }
})();
