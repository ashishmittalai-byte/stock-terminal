// pages/api/screen.js
// ─────────────────────────────────────────────────────────────
// Stock Screener API — finds stocks matching technical patterns
// Edge Runtime for 30s timeout (Gemini needs time to search)
// ─────────────────────────────────────────────────────────────

export const config = { runtime: 'edge' };

const PROMPT = `You are an expert Indian stock market screener. The user will give a technical strategy or pattern. Use Google Search to find Indian NSE/BSE stocks that CURRENTLY match that pattern TODAY.

Return ONLY raw JSON (no markdown, no backticks):

{
  "strategy": "Name of the strategy searched",
  "description": "1-2 sentence explanation of what this strategy/pattern means",
  "scanTime": "current date and time",
  "results": [
    {
      "stockName": "Company Name",
      "ticker": "NSE ticker",
      "sector": "Sector",
      "currentPrice": number,
      "change": number,
      "changePercent": number,
      "pattern": "Specific pattern observed on this stock",
      "timeframe": "15min / 1hour / Daily / Weekly",
      "signal": "Bullish / Bearish",
      "strength": "Strong / Moderate / Weak",
      "breakoutLevel": number or null,
      "targetPrice": number or null,
      "stopLoss": number or null,
      "volume": "Above Average / Average / Below Average",
      "explanation": "2-3 sentences explaining WHY this stock matches the strategy, what the chart shows, key levels to watch, and what a trader should do.",
      "tradingviewUrl": "https://www.tradingview.com/chart/?symbol=NSE:TICKER"
    }
  ],
  "marketContext": "1-2 sentences about current Nifty/Sensex context relevant to this strategy",
  "disclaimer": "For educational purposes only. Not investment advice."
}

RULES:
1. Use Google Search to find REAL stocks matching the pattern RIGHT NOW.
2. Return 5-10 matching stocks, sorted by signal strength (strongest first).
3. Every stock must have a specific explanation of why it matches.
4. Include actual price levels for breakout, target, and stop loss.
5. tradingviewUrl must use the format: https://www.tradingview.com/chart/?symbol=NSE:TICKER
6. All numbers must be JSON numbers, not strings.
7. If fewer than 5 stocks match, return what you find — don't fabricate.`;

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

async function callGemini(apiKey, model, strategy) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const isGemma = model.startsWith('gemma');

  const body = {
    contents: [{
      role: 'user',
      parts: [{
        text: isGemma
          ? `${PROMPT}\n\nFind Indian stocks matching this strategy: ${strategy}`
          : `Find Indian NSE/BSE stocks currently matching this strategy: ${strategy}`
      }],
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  };

  // Disable thinking mode for Gemma models (their thinking tokens break JSON parsing)
  if (isGemma) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

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
      if (res.status === 429) throw new Error('RATE_LIMIT');
      throw new Error('HTTP ' + res.status + ': ' + e.substring(0, 150));
    }
    const data = await res.json();
    const cand = data.candidates?.[0];
    if (!cand?.content?.parts) throw new Error('No content');
    // Filter out thinking parts (thought: true) and only use text parts
    const text = cand.content.parts.filter(p => p.text && !p.thought).map(p => p.text).join('\n');
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

    const strategy = body?.strategy?.trim();
    if (!strategy) {
      return new Response(JSON.stringify({ error: 'Strategy required' }), { status: 400, headers: H });
    }

    const models = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemma-4-26b-a4b-it'];
    const errors = [];

    for (const model of models) {
      try {
        const text = await callGemini(apiKey, model, strategy);
        const json = extractJSON(text);
        if (json) {
          json._model = model;
          json._skipped = errors.length > 0 ? errors : undefined;
          return new Response(JSON.stringify(json), { status: 200, headers: H });
        }
        return new Response(JSON.stringify({ strategy, rawResponse: text, _model: model }), { status: 200, headers: H });
      } catch (err) {
        errors.push(`${model}: ${err.name === 'AbortError' ? 'timed out' : err.message}`);
      }
    }

    return new Response(JSON.stringify({ error: `Screener failed: ${errors.join(' | ')}` }), { status: 502, headers: H });

  } catch (e) {
    return new Response(JSON.stringify({ error: `Unexpected: ${e.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
