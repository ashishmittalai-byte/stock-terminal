// pages/api/analyse.js
// ──────────────────────────────────────────────────────────────
// Stock Analysis API — Gemini + Google Search grounding
// ──────────────────────────────────────────────────────────────

// Extend Vercel serverless timeout (Pro=60s, Hobby=10s)
export const config = { maxDuration: 60 };

const API_KEY = process.env.GEMINI_API_KEY;
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

// ─── Compressed prompt — schema-only, no example values ───
// This is ~60% smaller than listing example values, so Gemini responds faster.
const SYSTEM_PROMPT = `You are an expert Indian equity analyst. When given a stock name/ticker, use Google Search to find REAL-TIME data and return a single raw JSON object (NO markdown, NO backticks, NO text outside the JSON).

Return this exact JSON structure with REAL data from search:

{
  "stockName": string, "ticker": string, "exchange": "NSE"/"BSE",
  "currentPrice": number, "change": number, "changePercent": number,
  "open": number, "dayHigh": number, "dayLow": number, "previousClose": number,
  "volume": number, "avgVolume": number, "weekHigh52": number, "weekLow52": number, "marketCap": string,

  "movingAverages": [
    // 12 items: SMA 5,10,20,50,100,200 and EMA 9,12,21,50,100,200
    // Each: {"name": "SMA 20", "value": number, "signal": "Buy"/"Sell"/"Neutral"}
    // signal = "Buy" if price > MA, "Sell" if price < MA
  ],
  "maSummary": string, // e.g. "10 Buy, 2 Sell. Golden Cross active (50 SMA > 200 SMA)."

  "momentumIndicators": [
    // RSI(14), Stochastic %K(14,3,3), Stochastic RSI, Williams %R(14), CCI(20), ROC(12), MFI(14), Ultimate Oscillator, Momentum(10)
    // Each: {"name": string, "value": number, "signal": "Bullish"/"Bearish"/"Neutral"/"Overbought"/"Oversold"}
  ],

  "trendIndicators": [
    // MACD(12,26,9), MACD Signal, MACD Histogram, ADX(14), +DI, -DI, Parabolic SAR, Supertrend(10,3), Aroon Up, Aroon Down, Ichimoku Base, Ichimoku Conv, VWAP
    // Each: {"name": string, "value": number/string, "signal": string}
  ],

  "volatilityIndicators": [
    // Bollinger Upper(20,2), Bollinger Middle, Bollinger Lower, Bollinger %B, Bollinger Bandwidth, ATR(14), Keltner Upper, Keltner Lower, Historical Volatility, Std Dev(20)
    // Each: {"name": string, "value": number/string, "signal": string}
  ],

  "volumeIndicators": [
    // Volume, Volume Ratio, OBV, Chaikin Money Flow, A/D Line, Volume SMA 20
    // Each: {"name": string, "value": number/string, "signal": string}
  ],

  "chartPattern": {
    "pattern": string, // current dominant pattern on daily chart e.g. "Ascending Triangle"
    "timeframe": "Daily",
    "status": "In Progress"/"Completed"/"Failed",
    "completionPercent": number,
    "breakoutLevel": number,
    "targetPrice": number,
    "stopLoss": number,
    "implication": "Bullish"/"Bearish"/"Neutral",
    "description": string, // 2-3 sentences describing the pattern and key levels
    "additionalPatterns": [string] // other active patterns/confluences
  },

  "supportResistance": {
    "support1": number, "support2": number, "support3": number,
    "resistance1": number, "resistance2": number, "resistance3": number,
    "pivotPoint": number,
    "fibRetracement38": number, "fibRetracement50": number, "fibRetracement62": number
  },

  "technicalIndicators": [
    // 52-Week Range Position, Distance from 52W High/Low, Price vs SMA 200, Beta, Delivery %
    // Each: {"name": string, "value": string/number, "signal": string}
  ],

  "candlestickPatterns": [
    // 2-3 recent patterns on daily chart
    // Each: {"name": string, "signal": "Bullish"/"Bearish", "reliability": "High"/"Medium"/"Low"}
  ],

  "fundamentals": {
    // Include ALL: P/E(TTM), P/E(Fwd), P/B, EPS(TTM), PEG, ROE, ROCE, ROA, D/E, Current Ratio,
    // Operating Margin, Net Margin, Revenue Growth(YoY), Profit Growth(YoY), FCF Yield,
    // Dividend Yield, Book Value, Face Value, EV/EBITDA, Price/Sales
  },

  "shareholding": { "promoter": number, "fii": number, "dii": number, "public": number },

  "smartMoney": [string], // 3+ items: bulk deals, FII/DII activity, promoter pledging
  "news": [{"headline": string, "source": string, "date": string}], // 3-5 recent headlines
  "risks": [string], // 3 key risks
  "catalysts": [string], // 3 key catalysts
  "strategies": [{"name": string, "description": string}], // Swing, Positional, Long Term with levels
  "researchLinks": [{"title": string, "url": string}], // Screener, Trendlyne, Tickertape, TradingView

  "technicalScore": number, // 0-100
  "fundamentalScore": number, // 0-100
  "compositeScore": number, // tech*0.45 + fund*0.55
  "verdict": "Strong Buy"/"Buy"/"Hold"/"Sell"/"Strong Sell",
  "overallSummary": string // 2-3 sentence summary
}

RULES:
1. Use Google Search for REAL LIVE data. Never fabricate prices.
2. Return ONLY raw JSON. No markdown fences. No text outside JSON.
3. Numbers must be numbers, not strings (except % values and marketCap).
4. Signal for MAs: "Buy" if price>MA, "Sell" if price<MA, "Neutral" if within 0.5%.
5. maSummary: count Buy/Sell/Neutral, mention crossovers.
6. chartPattern: identify the CURRENT dominant daily chart pattern with actionable levels.
7. Fill ALL fields. If unavailable, use best estimate.`;

// ─── Extract JSON from messy Gemini text ───
function extractJSON(text) {
  if (!text) return null;
  let s = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Direct parse
  try { return JSON.parse(s); } catch {}
  // Extract { ... }
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) {
    try { return JSON.parse(s.substring(i, j + 1)); } catch {}
    // Fix trailing commas
    try {
      return JSON.parse(s.substring(i, j + 1).replace(/,\s*([}\]])/g, '$1'));
    } catch {}
  }
  return null;
}

// ─── Fetch with timeout ───
async function fetchWithTimeout(url, opts, ms = 55000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Call Gemini ───
async function callGemini(model, stock) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: `Analyse this Indian stock with all technical indicators and current chart pattern: ${stock}` }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 8192 },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`${model} → ${res.status}: ${err.substring(0, 150)}`);
  }

  const data = await res.json();
  const cand = data.candidates?.[0];
  if (!cand) throw new Error('No candidates');
  if (cand.finishReason === 'SAFETY') throw new Error('Blocked by safety filter');

  const text = (cand.content?.parts || []).filter(p => p.text).map(p => p.text).join('\n');
  if (!text || text.trim() === '```' || text.trim().length < 20)
    throw new Error('Empty/invalid response');

  return text;
}

// ─── Handler ───
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  const { stock } = req.body || {};
  if (!stock?.trim()) return res.status(400).json({ error: 'Please provide a stock name' });

  let lastErr = null;
  for (const model of MODELS) {
    try {
      const text = await callGemini(model, stock.trim());
      const json = extractJSON(text);
      if (json) return res.status(200).json(json);
      // Fallback: wrap raw text
      return res.status(200).json({ stockName: stock.trim(), rawAnalysis: text, verdict: 'Hold' });
    } catch (e) {
      console.error(`[analyse] ${model}:`, e.message);
      lastErr = e;
    }
  }

  return res.status(502).json({
    error: `Analysis failed. ${lastErr?.message?.includes('aborted') ? 'Request timed out — try again.' : lastErr?.message || 'Unknown error'}`,
  });
}
