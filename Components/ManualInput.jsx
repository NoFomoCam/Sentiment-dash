'use client';

import { useState, useEffect } from 'react';
import { saveInputValues, loadInputValues } from '../lib/supabase';

const FIELDS = [
  { key: 'vix', label: 'VIX (30-day)', placeholder: '21.50' },
  { key: 'vix9d', label: 'VIX9D / VXST', placeholder: '20.80', tip: 'TradingView: CBOE:VXST' },
  { key: 'vix3m', label: 'VIX3M', placeholder: '18.20', tip: 'TradingView: CBOE:VIX3M' },
  { key: 'dxy', label: 'DXY', placeholder: '100.07' },
  { key: 'spy', label: 'SPY', placeholder: '735.00' },
  { key: 'spx', label: 'SPX (S&P 500)', placeholder: '7355.00' },
  { key: 'nyad', label: 'NYSE A/D', placeholder: '-200', tip: 'TradingView: $NYAD daily diff' },
  { key: 'fear_greed', label: 'Fear & Greed (0-100)', placeholder: '44' },
  { key: 'pcr', label: 'Put/Call Ratio', placeholder: '0.85' },
  { key: 'nvda', label: 'NVDA', placeholder: '208.00' },
  { key: 'smh', label: 'SMH', placeholder: '591.00' },
  { key: 'rsp', label: 'RSP }
