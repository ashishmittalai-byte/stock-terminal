// pages/api/screen.js
// ─────────────────────────────────────────────────────────────
// Stock Screener API — finds stocks matching technical patterns
// Edge Runtime for 30s timeout (Gemini needs time to search)
// ─────────────────────────────────────────────────────────────

export const config = { runtime: 'edge' };

const PROMPT = `You are an expert Indian stock market screener. The user will give a strategy or pattern (technical or fundamental). Find Indian NSE/BSE stocks that CURRENTLY match that pattern.

Return ONLY raw JSON (no markdown, no backticks):

{
  "strategy": "Name of the strategy",
  "description": "1 sentence explanation",
  "scanTime": "current date and time",
  "results": [
    {
      "stockName": "Company Name",
      "ticker": "NSE ticker",
      "sector": "Sector",
      "currentPrice": number,
      "change": number,
      "changePercent": number,
      "pattern": "Specific pattern observed",
      "timeframe": "15min / 1hour / Daily / Weekly",
      "signal": "Bullish / Bearish",
      "strength": "Strong / Moderate / Weak",
      "breakoutLevel": number or null,
      "targetPrice": number or null,
      "stopLoss": number or null,
      "volume": "Above Average / Average / Below Average",
      "explanation": "1-2 sentences why this stock matches.",
      "tradingviewUrl": "https://www.tradingview.com/chart/?symbol=NSE:TICKER"
    }
  ],
  "marketContext": "1 sentence about current market context",
  "disclaimer": "For educational purposes only. Not investment advice."
}

RULES:
1. Return 5-8 matching stocks, sorted by strength (strongest first).
2. Every stock must have a specific explanation of why it matches.
3. Include actual price levels for breakout, target, and stop loss where applicable.
4. tradingviewUrl format: https://www.tradingview.com/chart/?symbol=NSE:TICKER
5. All numbers must be JSON numbers, not strings.
6. If fewer than 5 stocks match, return what you find — don't fabricate.
7. Keep explanations SHORT — 1-2 sentences max per stock.
8. For fundamental screens, include key metrics (PE, ROE, D/E, growth%) in the explanation.`;

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
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  const isGemma = model.startsWith('gemma');

  const body = {
    contents: [{
      role: 'user',
      parts: [{
        text: isGemma
          ? PROMPT + '\n\nFind Indian stocks matching this strategy: ' + strategy
          : 'Find Indian NSE/BSE stocks currently matching this strategy: ' + strategy
      }],
    }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  if (!isGemma) {
    body.system_instruction = { parts: [{ text: PROMPT }] };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(function() { ctrl.abort(); }, 25000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const e = await res.text().catch(function() { return ''; });
      if (res.status === 429) throw new Error('RATE_LIMIT');
      throw new Error('HTTP ' + res.status + ': ' + e.substring(0, 150));
    }
    const data = await res.json();
    const cand = data.candidates && data.candidates[0];
    if (!cand || !cand.content || !cand.content.parts) throw new Error('No content');
    const text = cand.content.parts.filter(function(p) { return p.text && !p.thought; }).map(function(p) { return p.text; }).join('\n');
    if (!text || text.trim().length < 30) throw new Error('Empty response');
    return text;
  } finally { clearTimeout(timer); }
}

export default async function handler(req) {
  var H = { 'Content-Type': 'application/json' };

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: H });
    }

    var apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not set' }), { status: 500, headers: H });
    }

    var body;
    try { body = await req.json(); } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: H });
    }

    var strategy = body && body.strategy ? body.strategy.trim() : '';
    if (!strategy) {
      return new Response(JSON.stringify({ error: 'Strategy required' }), { status: 400, headers: H });
    }

    var models = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    var errors = [];

    for (var m = 0; m < models.length; m++) {
      var model = models[m];
      try {
        var text = await callGemini(apiKey, model, strategy);
        var json = extractJSON(text);
        if (json) {
          json._model = model;
          json._skipped = errors.length > 0 ? errors : undefined;
          return new Response(JSON.stringify(json), { status: 200, headers: H });
        }
        return new Response(JSON.stringify({ strategy: strategy, rawResponse: text, _model: model }), { status: 200, headers: H });
      } catch (err) {
        errors.push(model + ': ' + (err.name === 'AbortError' ? 'timed out' : err.message));
      }
    }

    return new Response(JSON.stringify({ error: 'Screener failed: ' + errors.join(' | ') }), { status: 502, headers: H });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unexpected: ' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
