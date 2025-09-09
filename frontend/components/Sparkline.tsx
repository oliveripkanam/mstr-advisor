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
  if (!data || data.length === 0) return null;
  const n = data.length;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1e-9;

  const points = data.map((v, i) => {
    const x = (i / (n - 1)) * (width - 2) + 1;
    const y = height - 1 - ((v - min) / span) * (height - 2);
    return [x, y] as const;
  });

  const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  let areaD: string | null = null;
  if (fill) {
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


