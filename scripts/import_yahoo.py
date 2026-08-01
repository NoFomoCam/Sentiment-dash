#!/usr/bin/env python3
"""
Backfill / update daily OHLCV from Yahoo Finance into Supabase public.market_data.

Free, no API key. Uses the v8 chart endpoint with period1=0 (true daily; range=max
silently downsamples to monthly). Upserts on (symbol, date) so it both deep-backfills
history and keeps symbols current on repeat runs.

Covers the 10 symbols Yahoo serves cleanly. NOT here (Yahoo can't serve them reliably):
  $ADD (no A/D line), VSTN (not on Yahoo), VIX3M (Yahoo feed frozen 2026-07-17).
  Those stay on the TradingView export (scripts/import_tv_csv.py).

Auth: SUPABASE_SERVICE_ROLE_KEY if set in .env.local, else NEXT_PUBLIC_SUPABASE_ANON_KEY
(anon works only while a temporary write policy exists on market_data).

Usage:  python scripts/import_yahoo.py
"""
import json
import os
import time
import datetime
import urllib.request
import urllib.parse
import urllib.error

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
BATCH = 1000

# our market_data symbol -> Yahoo ticker
YAHOO = {
    "VIX": "^VIX", "DXY": "DX-Y.NYB", "SPX": "^GSPC", "SPY": "SPY",
    "RSP": "RSP", "NVDA": "NVDA", "SMH": "SMH", "GLD": "GLD",
    "HYG": "HYG", "LQD": "LQD",
}


def load_env(path):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def fetch_yahoo(ticker):
    tk = urllib.parse.quote(ticker, safe="-.")
    now = int(time.time())
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{tk}?period1=0&period2={now}&interval=1d"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.load(r)
    res = j["chart"]["result"][0]
    ts = res.get("timestamp", []) or []
    q = res["indicators"]["quote"][0]
    o, h, l, c = (q.get(k, []) or [] for k in ("open", "high", "low", "close"))
    v = q.get("volume", []) or []
    rows = []
    for i, t in enumerate(ts):
        cl = c[i] if i < len(c) else None
        if cl is None:
            continue
        rows.append({
            "date": datetime.datetime.fromtimestamp(t, datetime.UTC).strftime("%Y-%m-%d"),
            "open": o[i] if i < len(o) else None,
            "high": h[i] if i < len(h) else None,
            "low": l[i] if i < len(l) else None,
            "close": cl,
            "volume": (v[i] if i < len(v) and v[i] else None),
        })
    return rows


def upsert(url, key, symbol, rows):
    endpoint = f"{url}/rest/v1/market_data?on_conflict=symbol,date"
    payload = [{"symbol": symbol, "source": "yahoo", **r} for r in rows]
    total = 0
    for i in range(0, len(payload), BATCH):
        chunk = payload[i:i + BATCH]
        body = json.dumps(chunk).encode("utf-8")
        req = urllib.request.Request(endpoint, data=body, method="POST")
        req.add_header("apikey", key)
        req.add_header("Authorization", f"Bearer {key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Prefer", "resolution=merge-duplicates,return=minimal")
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                resp.read()
                total += len(chunk)
        except urllib.error.HTTPError as e:
            print(f"  ! HTTP {e.code} on {symbol} batch {i}: {e.read().decode()[:300]}")
            raise
    return total


def main():
    env = load_env(ENV_PATH)
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    mode = "service_role" if env.get("SUPABASE_SERVICE_ROLE_KEY") else "anon (needs temp policy)"
    print(f"Target: {url}  |  auth: {mode}\n")

    grand = 0
    for symbol, ticker in YAHOO.items():
        try:
            rows = fetch_yahoo(ticker)
        except Exception as e:
            print(f"  {symbol:5s} FETCH FAILED ({ticker}): {str(e)[:80]}")
            continue
        if not rows:
            print(f"  {symbol:5s} no rows from {ticker}")
            continue
        n = upsert(url, key, symbol, rows)
        grand += n
        dates = [r["date"] for r in rows]
        print(f"  {symbol:5s} {n:6d} rows  {min(dates)} -> {max(dates)}   ({ticker})")

    print(f"\nDONE. Upserted {grand} rows from Yahoo across {len(YAHOO)} symbols.")


if __name__ == "__main__":
    main()
