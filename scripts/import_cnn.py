#!/usr/bin/env python3
"""
Fetch CNN Fear & Greed data and store the two non-price sentiment indicators
into Supabase public.market_data as their own daily series:
  FG  = Fear & Greed composite (0-100)   -> scoring key fear_greed
  PCR = raw Put/Call ratio (~0.4-1.5)    -> scoring key pcr   (from the F&G put/call component)

Free, unofficial CNN endpoint (needs a browser UA + cnn.com Referer). The dated
graphdata/{start} form serves back to CNN's floor of 2021-01-04 (~5.5yr); earlier
starts 500. Upserts on (symbol, date), source='cnn'. For pre-2021 history a vetted
community dataset would be needed.

Set DRY_RUN=1 to print without writing.
Usage:  python scripts/import_cnn.py
"""
import json
import os
import datetime
import urllib.request

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
CNN_FLOOR = "2021-01-01"  # earliest CNN serves; earlier start dates return 500
URL = f"https://production.dataviz.cnn.io/index/fearandgreed/graphdata/{CNN_FLOOR}"
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


def fetch():
    req = urllib.request.Request(URL, headers={
        "User-Agent": UA, "Referer": "https://www.cnn.com/", "Accept": "application/json"})
    j = json.loads(urllib.request.urlopen(req, timeout=25).read().decode())
    return j


def series(points):
    # dedupe by date, keep the last value for that date
    out = {}
    for p in points:
        d = datetime.datetime.fromtimestamp(p["x"] / 1000, datetime.UTC).strftime("%Y-%m-%d")
        out[d] = p["y"]
    return [{"date": d, "close": v} for d, v in sorted(out.items())]


def upsert(url, key, symbol, rows):
    endpoint = f"{url}/rest/v1/market_data?on_conflict=symbol,date"
    payload = [{"symbol": symbol, "source": "cnn", **r} for r in rows]
    total = 0
    for i in range(0, len(payload), BATCH):
        chunk = payload[i:i + BATCH]
        req = urllib.request.Request(endpoint, data=json.dumps(chunk).encode(), method="POST")
        req.add_header("apikey", key)
        req.add_header("Authorization", f"Bearer {key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Prefer", "resolution=merge-duplicates,return=minimal")
        urllib.request.urlopen(req, timeout=60).read()
        total += len(chunk)
    return total


def main():
    j = fetch()
    fg = series(j["fear_and_greed_historical"]["data"])
    pcr = series(j["put_call_options"]["data"])
    print(f"FG : {len(fg):4d} pts  {fg[0]['date']} -> {fg[-1]['date']}  (last {fg[-1]['close']:.1f})")
    print(f"PCR: {len(pcr):4d} pts  {pcr[0]['date']} -> {pcr[-1]['date']}  (last {pcr[-1]['close']:.3f})")
    if os.environ.get("DRY_RUN"):
        print("DRY_RUN: not writing.")
        return
    env = load_env(ENV_PATH)
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    n = upsert(url, key, "FG", fg) + upsert(url, key, "PCR", pcr)
    print(f"Upserted {n} rows (FG + PCR, source=cnn).")


if __name__ == "__main__":
    main()
