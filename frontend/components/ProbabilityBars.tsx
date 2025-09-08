"use client";
import React from "react";

type Probs = Record<string, number>;

export default function ProbabilityBars({ probs }: { probs: Probs }) {
  const entries = Object.entries(probs);
  if (!entries.length) return null;

  return (
    <div className="mt-2 space-y-1 text-xs">
      {entries.map(([label, p]) => {
        const pct = Math.round(p * 100);
        const width = Math.max(2, Math.min(100, pct));
        const color = label.toLowerCase() === "up" ? "bg-green-600" : label.toLowerCase() === "down" ? "bg-red-600" : "bg-gray-500";
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="w-14 text-right text-gray-600">{label}</div>
            <div className="flex-1 h-2 bg-gray-200">
              <div className={`h-2 ${color}`} style={{ width: `${width}%` }} />
            </div>
            <div className="w-8 text-right text-gray-700">{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}


