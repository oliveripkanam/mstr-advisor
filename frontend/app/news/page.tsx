"use client";
import React, { useEffect, useState } from "react";

type NewsItem = { source: string; title: string; url: string; published_utc: string; score?: number };
type NewsFile = { asof_utc: string; items: NewsItem[] };

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const REPO = 'oliveripkanam/mstr-advisor';
    const hot = `https://raw.githubusercontent.com/${REPO}/hotdata/data/public/news.json?t=${Date.now()}`;
    const main = `https://raw.githubusercontent.com/${REPO}/main/data/public/news.json?t=${Date.now()}`;
    const local = 'data/public/news.json';
    (async () => {
      for (const p of [hot, local, main]) {
        try {
          const r = await fetch(p, { cache: 'no-store' });
          if (!r.ok) continue;
          const d: NewsFile = await r.json();
          const list = Array.isArray(d?.items) ? d.items.slice(0, 20) : [];
          setItems(list);
          setErr(null);
          return;
        } catch {}
      }
      setErr('Unable to load news');
    })();
  }, []);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!items) return <div className="p-4 text-gray-500">Loading…</div>;

  const scoreBadge = (s?: number) => {
    if (typeof s !== 'number') return null;
    const tone = s>0? 'bg-green-100 text-green-800' : s<0? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700';
    const label = s>0? 'Positive' : s<0? 'Negative' : 'Neutral';
    return <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${tone}`}>{label}</span>;
  };

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Real-world Events</h1>
      <div className="rounded border">
        <ul className="divide-y">
          {items.map((it, idx) => (
            <li key={idx} className="p-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <a className="text-primary underline break-words" href={it.url} target="_blank" rel="noreferrer noopener">
                  {it.title || '(no title)'}
                </a>
                <div className="text-xs text-gray-500 sm:whitespace-nowrap">
                  {new Date(it.published_utc).toLocaleString()} · {it.source}
                  {scoreBadge(it.score)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}


