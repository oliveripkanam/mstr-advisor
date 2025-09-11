(async function () {
  const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : (typeof v === 'number' ? v.toFixed(2) : String(v)));
  const colorCls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'neutral');

  const TERM_INFO = {
    btc_1d_beta: { title: 'BTC 1D × Beta', desc: 'Impact from BTC daily return scaled by MSTR\'s rolling beta. Positive when BTC up and beta positive.' },
    trend_short: { title: 'Short-term Trend', desc: 'Distance to 20/50DMA and 20DMA slope. Positive above rising MAs; negative below falling MAs.' },
    momentum: { title: 'Momentum', desc: 'RSI(14) deviation from 50 and 10-day rate of change. Positive when momentum is improving.' },
    mean_reversion: { title: 'Mean Reversion', desc: 'Penalizes large distance from 20DMA; Bollinger %B near extremes suggests snapback.' },
    vix_risk: { title: 'VIX Risk', desc: 'Higher VIX implies risk-off; contributes negatively when volatility regime is elevated.' },
    usd_risk: { title: 'USD (DXY/UUP)', desc: 'Rising USD is generally a headwind for risk assets; negative when USD strengthens.' },
    tech_beta: { title: 'Tech Beta (QQQ)', desc: 'Exposure to broader tech market via QQQ. Positive when QQQ up and MSTR beta positive.' },
    atr_penalty: { title: 'ATR% Penalty', desc: 'Volatility tax using ATR as a percent of price. High volatility reduces score.' },
    news_short: { title: 'News Sentiment (24–48h)', desc: 'Headline sentiment aggregate; positive if news flow is favorable.' },
    btc_1w_regime: { title: 'BTC 1W Regime', desc: 'Weekly BTC return/regime context driving MSTR sensitivity.' },
    trend_struct: { title: 'Trend Structure', desc: '20/50DMA cross and slope structure on the weekly horizon.' },
    macro_risk: { title: 'Macro Risk (VIX, USD)', desc: 'Composite of VIX and USD; higher risk is negative.' },
    momentum_week: { title: 'Weekly Momentum', desc: '4-week rate of change for MSTR.' },
    wk52_structure: { title: '52-Week Structure', desc: 'Proximity to 52-week high; strength context.' },
    news_week: { title: 'News (7d)', desc: 'Weekly news sentiment aggregate.' },
    market_beta_week: { title: 'Market Beta (QQQ 1W)', desc: 'Weekly QQQ linkage.' },
    btc_1m_regime: { title: 'BTC 1M Regime', desc: 'Monthly BTC return/regime context.' },
    trend_long: { title: 'Long Trend', desc: '50/200DMA slope/cross regime.' },
    momentum_quarter: { title: 'Quarter Momentum', desc: '3-month rate of change.' },
    atr_penalty_month: { title: 'ATR% Penalty (1M)', desc: 'Monthly volatility tax.' },
    news_month: { title: 'News (30d)', desc: 'Monthly news sentiment aggregate.' },
    market_beta_month: { title: 'Market Beta (QQQ 1M)', desc: 'Monthly QQQ linkage.' }
  };

  async function fetchSnapshot() {
    const candidates = [
      '/data/public/model_snapshot.json',
      '../data/public/model_snapshot.json',
      'data/public/model_snapshot.json'
    ].map(u => u + (u.includes('?') ? '' : `?t=${Date.now()}`));
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return res.json();
      } catch (_) { /* try next */ }
    }
    throw new Error('Failed to load model_snapshot.json');
  }

  function renderSummary(d) {
    document.getElementById('asof').textContent = `as of ${d.asof}`;
    const actionEl = document.getElementById('action');
    actionEl.textContent = d.blended.action;
    actionEl.className = 'badge ' + (d.blended.score > 10 ? 'pos' : d.blended.score < -10 ? 'neg' : 'neutral');
    document.getElementById('blended').textContent = fmt(d.blended.score);
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
      return `<tr>
        <td class="tooltip"><span>${meta.title}</span><div class="tip"><div class="title">${meta.title}</div><div class="desc">${tip.replace(/\n/g,'<br/>')}</div></div></td>
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
        pill.innerHTML = `<span class="w">${(t.weight*100).toFixed(0)}%</span> · <span class="tooltip">${TERM_INFO[t.name]?.title||t.name}<div class=\"tip\"><div class=\"title\">${TERM_INFO[t.name]?.title||t.name}</div><div class=\"desc\">${(TERM_INFO[t.name]?.desc||'').replace(/\n/g,'<br/>')}<br/>Current: ${fmt(t.value)} | Weight: ${(t.weight*100).toFixed(0)}% | Points: ${fmt(t.points)}</div></div></span> <span class="v">(${fmt(t.value)})</span>`;
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
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          ds('close', '#4aa3ff'),
          ds('ma20', '#ffd166'),
          ds('ma50', '#06d6a0'),
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e8eef6' } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { ticks: { color: '#9fb0c3', maxTicksLimit: 8 }, grid: { display: false } },
          y: { ticks: { color: '#9fb0c3' }, grid: { color: '#1f2633' } }
        }
      }
    });
  }

  try {
    const data = await fetchSnapshot();
    renderSummary(data);
    renderPlan(data);
    renderPred(data);
    renderEquations(data);
    renderMath(data);
    renderChart(data);
  } catch (e) {
    document.getElementById('asof').textContent = 'Failed to load data';
    console.error(e);
  }
})();
