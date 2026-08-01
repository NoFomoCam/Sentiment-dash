#!/usr/bin/env python3
"""
Backfill / update CBOE volatility indices into Supabase public.market_data.

CBOE publishes free, current daily history (no key/login) at cdn.cboe.com.
Handles the two vol indices Yahoo can't serve reliably:
  VIX3M -> our symbol VIX3M (OHLC, back to 2009)
  VSTN  -> our symbol VSTN  (close only, back to 2014) -- Cam's short-term-vol input
Upserts on (symbol, date). Leaves $ADD (NYSE A/D) to the TradingView export.

Auth: SUPABASE_SERVICE_ROLE_KEY if set in .env.local, else NEXT_PUBLIC_SUPABASE_ANON_KEY
(anon works only while a temporary write policy exists on market_data).

Usage:  python scripts/import_cboe.py
"""
import csv
import io
import json
import os
import datetime
import urllib.request
import urllib.error

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
BATCH = 1000
BASE = "https://cdn.cboe.com/api/global/us_indices/daily_prices"

# cboe index name -> our market_data symbol
INDICES = {"VIX3M": "VIX3M", "VSTN": "VSTN"}


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


def num(s):
    s = (s or "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def fetch_cboe(name):
    url = f"{BASE}/{name}_History.csv"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = r.read().decode("utf-8", "replace")
    reader = csv.reader(io.StringIO(text))
    header = [h.strip().upper() for h in next(reader)]
    has_ohlc = "OPEN" in header  # VIX3M has OHLC; VSTN is DATE,VSTN (close only)
    rows = []
    for parts in reader:
        if len(parts) < 2 or not parts[0].strip():
            continue
        try:
            d = datetime.datetime.strptime(parts[0].strip(), "%m/%d/%Y").strftime("%Y-%m-%d")
        except ValueError:
            continue
        if has_ohlc:
            o, h, l, c = (num(parts[header.index(k)]) for k in ("OPEN", "HIGH", "LOW", "CLOSE"))
        else:
            o = h = l = None
            c = num(parts[1])
        if c is None:
            continue
        rows.append({"date": d, "open": o, "high": h, "low": l, "close": c, "volume": None})
    return rows


def upsert(url, key, symbol, rows):
    endpoint = f"{url}/rest/v1/market_data?on_conflict=symbol,date"
    payload = [{"symbol": symbol, "source": "cboe", **r} for r in rows]
    total = 0
    for i in range(0, len(payload), BATCH):
        chunk = payload[i:i + BATCH]
        req = urllib.request.Request(endpoint, data=json.dumps(chunk).encode("utf-8"), method="POST")
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
    for name, symbol in INDICES.items():
        try:
            rows = fetch_cboe(name)
        except Exception as e:
            print(f"  {symbol:6s} FETCH FAILED ({name}): {str(e)[:80]}")
            continue
        if not rows:
            print(f"  {symbol:6s} no rows from {name}")
            continue
        n = upsert(url, key, symbol, rows)
        grand += n
        dates = [r["date"] for r in rows]
        print(f"  {symbol:6s} {n:5d} rows  {min(dates)} -> {max(dates)}   ({name})")

    print(f"\nDONE. Upserted {grand} rows from CBOE.")


if __name__ == "__main__":
    main()
