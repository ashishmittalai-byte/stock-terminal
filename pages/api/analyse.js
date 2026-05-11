// pages/api/analyse.js
// ─────────────────────────────────────────────────────────────
// SIMPLE & FAST: No search grounding (that was causing timeouts).
// Single Gemini call, 3-5 seconds, fits easily in 10s limit.
// ─────────────────────────────────────────────────────────────

const API_KEY = process.env.GEMINI_API_KEY;

const PROMPT = `You are an expert Indian equity analyst. Analyse the given stock and return ONLY a raw JSON object. No markdown, no backticks, no text before or after the JSON.

Return this JSON with real data:
{
  "stockName":string,"ticker":string,"exchange":"NSE",
  "currentPrice":number,"change":number,"changePercent":number,
  "open":number,"dayHigh":number,"dayLow":number,"previousClose":number,
  "volume":number,"weekHigh52":number,"weekLow52":number,"marketCap":string,
  "movingAverages":[{"name":"SMA 5/10/20/50/100/200 + EMA 9/12/21/50/100/200","value":number,"signal":"Buy/Sell/Neutral"}],
  "maSummary":"X Buy, Y Sell. Golden/Death Cross status.",
  "momentumIndicators":[{"name":"RSI/Stochastic/StochRSI/Williams%R/CCI/ROC/MFI/UltOsc/Momentum","value":number,"signal":string}],
  "trendIndicators":[{"name":"MACD/Signal/Histogram/ADX/+DI/-DI/SAR/Supertrend/Aroon/Ichimoku/VWAP","value":number,"signal":string}],
  "volatilityIndicators":[{"name":"Bollinger(Upper/Mid/Lower/%B/BW)/ATR/Keltner/HistVol/StdDev","value":number,"signal":string}],
  "volumeIndicators":[{"name":"Volume/VolumeRatio/OBV/ChaikinMF/ADLine/VolSMA20","value":string,"signal":string}],
  "chartPattern":{"pattern":string,"timeframe":"Daily","completionPercent":number,"breakoutLevel":number,"targetPrice":number,"stopLoss":number,"implication":"Bullish/Bearish/Neutral","description":string,"additionalPatterns":[string]},
  "supportResistance":{"support1":n,"support2":n,"support3":n,"resistance1":n,"resistance2":n,"resistance3":n,"pivotPoint":n,"fibRetracement38":n,"fibRetracement50":n,"fibRetracement62":n},
  "technicalIndicators":[{"name":"52W Range%/Dist52WHigh/Dist52WLow/PriceVsSMA200/Beta/Delivery%","value":string,"signal":string}],
  "candlestickPatterns":[{"name":string,"signal":"Bullish/Bearish","reliability":"High/Medium/Low"}],
  "fundamentals":{"P/E(TTM)":n,"P/E(Fwd)":n,"P/B":n,"EPS":n,"PEG":n,"ROE":s,"ROCE":s,"ROA":s,"D/E":n,"Current Ratio":n,"Operating Margin":s,"Net Margin":s,"Revenue Growth(YoY)":s,"Profit Growth(YoY)":s,"FCF Yield":s,"Dividend Yield":s,"Book Value":n,"EV/EBITDA":n,"Price/Sales":n},
  "shareholding":{"promoter":number,"fii":number,"dii":number,"public":number},
  "smartMoney":[string],"news":[{"headline":string,"source":string,"date":string}],
  "risks":[string],"catalysts":[string],
  "strategies":[{"name":string,"description":string}],
  "researchLinks":[{"title":string,"url":string}],
  "technicalScore":0-100,"fundamentalScore":0-100,"compositeScore":0-100,
  "verdict":"Strong Buy/Buy/Hold/Sell/Strong Sell",
  "overallSummary":string
}
RULES: Return 12 MAs, 9 momentum, 13 trend, 10 volatility, 6 volume indicators. Identify current daily chart pattern. Numbers must be JSON numbers. Fill every field.`;

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

async function callGemini(model, stock) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const isGemma = model.startsWith('gemma');

  // Gemma models may not support system_instruction — merge into user message
  const body = {
    contents: [{
      role: 'user',
      parts: [{
        text: isGemma
          ? `${PROMPT}\n\nNow analyse this Indian stock: ${stock}`
          : `Analyse Indian stock: ${stock}`
      }],
    }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
  };

  // Only add system_instruction for Gemini models
  if (!isGemma) {
    body.system_instruction = { parts: [{ text: PROMPT }] };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const e = await res.text().catch(() => '');
      if (res.status === 429) {
        throw new Error(`RATE_LIMIT:${model}`);
      }
      throw new Error(`${model}: HTTP ${res.status} - ${e.substring(0, 200)}`);
    }

    const data = await res.json();
    const cand = data.candidates?.[0];
    if (!cand?.content?.parts) throw new Error(`${model}: No content in response`);

    const text = cand.content.parts.filter(p => p.text).map(p => p.text).join('\n');
    if (!text || text.trim().length < 20) throw new Error(`${model}: Empty response`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured in Vercel environment variables' });

  const { stock } = req.body || {};
  if (!stock?.trim()) return res.status(400).json({ error: 'Stock name required' });

  // Billing enabled → Gemini 2.5 Flash now has 1,500 RPD (plenty)
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  const errors = [];
  let rateLimited = false;

  for (const model of models) {
    try {
      console.log(`[analyse] Calling ${model} for "${stock.trim()}"...`);
      const text = await callGemini(model, stock.trim());
      const json = extractJSON(text);

      if (json) {
        console.log(`[analyse] Success with ${model}`);
        return res.status(200).json(json);
      }

      // Got text but couldn't parse JSON — return raw
      console.warn(`[analyse] ${model} returned non-JSON text`);
      return res.status(200).json({ stockName: stock.trim(), rawAnalysis: text, verdict: 'Hold' });

    } catch (err) {
      if (err.message?.startsWith('RATE_LIMIT:')) {
        rateLimited = true;
        errors.push(`${err.message.split(':')[1]}: rate limit exceeded (429)`);
      } else {
        const msg = err.name === 'AbortError' ? `${model}: timed out (9s)` : `${model}: ${err.message}`;
        errors.push(msg);
      }
      console.error(`[analyse]`, errors[errors.length - 1]);
    }
  }

  // Show helpful error with details for EVERY model
  const errorMsg = rateLimited
    ? 'All models rate-limited. Set up billing at aistudio.google.com for 1,500 req/day free.'
    : 'All models failed.';

  return res.status(rateLimited ? 429 : 502).json({
    error: `${errorMsg} Per-model errors: ${errors.join(' | ')}`,
    details: errors,
  });
}
