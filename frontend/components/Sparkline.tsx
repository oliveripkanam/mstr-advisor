"use client";
import React from "react";

type Props = {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
};

export default function Sparkline({ data, width = 140, height = 28, stroke = "#2563eb", strokeWidth = 1.5, fill }: Props) {
  const clean = (data || []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const n = clean.length;
  if (n === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <rect x="0" y="0" width={width} height={height} rx="3" ry="3" fill="#ffffff" stroke="#e5e7eb" />
      </svg>
    );
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1e-9;

  const points = clean.map((v, i) => {
    const x = n === 1 ? width / 2 : (i / (n - 1)) * (width - 2) + 1;
    const y = height - 1 - ((v - min) / span) * (height - 2);
    return [x, y] as const;
  });

  const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  let areaD: string | null = null;
  if (fill && n >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    areaD = `${pathD} L${last[0].toFixed(2)},${(height - 1).toFixed(2)} L${first[0].toFixed(2)},${(height - 1).toFixed(2)} Z`;
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <rect x="0" y="0" width={width} height={height} rx="3" ry="3" fill="#ffffff" stroke="#e5e7eb" />
      {fill && areaD && <path d={areaD} fill={fill} stroke="none" />}
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}


