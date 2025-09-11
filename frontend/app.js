(async function () {
  const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : (typeof v === 'number' ? v.toFixed(2) : String(v)));
  const colorCls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

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
    document.getElementById('action').textContent = d.blended.action;
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

  function toTable(terms) {
    const rows = terms.map((t) => {
      const cls = colorCls(t.points);
      return `<tr><td>${t.name}</td><td>${fmt(t.value)}</td><td>${(t.weight*100).toFixed(0)}%</td><td class="points ${cls}">${fmt(t.points)}</td></tr>`;
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
          <h3>${title}</h3>
          <div class="subtle">Score: <span class="points ${scoreCls}">${fmt(obj.score)}</span></div>
        </div>
        ${toTable(obj.terms || [])}
      `;
      container.appendChild(sec);
    });
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
    renderEquations(data);
    renderChart(data);
  } catch (e) {
    document.getElementById('asof').textContent = 'Failed to load data';
    console.error(e);
  }
})();
