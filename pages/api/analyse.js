// pages/api/analyse.js
// ──────────────────────────────────────────────────────────────
// Stock Analysis API — calls Gemini with Google Search grounding
//
// KEY FIX: Google Search grounding is INCOMPATIBLE with
// responseMimeType: "application/json" (returns 400).
// Instead we ask Gemini to return JSON in the prompt and
// extract it from the text response.
//
// Uses gemini-2.5-flash (stable) with v1beta endpoint.
// ──────────────────────────────────────────────────────────────

const API_KEY = process.env.GEMINI_API_KEY;

// Models to try in order (first that succeeds wins)
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

const SYSTEM_PROMPT = `You are an expert Indian equity analyst covering all BSE and NSE listed stocks.
When the user gives a stock name or ticker, use Google Search to find the LATEST real-time data and return a SINGLE JSON object (no markdown, no backticks, just raw JSON) with this exact structure:

{
  "stockName": "Full company name",
  "ticker": "NSE ticker symbol",
  "currentPrice": 1234.56,
  "change": -12.30,
  "changePercent": -0.99,
  "technicalIndicators": [
    {"name": "RSI (14)", "value": 58.3, "signal": "Neutral"},
    {"name": "MACD", "value": 12.5, "signal": "Bullish"},
    {"name": "Bollinger Bands", "value": "Near Upper", "signal": "Bearish"},
    {"name": "Stochastic RSI", "value": 0.72, "signal": "Neutral"},
    {"name": "ATR (14)", "value": 45.2, "signal": "Neutral"},
    {"name": "SMA 20", "value": 1220.0, "signal": "Bullish"},
    {"name": "SMA 50", "value": 1180.0, "signal": "Bullish"},
    {"name": "SMA 200", "value": 1100.0, "signal": "Bullish"},
    {"name": "Volume Ratio", "value": 1.3, "signal": "Bullish"},
    {"name": "52-Week Range", "value": "1050 - 1400", "signal": "Neutral"}
  ],
  "candlestickPatterns": [
    {"name": "Pattern name", "signal": "Bullish/Bearish"}
  ],
  "fundamentals": {
    "P/E": 25.4,
    "P/B": 4.2,
    "EPS": 48.7,
    "PEG": 1.2,
    "ROE": "18.5%",
    "ROCE": "22.1%",
    "D/E": 0.3,
    "Operating Margin": "24.5%",
    "Net Margin": "16.2%",
    "Revenue Growth (YoY)": "12%",
    "Profit Growth (YoY)": "8%",
    "FCF Yield": "3.2%"
  },
  "shareholding": {
    "promoter": 52.3,
    "fii": 18.7,
    "dii": 14.2,
    "public": 14.8
  },
  "smartMoney": [
    "Recent bulk deal: XYZ bought 2M shares",
    "FII net buyers last 5 sessions"
  ],
  "news": [
    {"headline": "Headline text", "source": "Source name", "date": "May 2026"},
    {"headline": "Another headline", "source": "Source", "date": "May 2026"}
  ],
  "risks": [
    "Key risk factor 1",
    "Key risk factor 2"
  ],
  "catalysts": [
    "Positive catalyst 1",
    "Positive catalyst 2"
  ],
  "strategies": [
    {"name": "Swing Trade", "description": "Buy above X with SL at Y, target Z"},
    {"name": "Long Term", "description": "Accumulate on dips near SMA 200"}
  ],
  "researchLinks": [
    {"title": "Screener.in", "url": "https://www.screener.in/company/TICKER/"},
    {"title": "Trendlyne", "url": "https://trendlyne.com/equity/TICKER/"},
    {"title": "Tickertape", "url": "https://www.tickertape.in/stocks/TICKER"}
  ],
  "technicalScore": 65,
  "fundamentalScore": 72,
  "compositeScore": 69,
  "verdict": "Buy"
}

CRITICAL RULES:
1. Use Google Search to get REAL, CURRENT prices and data — never estimate or use stale data.
2. Return ONLY the JSON object. No markdown, no backticks, no explanation before/after.
3. All number fields must be actual numbers, not strings (except where shown as strings above).
4. The verdict must be exactly one of: "Strong Buy", "Buy", "Hold", "Sell", "Strong Sell".
5. Scores are 0-100 integers. Composite = Technical×0.45 + Fundamental×0.55.
6. Fill ALL fields — if data is unavailable, use reasonable estimates and note "est." in the value.
7. Include at least 3 recent news headlines from the last few weeks.`;

// ─── Extract JSON from potentially messy Gemini response ───
function extractJSON(text) {
  if (!text) return null;

  // Remove markdown code fences
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Try direct parse first
  try { return JSON.parse(cleaned); } catch {}

  // Find first { ... last }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(cleaned.substring(first, last + 1)); } catch {}
  }

  // Try to fix common issues: trailing commas
  try {
    const fixed = cleaned
      .substring(first, last + 1)
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    return JSON.parse(fixed);
  } catch {}

  return null;
}

// ─── Call Gemini API ───
async function callGemini(model, stockQuery) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: `Analyse this Indian stock: ${stockQuery}` }],
      },
    ],
    tools: [{ google_search: {} }],
    // NOTE: Do NOT set generationConfig.responseMimeType with google_search tool
    // They are incompatible and cause 400 errors.
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini ${model} returned ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();

  // Extract text from response
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('No candidates in Gemini response');

  // Check for safety blocks
  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Response blocked by safety filters');
  }

  const parts = candidate.content?.parts || [];
  const textParts = parts.filter((p) => p.text).map((p) => p.text);
  const fullText = textParts.join('\n');

  if (!fullText || fullText.trim() === '```' || fullText.trim() === '') {
    throw new Error('Empty response from Gemini (known grounding issue)');
  }

  return fullText;
}

// ─── API Handler ───
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const { stock } = req.body || {};
  if (!stock || typeof stock !== 'string' || stock.trim().length === 0) {
    return res.status(400).json({ error: 'Please provide a stock name' });
  }

  const stockQuery = stock.trim();
  let lastError = null;

  // Try each model in order
  for (const model of MODELS) {
    try {
      console.log(`[analyse] Trying ${model} for "${stockQuery}"...`);
      const text = await callGemini(model, stockQuery);
      const parsed = extractJSON(text);

      if (parsed) {
        console.log(`[analyse] Success with ${model}`);
        return res.status(200).json(parsed);
      }

      // If JSON parsing fails, return the raw text wrapped in a basic structure
      console.warn(`[analyse] ${model} returned non-JSON, wrapping raw text`);
      return res.status(200).json({
        stockName: stockQuery,
        rawAnalysis: text,
        verdict: 'Hold',
        error: null,
      });
    } catch (err) {
      console.error(`[analyse] ${model} failed:`, err.message);
      lastError = err;
      // Continue to next model
    }
  }

  // All models failed
  return res.status(502).json({
    error: `Analysis failed after trying all models. Last error: ${lastError?.message || 'Unknown'}`,
  });
}
