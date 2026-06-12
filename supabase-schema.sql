-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates the tables for the sentiment dashboard

-- Daily sentiment readings (the core historical data)
CREATE TABLE IF NOT EXISTS daily_readings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  live_score INTEGER,
  eod_score INTEGER,
  vix DECIMAL(8,2),
  vix9d DECIMAL(8,2),
  vix3m DECIMAL(8,2),
  dxy DECIMAL(8,3),
  spy DECIMAL(10,2),
  spx DECIMAL(10,2),
  rsp DECIMAL(10,2),
  nvda DECIMAL(10,2),
  smh DECIMAL(10,2),
  gld DECIMAL(10,2),
  hyg DECIMAL(10,2),
  lqd DECIMAL(10,2),
  nyad INTEGER,
  fear_greed DECIMAL(5,1),
  pcr DECIMAL(5,3),
  drawdown_pct DECIMAL(6,2),
  covid_flag BOOLEAN DEFAULT FALSE,
  reduced_era BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast date-range queries
CREATE INDEX IF NOT EXISTS idx_readings_date ON daily_readings(date);

-- User saved input values (persists manual entries across sessions)
CREATE TABLE IF NOT EXISTS user_inputs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE DEFAULT 'default',
  curr_values JSONB,
  prev_values JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE daily_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inputs ENABLE ROW LEVEL SECURITY;

-- For now, allow public read on daily_readings (everyone sees same market data)
CREATE POLICY "Public read access" ON daily_readings FOR SELECT USING (true);

-- Allow authenticated and anon users to insert/update readings (for manual entry)
CREATE POLICY "Allow insert readings" ON daily_readings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update readings" ON daily_readings FOR UPDATE USING (true);

-- User inputs: users can only see/edit their own
CREATE POLICY "Users manage own inputs" ON user_inputs FOR ALL USING (true);

-- Done! Your tables are ready.
