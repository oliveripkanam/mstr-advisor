"use client";
import React, { useEffect, useRef, useState } from "react";

type HotData = {
	asof_utc?: string; // optional UTC timestamp
	timestamp?: string; // fallback key used by backend
	symbol?: string;
	last_price?: number;
	prev_close?: number;
	change_pct?: number;
	market_open?: boolean;
};

function useDocumentVisible(): boolean {
	const [visible, setVisible] = useState<boolean>(true);
	useEffect(() => {
		const onChange = () => setVisible(document.visibilityState === "visible");
		document.addEventListener("visibilitychange", onChange);
		return () => document.removeEventListener("visibilitychange", onChange);
	}, []);
	return visible;
}

export default function HotPreview() {
	const [data, setData] = useState<HotData | null>(null);
	const visible = useDocumentVisible();
	const timerRef = useRef<number | null>(null);

	useEffect(() => {
		const REPO = "oliveripkanam/mstr-advisor"; // adjust if repo changes
		const BRANCH = "hotdata"; // hot data branch
		const PATH = "data/public/hot.json";
		const base = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${PATH}`;

		async function fetchOnce() {
			try {
				const res = await fetch(`${base}?t=${Date.now()}`, { cache: "no-store" });
				if (!res.ok) return;
				const j = (await res.json()) as HotData;
				setData(j);
			} catch {
				// ignore network errors
			}
		}

		fetchOnce();
		if (timerRef.current) window.clearInterval(timerRef.current);
		if (visible) {
			timerRef.current = window.setInterval(fetchOnce, 90_000);
		}
		return () => {
			if (timerRef.current) window.clearInterval(timerRef.current);
		};
	}, [visible]);

	if (!data) return null;

	const ts = data.asof_utc || data.timestamp;
	if (!ts) return null;

	let pctNum: number | null = null;
	if (typeof data.change_pct === "number") {
		// Accept either fraction (-0.0178) or percent (-1.78)
		pctNum = Math.abs(data.change_pct) <= 1.5 ? data.change_pct * 100 : data.change_pct;
	} else if (typeof data.last_price === "number" && typeof data.prev_close === "number") {
		pctNum = ((data.last_price - data.prev_close) / data.prev_close) * 100;
	}
	const pct = pctNum !== null ? pctNum.toFixed(2) : "--";
	const dir = (pctNum ?? 0) > 0 ? "text-green-700" : (pctNum ?? 0) < 0 ? "text-red-700" : "text-gray-700";

	return (
		<div className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-gray-800" role="status" aria-live="polite">
			<span className="font-medium">Live preview</span>
			<span className="mx-2">•</span>
			<span>{new Date(ts).toUTCString()}</span>
			<span className="mx-2">•</span>
			<span>
				{data.symbol} {typeof data.last_price === "number" ? data.last_price.toFixed(2) : "--"}
				{" "}
				<span className={dir}>({pct}%)</span>
			</span>
		</div>
	);
}
