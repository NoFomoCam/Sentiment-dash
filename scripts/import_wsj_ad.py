#!/usr/bin/env python3
"""
Fetch the current-day NYSE advance/decline from WSJ's market-diary JSON and
upsert it as symbol 'ADD' into Supabase public.market_data.

This is the go-forward daily source for $ADD (NYSE breadth), the one indicator
with no free *historical* feed. WSJ gives the closing snapshot (current day only);
the ~2yr of history stays from the TradingView export. Value = NYSE Advancing -
Declining issues. Note: WSJ's methodology differs slightly from TradingView's
USI:ADD (a handful of issues), but stays within the same scoring bucket.

Caveats: current day only (no backfill); unofficial WSJ endpoint (may change);
run after the US market close.

Set DRY_RUN=1 to print the computed value without writing.
Auth: SUPABASE_SERVICE_ROLE_KEY if set in .env.local, else NEXT_PUBLIC_SUPABASE_ANON_KEY.

Usage:  DRY_RUN=1 python scripts/import_wsj_ad.py
"""
import json
import os
import datetime
import urllib.request

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
WSJ_URL = ("https://www.wsj.com/market-data/stocks/marketsdiary?id="
           "%7B%22application%22%3A%22WSJ%22%2C%22marketsDiaryType%22%3A%22overview%22%7D"
           "&type=mdc_marketsdiary")


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


def fetch_nyse_ad():
    req = urllib.request.Request(WSJ_URL, headers={"User-Agent": UA, "Accept": "application/json"})
    j = json.loads(urllib.request.urlopen(req, timeout=25).read().decode())
    data = j["data"]
    issues = data["instrumentSets"][0]["instruments"]
    by_name = {r["name"]: r for r in issues}
    adv = int(by_name["Advancing"]["NYSE"].replace(",", ""))
    dec = int(by_name["Declining"]["NYSE"].replace(",", ""))
    # timestamp like "4:15 PM EDT 7/31/26"
    date_tok = data["timestamp"].split()[-1]
    date = datetime.datetime.strptime(date_tok, "%m/%d/%y").strftime("%Y-%m-%d")
    return date, adv - dec, adv, dec


def upsert(url, key, date, value):
    endpoint = f"{url}/rest/v1/market_data?on_conflict=symbol,date"
    body = json.dumps([{"symbol": "ADD", "date": date, "close": value, "source": "wsj"}]).encode()
    req = urllib.request.Request(endpoint, data=body, method="POST")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates,return=minimal")
    urllib.request.urlopen(req, timeout=30).read()


def main():
    date, net, adv, dec = fetch_nyse_ad()
    print(f"WSJ NYSE {date}: advancing {adv}  declining {dec}  -> ADD net = {net}")
    if os.environ.get("DRY_RUN"):
        print("DRY_RUN: not writing.")
        return
    env = load_env(ENV_PATH)
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    upsert(url, key, date, net)
    print(f"Upserted ADD {date} = {net} (source=wsj).")


if __name__ == "__main__":
    main()
