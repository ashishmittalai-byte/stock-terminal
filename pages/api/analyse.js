// pages/api/analyse.js
// ─────────────────────────────────────────────────────────────
// Strategy: Try WITH Google Search grounding (7s timeout).
// If it times out → retry WITHOUT grounding (fast, 3-5s).
// Both paths fit within Vercel Hobby's 10-second limit.
// ─────────────────────────────────────────────────────────────

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';

const PROMPT = `You are an expert Indian equity analyst. Analyse the given stock and return ONLY a raw JSON object (no markdown, no backticks, no text outside the JSON).

JSON structure (fill ALL fields with real data):
{
  "stockName":string,"ticker":string,"exchange":"NSE",
  "currentPrice":number,"change":number,"changePercent":number,
  "open":number,"dayHigh":number,"dayLow":number,"previousClose":number,
  "volume":number,"weekHigh52":number,"weekLow52":number,"marketCap":string,

  "movingAverages":[
    // 12 entries: SMA 5,10,20,50,100,200 + EMA 9,12,21,50,100,200
    // Each: {"name":string,"value":number,"signal":"Buy"/"Sell"/"Neutral"}
  ],
  "maSummary":"X Buy, Y Sell. Golden/Death Cross status.",

  "momentumIndicators":[
    // RSI(14), Stochastic %K, Stochastic RSI, Williams %R, CCI(20), ROC(12), MFI(14), Ultimate Oscillator, Momentum(10)
    // Each: {"name":string,"value":number,"signal":string}
  ],

  "trendIndicators":[
    // MACD(12,26,9), MACD Signal, MACD Histogram, ADX(14), +DI, -DI, Parabolic SAR, Supertrend(10,3), Aroon Up/Down, Ichimoku Base/Conv, VWAP
    // Each: {"name":string,"value":number,"signal":string}
  ],

  "volatilityIndicators":[
    // Bollinger Upper/Mid/Lower/%B/Bandwidth, ATR(14), Keltner Upper/Lower, Historical Volatility, Std Dev(20)
    // Each: {"name":string,"value":number,"signal":string}
  ],

  "volumeIndicators":[
    // Volume, Volume Ratio, OBV, Chaikin MF, A/D Line, Vol SMA 20
    // Each: {"name":string,"value":string,"signal":string}
  ],

  "chartPattern":{
    "pattern":string,"timeframe":"Daily","completionPercent":number,
    "breakoutLevel":number,"targetPrice":number,"stopLoss":number,
    "implication":"Bullish"/"Bearish"/"Neutral",
    "description":"2-3 sentences about the pattern",
    "additionalPatterns":[string]
  },

  "supportResistance":{
    "support1":number,"support2":number,"support3":number,
    "resistance1":number,"resistance2":number,"resistance3":number,
    "pivotPoint":number,"fibRetracement38":number,"fibRetracement50":number,"fibRetracement62":number
  },

  "technicalIndicators":[
    // 52W Range %, Dist from 52W High/Low, Price vs SMA200, Beta, Delivery%
    // Each: {"name":string,"value":string,"signal":string}
  ],

  "candlestickPatterns":[{"name":string,"signal":"Bullish"/"Bearish","reliability":"High"/"Medium"/"Low"}],

  "fundamentals":{
    "P/E(TTM)":n,"P/E(Fwd)":n,"P/B":n,"EPS":n,"PEG":n,"ROE":"%","ROCE":"%","ROA":"%",
    "D/E":n,"Current Ratio":n,"Operating Margin":"%","Net Margin":"%",
    "Revenue Growth(YoY)":"%","Profit Growth(YoY)":"%","FCF Yield":"%",
    "Dividend Yield":"%","Book Value":n,"EV/EBITDA":n,"Price/Sales":n
  },

  "shareholding":{"promoter":number,"fii":number,"dii":number,"public":number},
  "smartMoney":[string],
  "news":[{"headline":string,"source":string,"date":string}],
  "risks":[string],"catalysts":[string],
  "strategies":[{"name":string,"description":string}],
  "researchLinks":[{"title":string,"url":string}],
  "technicalScore":0-100,"fundamentalScore":0-100,"compositeScore":0-100,
  "verdict":"Strong Buy"/"Buy"/"Hold"/"Sell"/"Strong Sell",
  "overallSummary":string
}

RULES:
- Return 12 MAs, 9 momentum, 13 trend, 10 volatility, 6 volume indicators.
- MA signal: Buy if price>MA, Sell if price<MA, Neutral if ~equal.
- Identify the CURRENT dominant chart pattern on daily timeframe.
- All numbers must be JSON numbers, not strings (except % and marketCap).
- Fill EVERY field. Use best available data.`;

// ─── JSON extractor ───
function extractJSON(text) {
  if (!text) return null;
  const s = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(s); } catch {}
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) {
    try { return JSON.parse(s.substring(i, j + 1)); } catch {}
    try { return JSON.parse(s.substring(i, j + 1).replace(/,\s*([}\]])/g, '$1')); } catch {}
  }
  return null;
}

// ─── Call Gemini with optional grounding ───
async function callGemini(model, stock, useGrounding, timeoutMs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: `Full technical + fundamental analysis with current chart pattern: ${stock}` }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
  };

  // Only add google_search tool if grounding is enabled
  if (useGrounding) {
    body.tools = [{ google_search: {} }];
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const e = await res.text().catch(() => '');
      throw new Error(`${model} ${res.status}: ${e.substring(0, 100)}`);
    }

    const data = await res.json();
    const cand = data.candidates?.[0];
    if (!cand) throw new Error('No candidates in response');
    if (cand.finishReason === 'SAFETY') throw new Error('Blocked by safety filter');

    const text = (cand.content?.parts || []).filter(p => p.text).map(p => p.text).join('\n');
    if (!text || text.trim().length < 30) throw new Error('Empty response from model');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ─── API Handler ───
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable not set' });
  }

  const { stock } = req.body || {};
  if (!stock?.trim()) {
    return res.status(400).json({ error: 'Please provide a stock name' });
  }

  const query = stock.trim();
  const attempts = [
    // Attempt 1: Primary model WITH search grounding, 7s timeout
    { model: MODEL, grounding: true, timeout: 7000, label: 'grounded' },
    // Attempt 2: Primary model WITHOUT grounding, 8s timeout (fast)
    { model: MODEL, grounding: false, timeout: 8000, label: 'direct' },
    // Attempt 3: Fallback model WITHOUT grounding, 8s timeout
    { model: FALLBACK_MODEL, grounding: false, timeout: 8000, label: 'fallback' },
  ];

  for (const { model, grounding, timeout, label } of attempts) {
    try {
      console.log(`[analyse] ${label}: ${model} grounding=${grounding} timeout=${timeout}ms → "${query}"`);
      const text = await callGemini(model, query, grounding, timeout);
      const json = extractJSON(text);

      if (json) {
        // Tag whether live-grounded or model knowledge
        json._source = grounding ? 'live' : 'model';
        return res.status(200).json(json);
      }

      // JSON parse failed but we got text — return raw
      return res.status(200).json({
        stockName: query,
        rawAnalysis: text,
        verdict: 'Hold',
        _source: label,
      });
    } catch (e) {
      const isTimeout = e.name === 'AbortError';
      console.warn(`[analyse] ${label} failed: ${isTimeout ? 'TIMEOUT' : e.message}`);
      // Continue to next attempt
    }
  }

  return res.status(502).json({
    error: 'Analysis failed after all attempts. Please try again in a moment.',
  });
}
