// pages/api/analyse.js — Edge Runtime (30s timeout on Hobby)
export const config = { runtime: 'edge' };

const PROMPT = `Expert Indian equity analyst. Use Google Search to get REAL-TIME LIVE market data. Return ONLY raw JSON (no markdown/backticks).
{
  "stockName":string,"ticker":string,"currentPrice":number,"change":number,"changePercent":number,
  "open":number,"dayHigh":number,"dayLow":number,"previousClose":number,"volume":string,
  "weekHigh52":number,"weekLow52":number,"marketCap":string,
  "movingAverages":[{"name":"SMA 20/50/100/200 + EMA 9/21/50/200","value":number,"signal":"Buy/Sell/Neutral"}],
  "maSummary":"X Buy, Y Sell. Golden/Death Cross status.",
  "indicators":[{"name":"RSI/MACD/MACD Signal/Histogram/Stochastic/Williams%R/CCI/ADX/Supertrend/SAR/VWAP/BollingerUpper/BollingerLower/ATR/OBV/VolumeRatio/MFI/ROC","value":number,"signal":string}],
  "chartPattern":{"pattern":string,"implication":"Bullish/Bearish/Neutral","breakoutLevel":number,"targetPrice":number,"stopLoss":number,"description":string,"additionalPatterns":[string]},
  "supportResistance":{"support1":n,"support2":n,"support3":n,"resistance1":n,"resistance2":n,"resistance3":n,"pivotPoint":n},
  "candlestickPatterns":[{"name":string,"signal":"Bullish/Bearish","reliability":"High/Medium/Low"}],
  "fundamentals":{"P/E":n,"P/B":n,"EPS":n,"ROE":"%","ROCE":"%","D/E":n,"Net Margin":"%","Revenue Growth":"%","Profit Growth":"%","Dividend Yield":"%","Book Value":n,"EV/EBITDA":n},
  "shareholding":{"promoter":n,"fii":n,"dii":n,"public":n},
  "smartMoney":[string],"news":[{"headline":string,"source":string,"date":string}],
  "risks":[string],"catalysts":[string],
  "strategies":[{"name":string,"description":string}],
  "researchLinks":[{"title":string,"url":string}],
  "technicalScore":0-100,"fundamentalScore":0-100,"compositeScore":0-100,
  "verdict":"Strong Buy/Buy/Hold/Sell/Strong Sell","overallSummary":string
}
Return 8 MAs, 18 indicators, chart pattern, S/R levels, candlestick patterns, fundamentals, news, verdict. All numbers as JSON numbers. Fill every field.`;

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

async function callGemini(apiKey, model, stock) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const isGemma = model.startsWith('gemma');

  const body = {
    contents: [{
      role: 'user',
      parts: [{
        text: isGemma
          ? `${PROMPT}\n\nAnalyse this Indian stock with all indicators: ${stock}`
          : `Get current live price and analyse Indian stock: ${stock}`
      }],
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  };

  // Gemini models: use system_instruction + google_search grounding
  if (!isGemma) {
    body.system_instruction = { parts: [{ text: PROMPT }] };
    body.tools = [{ google_search: {} }];
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const e = await res.text().catch(() => '');
      if (res.status === 429) throw new Error(`RATE_LIMIT`);
      throw new Error(`HTTP ${res.status}: ${e.substring(0, 150)}`);
    }
    const data = await res.json();
    const cand = data.candidates?.[0];
    if (!cand?.content?.parts) throw new Error('No content');
    const text = cand.content.parts.filter(p => p.text).map(p => p.text).join('\n');
    if (!text || text.trim().length < 30) throw new Error('Empty response');
    return text;
  } finally { clearTimeout(timer); }
}

export default async function handler(req) {
  const H = { 'Content-Type': 'application/json' };

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: H });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not set' }), { status: 500, headers: H });
    }

    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: H });
    }

    const stock = body?.stock?.trim();
    if (!stock) {
      return new Response(JSON.stringify({ error: 'Stock name required' }), { status: 400, headers: H });
    }

    // Free tier (no billing needed!) — confirmed May 2026:
    // gemini-3.1-flash-lite  → 1,000 RPD, 15 RPM ← BEST!
    // gemini-3.1-flash       → 250 RPD, 10 RPM
    // gemini-2.5-flash-lite  → 20 RPD, 10 RPM
    // gemma-3-27b-it         → 14,400 RPD (no live prices)
    // Total: ~15,670 free analyses/day!
    const models = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    const errors = [];

    for (const model of models) {
      try {
        const text = await callGemini(apiKey, model, stock);
        const json = extractJSON(text);
        if (json) {
          json._model = model;
          json._skipped = errors.length > 0 ? errors : undefined;
          return new Response(JSON.stringify(json), { status: 200, headers: H });
        }
        return new Response(JSON.stringify({ stockName: stock, rawAnalysis: text, verdict: 'Hold', _model: model, _skipped: errors }), { status: 200, headers: H });
      } catch (err) {
        errors.push(`${model}: ${err.name === 'AbortError' ? 'timed out' : err.message}`);
      }
    }

    return new Response(JSON.stringify({ error: `Failed: ${errors.join(' | ')}` }), { status: 502, headers: H });

  } catch (e) {
    // Catch-all: NEVER return non-JSON
    return new Response(JSON.stringify({ error: `Unexpected error: ${e.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
