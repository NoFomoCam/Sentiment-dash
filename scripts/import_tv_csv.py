#!/usr/bin/env python3
"""
Import TradingView 'Export chart data' CSVs into Supabase public.market_data.

- Auto-detects the symbol from each filename (PROVIDER[_SUB]_TICKER, 1D.csv -> TICKER).
- Reads only the first 6 columns (time, open, high, low, close, volume); ignores any
  extra TV indicator columns that follow.
- Upserts on (symbol, date) so re-running with deeper history just adds older rows.

Auth: uses SUPABASE_SERVICE_ROLE_KEY if present in .env.local (bypasses RLS, preferred);
otherwise falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY, which only works while a
temporary write policy exists on market_data.

Usage:  python scripts/import_tv_csv.py "C:\\Desktop\\TV CSV senti"
"""
import csv
import json
import os
import re
import sys
import urllib.request
import urllib.error
from collections import defaultdict

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
BATCH = 1000


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


def symbol_from_filename(name):
    # "BATS_SPY, 1D (1).csv" -> "BATS_SPY" -> "SPY"
    stem = name.split(",")[0].strip()
    return stem.split("_")[-1].upper()


def parse_num(s):
    s = (s or "").strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_csv(path, symbol):
    rows = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)  # skip header
        for parts in reader:
            if len(parts) < 5:
                continue
            t = parts[0].strip()
            if not DATE_RE.match(t):
                continue
            o, h, l, c = (parse_num(parts[i]) for i in (1, 2, 3, 4))
            if None in (o, h, l, c):
                continue
            vol = parse_num(parts[5]) if len(parts) > 5 else None
            rows.append({
                "symbol": symbol, "date": t,
                "open": o, "high": h, "low": l, "close": c,
                "volume": vol, "source": "tradingview",
            })
    return rows


def upsert(url, key, rows):
    endpoint = f"{url}/rest/v1/market_data?on_conflict=symbol,date"
    total = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        body = json.dumps(chunk).encode("utf-8")
        req = urllib.request.Request(endpoint, data=body, method="POST")
        req.add_header("apikey", key)
        req.add_header("Authorization", f"Bearer {key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Prefer", "resolution=merge-duplicates,return=minimal")
        try:
            with urllib.request.urlopen(req) as resp:
                resp.read()
                total += len(chunk)
        except urllib.error.HTTPError as e:
            print(f"  ! HTTP {e.code} on batch {i}: {e.read().decode()[:300]}")
            raise
    return total


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "."
    env = load_env(ENV_PATH)
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    mode = "service_role" if env.get("SUPABASE_SERVICE_ROLE_KEY") else "anon (needs temp policy)"
    print(f"Target: {url}  |  auth: {mode}\n")

    files = [f for f in os.listdir(folder) if f.lower().endswith(".csv")]
    grand = 0
    summary = []
    for name in sorted(files):
        symbol = symbol_from_filename(name)
        rows = parse_csv(os.path.join(folder, name), symbol)
        if not rows:
            print(f"  (skip) {name}: no valid rows")
            continue
        dates = [r["date"] for r in rows]
        n = upsert(url, key, rows)
        grand += n
        summary.append((symbol, n, min(dates), max(dates)))
        print(f"  {symbol:6s} {n:5d} rows  {min(dates)} -> {max(dates)}   [{name}]")

    print(f"\nDONE. Upserted {grand} rows across {len(summary)} symbols.")


if __name__ == "__main__":
    main()
