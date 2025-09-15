import os
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

try:
    import yfinance as yf
except Exception as exc:  # pragma: no cover
    raise SystemExit("yfinance is required. Please install dependencies from requirements.txt") from exc


def ensure_dirs(path: str) -> None:
    directory = os.path.dirname(path)
    if directory and not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)


def to_lower_cols(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [c.lower() for c in df.columns]
    return df


def fetch_history(ticker: str, period: str = "2y") -> pd.DataFrame:
    data = yf.Ticker(ticker).history(period=period, auto_adjust=False)
    if data is None or data.empty:
        raise RuntimeError(f"No data for {ticker}")
    df = to_lower_cols(data)
    if 'close' not in df.columns:
        raise RuntimeError(f"Ticker {ticker} missing close column")
    return df


def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = (delta.where(delta > 0, 0.0)).ewm(alpha=1.0/period, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0.0)).ewm(alpha=1.0/period, adjust=False).mean()
    rs = gain / (loss.replace(0, np.nan))
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)


def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df['high']
    low = df['low']
    close = df['close']
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1.0/period, adjust=False).mean()
    return atr


def zscore(series: pd.Series, window: int = 252, clip: float = 2.5) -> pd.Series:
    s = series.copy()
    if len(s) < 3:
        return pd.Series(np.zeros_like(s), index=s.index)
    rolling = s.rolling(window=min(window, len(s)), min_periods=10)
    mean = rolling.mean()
    std = rolling.std(ddof=0).replace(0, np.nan)
    z = (s - mean) / std
    z = z.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    if clip is not None:
        z = z.clip(lower=-clip, upper=clip)
    return z


def percent_rank(series: pd.Series, window: int = 252) -> pd.Series:
    def pr(x: pd.Series) -> float:
        if len(x) <= 1:
            return 0.5
        return (x.rank(pct=True).iloc[-1])
    return series.rolling(window=min(window, len(series)), min_periods=10).apply(pr, raw=False).fillna(0.5)


def last(series: pd.Series) -> float:
    return float(series.iloc[-1]) if len(series) else 0.0


def safe_div(n: float, d: float) -> float:
    if d == 0 or d is None or np.isnan(d):
        return 0.0
    return n / d


@dataclass
class TermContribution:
    name: str
    value: float
    weight: float
    points: float


def load_weights(weights_path: str) -> Dict:
    with open(weights_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def compute_common(df_mstr: pd.DataFrame) -> Dict[str, pd.Series]:
    close = df_mstr['close']
    ma20 = close.rolling(20).mean()
    ma60 = close.rolling(60).mean()
    ma200 = close.rolling(200).mean()
    ma20_slope = ma20.diff(5) / 5.0
    rsi14 = compute_rsi(close, 14)
    roc10 = close.pct_change(10)
    atr = compute_atr(df_mstr, 14)
    atr_pct = atr / close
    dist_20 = (close - ma20) / ma20
    dist_60 = (close - ma60) / ma60
    bb_upper = ma20 + 2 * close.rolling(20).std(ddof=0)
    bb_lower = ma20 - 2 * close.rolling(20).std(ddof=0)
    bb_range = (bb_upper - bb_lower).replace(0, np.nan)
    bbp = (close - bb_lower) / bb_range  # Bollinger %B
    wk52_high = close.rolling(252).max()
    proximity_52w = (close / wk52_high) - 1.0

    return {
        'close': close,
        'ma20': ma20,
        'ma60': ma60,
        'ma200': ma200,
        'ma20_slope': ma20_slope,
        'rsi14': rsi14,
        'roc10': roc10,
        'atr': atr,
        'atr_pct': atr_pct,
        'dist_20': dist_20,
        'dist_60': dist_60,
        'bbp': bbp,
        'wk52_prox': proximity_52w,
        'low': df_mstr['low']
    }


def rolling_beta(x: pd.Series, y: pd.Series, window: int = 60) -> pd.Series:
    cov = x.rolling(window, min_periods=20).cov(y)
    var = y.rolling(window, min_periods=20).var()
    beta = cov / var.replace(0, np.nan)
    return beta.fillna(0.0)


def daily_terms(df_mstr: pd.DataFrame,
                df_btc: pd.DataFrame,
                df_qqq: pd.DataFrame,
                df_vix: pd.DataFrame,
                df_uup: pd.DataFrame,
                common: Dict[str, pd.Series]) -> Dict[str, float]:
    mret = df_mstr['close'].pct_change()
    bret = df_btc['close'].pct_change()
    qret = df_qqq['close'].pct_change()

    beta_btc = rolling_beta(mret, bret)
    beta_qqq = rolling_beta(mret, qret)

    # Core normalized signals
    btc_impact = zscore(bret * beta_btc)
    trend = (zscore(common['dist_20']) + zscore(common['dist_60']) + zscore(common['ma20_slope'])) / 3.0
    momentum = ((common['rsi14'] - 50.0) / 50.0).clip(-2.5, 2.5)
    momentum = (momentum + zscore(common['roc10'])) / 2.0
    mean_rev = (-zscore((common['dist_20']).abs()) + (0.5 - (percent_rank(common['bbp']) - 0.5))) / 2.0
    vix_risk = -zscore(df_vix['close'])
    usd_risk = -zscore(df_uup['close'].pct_change())
    tech_beta = zscore(qret * beta_qqq)
    atr_pen = -zscore(common['atr_pct'])

    return {
        'btc_1d_beta': last(btc_impact),
        'trend_short': last(trend),
        'momentum': last(momentum),
        'mean_reversion': last(mean_rev),
        'vix_risk': last(vix_risk),
        'usd_risk': last(usd_risk),
        'tech_beta': last(tech_beta),
        'atr_penalty': last(atr_pen),
        'news_short': 0.0  # placeholder; integrate when news pipeline is ready
    }


def weekly_terms(df_mstr: pd.DataFrame,
                 df_btc: pd.DataFrame,
                 df_qqq: pd.DataFrame,
                 df_vix: pd.DataFrame,
                 df_uup: pd.DataFrame,
                 common: Dict[str, pd.Series]) -> Dict[str, float]:
    bret_5 = df_btc['close'].pct_change(5)
    qret_5 = df_qqq['close'].pct_change(5)
    ma20_slope = common['ma20_slope']
    trend_struct = (zscore(common['dist_20']) + zscore(common['dist_60']) + zscore(ma20_slope)) / 3.0
    macro = (-zscore(df_vix['close']) + -zscore(df_uup['close'])) / 2.0
    momentum_week = zscore(df_mstr['close'].pct_change(20))
    wk52_structure = zscore(common['wk52_prox'])
    market_beta_week = zscore(qret_5)

    return {
        'btc_1w_regime': last(zscore(bret_5)),
        'trend_struct': last(trend_struct),
        'macro_risk': last(macro),
        'momentum_week': last(momentum_week),
        'wk52_structure': last(wk52_structure),
        'news_week': 0.0,
        'market_beta_week': last(market_beta_week)
    }


def monthly_terms(df_mstr: pd.DataFrame,
                  df_btc: pd.DataFrame,
                  df_qqq: pd.DataFrame,
                  df_vix: pd.DataFrame,
                  df_uup: pd.DataFrame,
                  common: Dict[str, pd.Series]) -> Dict[str, float]:
    bret_21 = df_btc['close'].pct_change(21)
    trend_long = (zscore(common['dist_60']) + zscore(common['ma200'].diff(5) / 5.0)) / 2.0
    macro = (-zscore(df_vix['close']) + -zscore(df_uup['close'])) / 2.0
    momentum_quarter = zscore(df_mstr['close'].pct_change(63))
    atr_pen_month = -zscore(common['atr_pct'].rolling(21).mean())
    market_beta_month = zscore(df_qqq['close'].pct_change(21))

    return {
        'btc_1m_regime': last(zscore(bret_21)),
        'trend_long': last(trend_long),
        'macro_risk': last(macro),
        'momentum_quarter': last(momentum_quarter),
        'atr_penalty_month': last(atr_pen_month),
        'news_month': 0.0,
        'market_beta_month': last(market_beta_month)
    }


def apply_weights(terms: Dict[str, float], weights: Dict[str, float]) -> Tuple[float, List[TermContribution]]:
    contribs: List[TermContribution] = []
    total_points = 0.0
    for k, w in weights.items():
        v = float(terms.get(k, 0.0))
        if not np.isfinite(v):
            v = 0.0
        pts = float(w) * v * 100.0
        if not np.isfinite(pts):
            pts = 0.0
        contribs.append(TermContribution(name=k, value=v, weight=float(w), points=pts))
        total_points += pts
    return total_points, contribs


def action_from_score(score: float, thresholds: Dict[str, float]) -> str:
    if score >= thresholds.get('buy_add', 30):
        return 'Buy/Add'
    if score >= thresholds.get('accumulate', 10):
        return 'Accumulate on dips'
    if score > thresholds.get('hold_low', -10):
        return 'Hold'
    if score >= thresholds.get('trim_reduce', -30):
        return 'Trim/Reduce'
    return 'Sell/Avoid'


def compute_trade_plan(close: float, ma20: float, atr: float, low_series: pd.Series) -> Dict[str, float]:
    entry_low = np.mean([close, ma20]) - 0.5 * atr
    entry_high = np.mean([close, ma20]) + 0.5 * atr
    swing_low = float(low_series.iloc[-10:].min()) if len(low_series) >= 10 else float(low_series.min())
    stop_by_swing = swing_low - 1.0 * atr
    stop_by_ma = ma20 - 1.5 * atr
    stop = min(stop_by_swing, stop_by_ma)
    entry = float(close)
    risk = max(entry - stop, 0.5 * atr)
    t2 = entry + 2.0 * risk
    t3 = entry + 3.0 * risk
    return {
        'entry_low': round(entry_low, 2),
        'entry_high': round(entry_high, 2),
        'stop': round(stop, 2),
        'target_2r': round(t2, 2),
        'target_3r': round(t3, 2)
    }


def replace_nonfinite(obj):
    if isinstance(obj, float):
        return obj if np.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: replace_nonfinite(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [replace_nonfinite(v) for v in obj]
    return obj


def main() -> None:
    weights = load_weights(os.path.join('configs', 'weights.json'))

    df_mstr = fetch_history('MSTR', period='2y')
    df_btc = fetch_history('BTC-USD', period='2y')
    df_qqq = fetch_history('QQQ', period='2y')
    df_vix = fetch_history('^VIX', period='2y')
    df_uup = fetch_history('UUP', period='2y')

    common = compute_common(df_mstr)

    daily = daily_terms(df_mstr, df_btc, df_qqq, df_vix, df_uup, common)
    weekly = weekly_terms(df_mstr, df_btc, df_qqq, df_vix, df_uup, common)
    monthly = monthly_terms(df_mstr, df_btc, df_qqq, df_vix, df_uup, common)

    daily_score, daily_contribs = apply_weights(daily, weights['horizons']['daily']['weights'])
    weekly_score, weekly_contribs = apply_weights(weekly, weights['horizons']['weekly']['weights'])
    monthly_score, monthly_contribs = apply_weights(monthly, weights['horizons']['monthly']['weights'])

    blend = weights['blend']
    blended_score = (
        blend['daily'] * daily_score +
        blend['weekly'] * weekly_score +
        blend['monthly'] * monthly_score
    )

    thresholds = weights['thresholds']
    action = action_from_score(blended_score, thresholds)

    latest_close = last(common['close'])
    latest_ma20 = last(common['ma20'])
    latest_atr = last(common['atr'])
    trade = compute_trade_plan(latest_close, latest_ma20, latest_atr, common['low'])

    # Volatility-scaled expected move predictions (interpretable):
    # expected_return_h = tanh(score/25) * atr_pct * sqrt(horizon_days)
    atr_pct_last = float(common['atr_pct'].iloc[-1]) if len(common['atr_pct']) else 0.0
    # Realized median absolute daily return for band calibration
    abs_ret = df_mstr['close'].pct_change().abs().dropna()
    med_abs_ret = float(abs_ret.median()) if len(abs_ret) else 0.0

    def predict_from_score(score_pts: float, horizon_days: int) -> Dict[str, float]:
        scale = np.sqrt(max(horizon_days, 1))
        tilt = np.tanh(score_pts / 25.0)
        exp_ret = float(tilt * atr_pct_last * scale)
        pred_close = float(latest_close * (1.0 + exp_ret))
        # Treat sigma prox as ATR%-scaled move
        sigma_price = float(latest_close * atr_pct_last * scale)
        # Normal quantiles for central intervals
        z50 = 0.674
        z80 = 1.282
        band50 = float(z50 * sigma_price)
        band80 = float(z80 * sigma_price)
        # Median move from realized median absolute return
        median_move_pct = float(med_abs_ret * scale)
        median_move_price = float(latest_close * median_move_pct)
        return {
            'expected_return': round(exp_ret, 4),
            'predicted_close': round(pred_close, 2),
            'sigma_price': round(sigma_price, 2),
            'band50': round(band50, 2),
            'band80': round(band80, 2),
            'median_move_pct': round(median_move_pct, 4),
            'median_move_price': round(median_move_price, 2)
        }

    # Build compact series for charting (last 180 trading days)
    last_n = 180
    idx = common['close'].index[-last_n:]
    def series_of(s: pd.Series) -> List[Dict[str, float]]:
        s2 = s.reindex(idx)
        out = []
        for ts, val in s2.items():
            if pd.isna(val):
                continue
            out.append({
                't': ts.strftime('%Y-%m-%d'),
                'v': float(val)
            })
        return out

    series = {
        'close': series_of(common['close']),
        'ma20': series_of(common['ma20']),
        'ma60': series_of(common['ma60'])
    }

    # Build inputs freshness meta
    now_utc = datetime.now(timezone.utc)
    def ts_of(df: pd.DataFrame) -> datetime:
        if df.index.size == 0:
            return now_utc
        ts = df.index[-1]
        if isinstance(ts, pd.Timestamp):
            if ts.tzinfo is None:
                ts = ts.tz_localize(timezone.utc)
            else:
                ts = ts.tz_convert(timezone.utc)
            return ts.to_pydatetime()
        return now_utc

    inputs_meta = {
        'MSTR': ts_of(df_mstr),
        'BTC-USD': ts_of(df_btc),
        'QQQ': ts_of(df_qqq),
        '^VIX': ts_of(df_vix),
        'UUP': ts_of(df_uup)
    }
    inputs = {}
    for k, ts in inputs_meta.items():
        age = (now_utc - ts).total_seconds()
        inputs[k] = {
            'asof': ts.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'age_sec': int(age)
        }

    CADENCE = {
        'daily': {'label': 'Daily', 'max_age_sec': 36*3600},
        'weekly': {'label': 'Weekly', 'max_age_sec': 8*24*3600},
        'monthly': {'label': 'Monthly', 'max_age_sec': 32*24*3600}
    }
    TERM_CADENCE = {
        # daily
        'btc_1d_beta': 'daily',
        'trend_short': 'daily',
        'momentum': 'daily',
        'mean_reversion': 'daily',
        'vix_risk': 'daily',
        'usd_risk': 'daily',
        'tech_beta': 'daily',
        'atr_penalty': 'daily',
        'news_short': 'daily',
        # weekly
        'btc_1w_regime': 'weekly',
        'trend_struct': 'weekly',
        'macro_risk': 'weekly',
        'momentum_week': 'weekly',
        'wk52_structure': 'weekly',
        'news_week': 'weekly',
        'market_beta_week': 'weekly',
        # monthly
        'btc_1m_regime': 'monthly',
        'trend_long': 'monthly',
        'momentum_quarter': 'monthly',
        'atr_penalty_month': 'monthly',
        'news_month': 'monthly',
        'market_beta_month': 'monthly',
        'macro_risk_month': 'monthly'
    }

    # Post-process term lists to add cadence and staleness
    def enrich_terms(contribs: List[TermContribution]) -> List[Dict[str, float]]:
        out: List[Dict[str, float]] = []
        for c in contribs:
            d = c.__dict__.copy()
            cad_key = TERM_CADENCE.get(c.name, 'daily')
            d['cadence'] = cad_key
            d['cadence_label'] = CADENCE[cad_key]['label']
            # Staleness by cadence window
            max_age = CADENCE[cad_key]['max_age_sec']
            # Use MSTR input age as baseline; if macro term, consider its input too
            ref_ages = [inputs['MSTR']['age_sec']]
            if 'btc' in c.name:
                ref_ages.append(inputs['BTC-USD']['age_sec'])
            if 'market_beta' in c.name or 'tech_beta' in c.name:
                ref_ages.append(inputs['QQQ']['age_sec'])
            if 'vix' in c.name or 'macro' in c.name:
                ref_ages.append(inputs['^VIX']['age_sec'])
            if 'usd' in c.name:
                ref_ages.append(inputs['UUP']['age_sec'])
            stale = max(ref_ages) > max_age
            d['stale'] = bool(stale)
            out.append(d)
        return out

    daily_terms_en = enrich_terms(daily_contribs)
    weekly_terms_en = enrich_terms(weekly_contribs)
    monthly_terms_en = enrich_terms(monthly_contribs)

    # Confidence metric 0..1
    # Base from volatility
    base = 1.0 - min(max(atr_pct_last / 0.10, 0.0), 1.0)  # 10% ATR% -> low confidence
    # Stale penalty across all terms
    all_terms = daily_terms_en + weekly_terms_en + monthly_terms_en
    stale_ratio = float(sum(1 for t in all_terms if t.get('stale'))) / float(max(len(all_terms), 1))
    stale_pen = 0.25 * stale_ratio
    # Horizon disagreement
    scores = np.array([daily_score, weekly_score, monthly_score], dtype=float)
    disagreement = float(np.std(scores) / 40.0)  # normalize by a broad 40pt scale
    disagreement = min(max(disagreement, 0.0), 1.0)
    conf = base - stale_pen - 0.25 * disagreement
    conf = float(min(max(conf, 0.0), 1.0))
    conf_label = 'High' if conf >= 0.66 else ('Medium' if conf >= 0.33 else 'Low')

    snapshot = {
        'asof': now_utc.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'levels': {
            'price': round(latest_close, 2),
            'ma20': round(latest_ma20, 2) if latest_ma20 else None,
            'atr': round(latest_atr, 2) if latest_atr else None
        },
        'series': series,
        'horizons': {
            'daily': {
                'score': round(daily_score, 2),
                'terms': daily_terms_en
            },
            'weekly': {
                'score': round(weekly_score, 2),
                'terms': weekly_terms_en
            },
            'monthly': {
                'score': round(monthly_score, 2),
                'terms': monthly_terms_en
            }
        },
        'predictions': {
            'daily': predict_from_score(daily_score, 1),
            'weekly': predict_from_score(weekly_score, 5),
            'monthly': predict_from_score(monthly_score, 21)
        },
        'blended': {
            'score': round(blended_score, 2),
            'action': action,
            'thresholds': thresholds,
            'weights': weights['blend']
        },
        'plan': trade,
        'meta': {
            'inputs': inputs,
            'cadence': CADENCE,
            'confidence': {
                'value': round(conf, 2),
                'label': conf_label,
                'reasons': {
                    'high_volatility': atr_pct_last >= 0.10,
                    'stale_terms_ratio': round(stale_ratio, 2),
                    'horizon_disagreement': round(disagreement, 2)
                }
            }
        }
    }

    # Compute version hash
    snapshot_clean = replace_nonfinite(snapshot)
    payload = json.dumps(snapshot_clean, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    try:
        import hashlib
        sha256 = hashlib.sha256(payload).hexdigest()
    except Exception:
        sha256 = None
    snapshot_clean['version'] = {
        'sha256': sha256,
        'git_sha': os.getenv('GITHUB_SHA'),
        'generated_at': snapshot_clean['asof']
    }

    # Write latest
    out_path = os.path.join('data', 'public', 'model_snapshot.json')
    ensure_dirs(out_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(snapshot_clean, f, ensure_ascii=False)
    print(f"Wrote {out_path}")

    # Append-only daily archive with timestamped filename
    day_dir = os.path.join('data', 'public', 'snapshots', now_utc.strftime('%Y-%m-%d'))
    ensure_dirs(os.path.join(day_dir, 'x'))  # ensure folder
    ts_name = now_utc.strftime('model_snapshot_%Y%m%d_%H%M%SZ.json')
    day_file = os.path.join(day_dir, ts_name)
    with open(day_file, 'w', encoding='utf-8') as f:
        json.dump(snapshot_clean, f, ensure_ascii=False)
    print(f"Archived {day_file}")


if __name__ == '__main__':
    main()


