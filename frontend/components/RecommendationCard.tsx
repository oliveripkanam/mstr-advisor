"use client";
import React, { useEffect, useState } from 'react';

type Rec = {
  symbol: string;
  timestamp: string;
  action: string;
  entry_zone: [number, number];
  stop: number;
  take_profit: number;
  confidence: number;
  why?: string;
};

type MLProbs = { timestamp: string; probs: Record<string, number> };

export default function RecommendationCard() {
  const [rec, setRec] = useState<Rec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ml, setMl] = useState<MLProbs | null>(null);

  useEffect(() => {
    const key = 'latest_recommendation_cache';
    fetch('data/public/latest_recommendation.json')
      .then((r) => r.json())
      .then((d: Rec) => {
        setRec(d);
        try { localStorage.setItem(key, JSON.stringify(d)); } catch {}
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) { setRec(JSON.parse(cached)); return; }
        } catch {}
        setError('Unable to load recommendation');
      });
  }, []);

  useEffect(() => {
    fetch('data/public/ml_latest_probs.json')
      .then((r) => r.json())
      .then((d: MLProbs) => setMl(d))
      .catch(() => setMl(null));
  }, []);

  if (error) {
    return <div className="rounded border p-4 text-red-600">{error}</div>;
  }

  if (!rec) {
    return <div className="rounded border p-4 text-gray-500">Loading recommendation…</div>;
  }

  return (
    <div className="rounded border p-4 bg-white">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-xl font-semibold">Today’s Recommendation</h2>
        <span className="text-xs text-gray-500">{rec.timestamp}</span>
      </div>
      <div className="mb-2">
        <span className="text-sm text-gray-700">Action: </span>
        <span className="text-base font-medium">{rec.action}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div>Entry: {rec.entry_zone?.[0]?.toFixed(2)} – {rec.entry_zone?.[1]?.toFixed(2)}</div>
          <div>Stop: {rec.stop?.toFixed(2)}</div>
          <div>Take Profit: {rec.take_profit?.toFixed(2)}</div>
        </div>
        <div>
          <div>Confidence: {rec.confidence}%</div>
          {ml && (
            <div className="mt-1 text-xs text-gray-600">
              ML (5d): {Object.entries(ml.probs).map(([k,v]) => `${k}: ${(v*100).toFixed(0)}%`).join(' · ')}
            </div>
          )}
        </div>
      </div>
      {rec.why && (
        <div className="mt-3 text-sm text-gray-600">
          <div className="font-medium">Why:</div>
          <div>{rec.why}</div>
        </div>
      )}
    </div>
  );
}
