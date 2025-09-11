(async function () {
  const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : (typeof v === 'number' ? v.toFixed(2) : String(v)));
  const colorCls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

  async function fetchSnapshot() {
    const url = 'data/public/model_snapshot.json?t=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load model_snapshot.json');
    return res.json();
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

  try {
    const data = await fetchSnapshot();
    renderSummary(data);
    renderPlan(data);
    renderEquations(data);
  } catch (e) {
    document.getElementById('asof').textContent = 'Failed to load data';
    console.error(e);
  }
})();
