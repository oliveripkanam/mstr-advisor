import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { formatCurrency, formatPercentage } from "../../lib/formatting";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
// Pagination removed per request

type Asset = 'BTC' | 'MSTR';

type DailyBar = {
	ts: number; // unix seconds
	open: number;
	close: number;
	high?: number;
	low?: number;
	volume?: number;
};

type DayRow = DailyBar & {
	label: string; // e.g., Mon, Oct 6
	status: 'up' | 'down' | 'flat';
	deltaAbs: number;
	deltaPct: number; // decimal, e.g., 0.0123 = 1.23%
};

const TZ_EASTERN = 'America/New_York';
const TZ_UTC = 'UTC';

function dateLabel(tsSec: number, timeZone: string) {
	const d = new Date(tsSec * 1000);
	const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone }).formatToParts(d);
	const wk = parts.find(p => p.type === 'weekday')?.value ?? '';
	const mon = parts.find(p => p.type === 'month')?.value ?? '';
	const day = parts.find(p => p.type === 'day')?.value ?? '';
	return `${wk}, ${mon} ${day}`;
}

function weekdayShort(tsSec: number, timeZone: string): 'Sun'|'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat' {
	const d = new Date(tsSec * 1000);
	const wk = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(d);
	return wk as any;
}

// Keep helper for potential future WTD use, but not used in 365d mode
function lastMondaySlice(bars: DailyBar[], timeZone: string): DailyBar[] {
	if (!bars.length) return bars;
	const sorted = [...bars].sort((a, b) => a.ts - b.ts);
	let lastMonIdx = -1;
	for (let i = 0; i < sorted.length; i++) {
		if (weekdayShort(sorted[i].ts, timeZone) === 'Mon') lastMonIdx = i;
	}
	if (lastMonIdx === -1) return sorted.slice(-7);
	return sorted.slice(lastMonIdx);
}

async function fetchYahooDailyBars(symbol: string, includePrePost = false): Promise<DailyBar[]> {
	const PROXY = import.meta.env.VITE_YAHOO_PROXY_URL as string | undefined;
	const VERCEL = import.meta.env.VITE_YAHOO_VERCEL_URL as string | undefined;
	const YAHOO_BASE = PROXY ?? VERCEL ?? '/api/yahoo';
	const params = new URLSearchParams({ interval: '1d', range: '1y', includePrePost: String(includePrePost) });
	const url = `${YAHOO_BASE}/v8/finance/chart/${symbol}?${params.toString()}`;
	const r = await fetch(url);
	if (!r.ok) throw new Error('Yahoo chart fetch failed');
	const j = await r.json();
	const res = j?.chart?.result?.[0];
	const ts: number[] | undefined = res?.timestamp;
	const q = res?.indicators?.quote?.[0];
	const opens: Array<number | null | undefined> | undefined = q?.open;
	const closes: Array<number | null | undefined> | undefined = q?.close;
	const highs: Array<number | null | undefined> | undefined = q?.high;
	const lows: Array<number | null | undefined> | undefined = q?.low;
	const vols: Array<number | null | undefined> | undefined = q?.volume;
	const out: DailyBar[] = [];
	if (Array.isArray(ts) && Array.isArray(opens) && Array.isArray(closes)) {
		for (let i = 0; i < ts.length; i++) {
			const o = opens[i];
			const c = closes[i];
			if (typeof o === 'number' && typeof c === 'number') {
				out.push({
					ts: ts[i],
					open: o,
					close: c,
					high: typeof highs?.[i] === 'number' ? highs![i] as number : undefined,
					low: typeof lows?.[i] === 'number' ? lows![i] as number : undefined,
					volume: typeof vols?.[i] === 'number' ? vols![i] as number : undefined,
				});
			}
		}
	}
	return out;
}

function enrichRows(bars: DailyBar[], asset: Asset): DayRow[] {
	const tz = asset === 'MSTR' ? TZ_EASTERN : TZ_UTC;
	return bars.map(b => {
		const deltaAbs = b.close - b.open;
		const deltaPct = b.open !== 0 ? (b.close / b.open - 1) : 0;
		const status: DayRow['status'] = deltaAbs > 0 ? 'up' : deltaAbs < 0 ? 'down' : 'flat';
		return {
			...b,
			label: dateLabel(b.ts, tz),
			status,
			deltaAbs,
			deltaPct,
		};
	});
}

function isMstrSessionClosedNow(): boolean {
	// Session close ~ 16:00 ET; if now ET time >= 16:00, consider closed
	const now = new Date();
	const parts = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, minute: '2-digit', timeZone: TZ_EASTERN }).formatToParts(now);
	const hh = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
	const mm = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
	return hh > 16 || (hh === 16 && mm >= 0);
}

export default function DailyCloseTracker() {
	const [asset, setAsset] = useState<Asset>('BTC');
	const [rows, setRows] = useState<DayRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Show only most recent 10 rows (newest first)
	const pageSize = 10;

	useEffect(() => {
		let mounted = true;
		async function load() {
			try {
				setLoading(true);
				setError(null);
				const symbol = asset === 'BTC' ? 'BTC-USD' : 'MSTR';
				const includePrePost = asset === 'MSTR' ? false : false;
				const bars = await fetchYahooDailyBars(symbol, includePrePost);
				const tz = asset === 'MSTR' ? TZ_EASTERN : TZ_UTC;
				// Use entire available range (up to 1y); exclude today's not-closed MSTR session
				let filtered = [...bars];
				if (asset === 'MSTR' && !isMstrSessionClosedNow()) {
					const todayLabel = dateLabel(Math.floor(Date.now() / 1000), TZ_EASTERN);
					filtered = filtered.filter(b => dateLabel(b.ts, TZ_EASTERN) !== todayLabel);
				}
				const enriched = enrichRows(filtered, asset);
				if (mounted) setRows(enriched.reverse()); // newest first
			} catch (e: any) {
				console.error(e);
				if (mounted) setError('Failed to load daily data');
			} finally {
				if (mounted) setLoading(false);
			}
		}
		load();
		return () => { mounted = false; };
	}, [asset]);

	const counts = useMemo(() => {
		let green = 0, red = 0, flat = 0;
		for (const r of rows) {
			if (r.status === 'up') green++; else if (r.status === 'down') red++; else flat++;
		}
		const totalRows = rows.length;
		const greenPct = totalRows > 0 ? (green / totalRows) : 0;
		const redPct = totalRows > 0 ? (red / totalRows) : 0;
		const flatPct = totalRows > 0 ? (flat / totalRows) : 0;
		return { green, red, flat, total: totalRows, greenPct, redPct, flatPct };
	}, [rows]);

	const pageRows = useMemo(() => rows.slice(0, pageSize), [rows]);

	return (
		<Card>
			<CardHeader className="border-b">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Daily Close — Last 365 Days (showing latest 10)</CardTitle>
						<CardDescription>
							{asset === 'BTC' ? 'UTC daily closes' : 'US/Eastern regular session closes'}
						</CardDescription>
					</div>
					<div>
						<Select value={asset} onValueChange={(v) => setAsset(v as Asset)}>
							<SelectTrigger className="h-8 w-28 px-3" aria-label="Select asset">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="BTC">BTC</SelectItem>
								<SelectItem value="MSTR">MSTR</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{/* Summary counters */}
				<div className="flex flex-wrap items-center gap-3 mb-4">
					<span className="inline-flex items-center gap-2 rounded-md bg-green-400/5 text-green-400 px-2 py-1 text-sm">
						<TrendingUp className="w-4 h-4" /> {counts.green} green
					</span>
					<span className="inline-flex items-center gap-2 rounded-md bg-red-400/5 text-red-400 px-2 py-1 text-sm">
						<TrendingDown className="w-4 h-4" /> {counts.red} red
					</span>
					<span className="text-xs text-muted-foreground">Closed days only</span>
				</div>

				{/* Stacked bar (aggregated over last 365 days) */}
				<div className="w-full h-3 rounded-full bg-muted overflow-hidden mb-4 flex" role="img" aria-label={`Green ${Math.round(counts.greenPct*100)}%, Flat ${Math.round(counts.flatPct*100)}%, Red ${Math.round(counts.redPct*100)}%`}>
					<div className="h-full bg-green-400" style={{ width: `${counts.greenPct * 100}%` }} />
					<div className="h-full bg-border" style={{ width: `${counts.flatPct * 100}%` }} />
					<div className="h-full bg-red-400" style={{ width: `${counts.redPct * 100}%` }} />
				</div>

				{/* List */}
				{loading ? (
					<div role="status" aria-live="polite" className="text-sm text-muted-foreground">Loading…</div>
				) : error ? (
					<div role="alert" className="text-sm text-rose-400">{error}</div>
				) : rows.length === 0 ? (
					<div className="text-sm text-muted-foreground">No closed days in range.</div>
				) : (
					<div className="max-h-96 overflow-auto border rounded-md divide-y">
						{pageRows.map((r, idx) => {
							const up = r.status === 'up';
							const down = r.status === 'down';
							const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
							return (
								<div key={r.ts} className="flex items-center justify-between gap-4 px-4 py-3">
									<div className="flex items-center gap-3">
										<Icon className={`w-4 h-4 ${up ? 'text-green-400' : down ? 'text-red-400' : 'text-muted-foreground'}`} aria-hidden />
										<div className="text-sm">
											<div className="font-medium">{r.label}</div>
											<div className="text-xs text-muted-foreground">Open {formatCurrency(r.open, asset==='BTC'?2:2)} → Close {formatCurrency(r.close, asset==='BTC'?2:2)}</div>
										</div>
									</div>
									<div className="text-right">
										<div className={`text-sm font-medium text-foreground`}>
											{r.deltaAbs > 0 ? '+' : r.deltaAbs < 0 ? '-' : ''}{formatCurrency(Math.abs(r.deltaAbs), asset==='BTC'?2:2)}
										</div>
										<div className={`text-xs ${up ? 'text-green-400' : down ? 'text-red-400' : 'text-muted-foreground'}`}>{r.deltaPct >= 0 ? '+' : ''}{formatPercentage(r.deltaPct, 2)}</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

