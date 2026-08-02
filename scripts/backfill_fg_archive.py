#!/usr/bin/env python3
"""
One-time deep backfill of CNN Fear & Greed history PRE-2021 from the community
archive whit3rabbit/fear-greed-data (a historical copy of CNN's F&G dataset).

Vetted: the archive matches our live-CNN values exactly in the 2021+ overlap
(e.g. 2021-06-01 = 35.4, 2021-12-31 = 62.5428571... to 13 decimals), confirming
it is genuine CNN data. We import only dates < 2021-01-04 (CNN's live floor) so
our authoritative CNN rows are never overwritten. Stored as FG, source='cnn-archive'.

Only Fear & Greed — the archive has no put/call series.

Set DRY_RUN=1 to preview.
Usage:  python scripts/backfill_fg_archive.py
"""
import csv
import io
import json
import os
import urllib.request

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
CSV_URL = "https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed.csv"
CNN_FLOOR = "2021-01-04"  # our live-CNN data owns this date onward
BATCH = 1000


def load_env(path):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def fetch():
    req = urllib.request.Request(CSV_URL, headers={"User-Agent": UA})
    txt = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    rows = []
    for r in csv.reader(io.StringIO(txt)):
        if not r or not r[0][:2] == "20":
            continue
        date = r[0][:10]
        if date >= CNN_FLOOR:
            continue  # leave 2021+ to authoritative live CNN
        try:
            val = float(r[1])
        except (ValueError, IndexError):
            continue
        rows.append({"date": date, "close": val})
    return rows


def upsert(url, key, rows):
    endpoint = f"{url}/rest/v1/market_data?on_conflict=symbol,date"
    payload = [{"symbol": "FG", "source": "cnn-archive", **r} for r in rows]
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
    rows = fetch()
    if not rows:
        print("no pre-2021 rows")
        return
    dates = [r["date"] for r in rows]
    print(f"FG archive (pre-{CNN_FLOOR}): {len(rows)} rows  {min(dates)} -> {max(dates)}")
    if os.environ.get("DRY_RUN"):
        print("DRY_RUN: not writing.")
        return
    env = load_env(ENV_PATH)
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    print(f"Upserted {upsert(url, key, rows)} rows (FG, source=cnn-archive).")


if __name__ == "__main__":
    main()
