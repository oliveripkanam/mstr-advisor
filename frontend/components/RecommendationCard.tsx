"use client";
import React, { useEffect, useState } from 'react';
import ProbabilityBars from './ProbabilityBars';

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
type FrontendConfig = {
  useCombinedRecommendation?: boolean;
  showProbabilityBars?: boolean;
};

export default function RecommendationCard() {
  const [rec, setRec] = useState<Rec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ml, setMl] = useState<MLProbs | null>(null);
  const [cfg, setCfg] = useState<FrontendConfig>({ useCombinedRecommendation: true, showProbabilityBars: true });

  useEffect(() => {
    fetch('configs/frontend.json')
      .then((r) => r.json())
      .then((c: FrontendConfig) => setCfg((prev) => ({ ...prev, ...c })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const key = 'latest_recommendation_cache';
    const path = cfg.useCombinedRecommendation
      ? 'data/public/latest_recommendation_combined.json'
      : 'data/public/latest_recommendation.json';
    fetch(path)
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
  }, [cfg.useCombinedRecommendation]);

  useEffect(() => {
    fetch('data/public/ml_latest_probs.json')
      .then((r) => r.json())
      .then((d: MLProbs) => setMl(d))
      .catch(() => setMl(null));
  }, []);

  if (error) {
    return <div role="alert" aria-live="assertive" className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  }

  if (!rec) {
    return <div role="status" aria-live="polite" className="rounded border border-gray-200 bg-white p-4 text-gray-500">Loading recommendation…</div>;
  }

  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-xl font-semibold">Today’s Recommendation</h2>
        <span className="text-xs text-gray-500">{rec.timestamp}</span>
        {cfg.useCombinedRecommendation && (
          <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">Combined</span>
        )}
      </div>
      <div className="mb-3">
        <span className="text-sm text-gray-700">Action: </span>
        <span className="text-base font-medium">{rec.action}</span>
      </div>
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <span>Confidence</span>
          <span aria-live="polite">{rec.confidence}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rec.confidence} aria-label="Recommendation confidence">
          <div className="h-2 bg-blue-600 transition-[width] duration-500 ease-out" style={{ width: `${rec.confidence}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div>Entry: {rec.entry_zone?.[0]?.toFixed(2)} – {rec.entry_zone?.[1]?.toFixed(2)}</div>
          <div>Stop: {rec.stop?.toFixed(2)}</div>
          <div>Take Profit: {rec.take_profit?.toFixed(2)}</div>
        </div>
        <div>
          <div>Confidence: {rec.confidence}%</div>
          {ml && !cfg.showProbabilityBars && (
            <div className="mt-1 text-xs text-gray-600">ML (5d): {Object.entries(ml.probs).map(([k,v]) => `${k}: ${(v*100).toFixed(0)}%`).join(' · ')}</div>
          )}
          {ml && cfg.showProbabilityBars && (
            <div aria-label="ML class probabilities" className="mt-1">
              <ProbabilityBars probs={ml.probs} />
            </div>
          )}
        </div>
      </div>
      {rec.why && (
        <div className="mt-3 text-sm text-gray-700">
          <div className="font-medium">Why:</div>
          <div>{rec.why}</div>
        </div>
      )}
    </div>
  );
}
