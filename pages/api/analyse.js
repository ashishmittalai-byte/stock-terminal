// pages/api/analyse.js
// ──────────────────────────────────────────────────────────
// Edge Runtime = 30s timeout on Vercel Hobby (vs 10s serverless)
// ──────────────────────────────────────────────────────────

export const config = { runtime: 'edge' };

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

const PROMPT = `You are an expert Indian equity analyst. Given a stock name, use Google Search to get REAL-TIME live data. Return ONLY a raw JSON object — no markdown, no backticks, no text outside JSON.

JSON structure:
{
  "stockName":string,"ticker":string,"exchange":"NSE",
  "currentPrice":number,"change":number,"changePercent":number,
  "open":number,"dayHigh":number,"dayLow":number,"previousClose":number,
  "volume":number,"weekHigh52":number,"weekLow52":number,"marketCap":string,

  "movingAverages":[{"name":"SMA 5/10/20/50/100/200 and EMA 9/12/21/50/100/200","value":number,"signal":"Buy/Sell/Neutral"}],
  "maSummary":"X Buy, Y Sell. Mention Golden/Death Cross if active.",

  "momentumIndicators":[{"name":"RSI(14)/Stochastic/StochRSI/Williams%R/CCI/ROC/MFI/UltOsc/Momentum","value":number,"signal":"Bullish/Bearish/Neutral/Overbought/Oversold"}],

  "trendIndicators":[{"name":"MACD/MACD Signal/MACD Histogram/ADX/+DI/-DI/ParabolicSAR/Supertrend/AroonUp/AroonDown/IchimokuBase/IchimokuConv/VWAP","value":number,"signal":string}],

  "volatilityIndicators":[{"name":"BollingerUpper/Mid/Lower/%B/Bandwidth/ATR/KeltnerUpper/Lower/HistVol/StdDev","value":number,"signal":string}],

  "volumeIndicators":[{"name":"Volume/VolumeRatio/OBV/ChaikinMF/ADLine/VolSMA20","value":string,"signal":string}],

  "chartPattern":{"pattern":string,"timeframe":"Daily","completionPercent":number,"breakoutLevel":number,"targetPrice":number,"stopLoss":number,"implication":"Bullish/Bearish/Neutral","description":"2-3 sentences","additionalPatterns":[string]},

  "supportResistance":{"support1":number,"support2":number,"support3":number,"resistance1":number,"resistance2":number,"resistance3":number,"pivotPoint":number,"fibRetracement38":number,"fibRetracement50":number,"fibRetracement62":number},

  "technicalIndicators":[{"name":"52W Range Position/Dist from 52W High-Low/Price vs SMA200/Beta/Delivery%","value":string,"signal":string}],

  "candlestickPatterns":[{"name":string,"signal":"Bullish/Bearish","reliability":"High/Medium/Low"}],

  "fundamentals":{"P/E(TTM)":n,"P/E(Fwd)":n,"P/B":n,"EPS":n,"PEG":n,"ROE":s,"ROCE":s,"ROA":s,"D/E":n,"Current Ratio":n,"Operating Margin":s,"Net Margin":s,"Revenue Growth(YoY)":s,"Profit Growth(YoY)":s,"FCF Yield":s,"Dividend Yield":s,"Book Value":n,"EV/EBITDA":n,"Price/Sales":n},

  "shareholding":{"promoter":number,"fii":number,"dii":number,"public":number},
  "smartMoney":[string],
  "news":[{"headline":string,"source":string,"date":string}],
  "risks":[string],"catalysts":[string],
  "strategies":[{"name":string,"description":string}],
  "researchLinks":[{"title":string,"url":string}],
  "technicalScore":0-100,"fundamentalScore":0-100,"compositeScore":0-100,
  "verdict":"Strong Buy/Buy/Hold/Sell/Strong Sell",
  "overallSummary":string
}

RULES: Use Google Search for REAL prices. Return 12 MAs, 9 momentum, 13 trend, 10 volatility, 6 volume indicators. Identify current daily chart pattern. MA signal: Buy if price>MA, Sell if price<MA. All numbers must be numbers not strings. Fill every field.`;

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

// ─── Gemini call with AbortController timeout ───
async function callGemini(apiKey, model, stock) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28000); // 28s hard cutoff

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Full technical + fundamental analysis with chart pattern: ${stock}` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      const e = await res.text().catch(() => '');
      throw new Error(`${res.status}: ${e.substring(0, 120)}`);
    }

    const data = await res.json();
    const cand = data.candidates?.[0];
    if (!cand) throw new Error('No candidates');
    if (cand.finishReason === 'SAFETY') throw new Error('Safety block');

    const text = (cand.content?.parts || []).filter(p => p.text).map(p => p.text).join('\n');
    if (!text || text.trim().length < 30) throw new Error('Empty response');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Edge handler (Web API Request/Response) ───
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not set' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const stock = body?.stock?.trim();
  if (!stock) {
    return new Response(JSON.stringify({ error: 'Please provide a stock name' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  let lastErr = null;

  for (const model of MODELS) {
    try {
      console.log(`[analyse] ${model} → "${stock}"`);
      const text = await callGemini(apiKey, model, stock);
      const json = extractJSON(text);

      if (json) {
        return new Response(JSON.stringify(json), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Fallback: raw text
      return new Response(JSON.stringify({ stockName: stock, rawAnalysis: text, verdict: 'Hold' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error(`[analyse] ${model} failed:`, e.message);
      lastErr = e;
    }
  }

  const msg = lastErr?.name === 'AbortError'
    ? 'Request timed out. The AI is taking too long — please try again.'
    : `Analysis failed: ${lastErr?.message || 'Unknown error'}`;

  return new Response(JSON.stringify({ error: msg }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}
