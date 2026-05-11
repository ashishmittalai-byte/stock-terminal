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

const SYSTEM_PROMPT = `You are an expert Indian equity technical and fundamental analyst covering all BSE and NSE listed stocks.
When the user gives a stock name or ticker, use Google Search to find the LATEST real-time data and return a SINGLE JSON object (no markdown, no backticks, just raw JSON) with this EXACT structure:

{
  "stockName": "Full company name",
  "ticker": "NSE ticker symbol",
  "exchange": "NSE",
  "currentPrice": 1234.56,
  "change": -12.30,
  "changePercent": -0.99,
  "dayHigh": 1250.00,
  "dayLow": 1220.00,
  "open": 1240.00,
  "previousClose": 1246.86,
  "volume": 12500000,
  "avgVolume": 10000000,
  "weekHigh52": 1500.00,
  "weekLow52": 900.00,
  "marketCap": "850000 Cr",

  "movingAverages": [
    {"name": "SMA 5", "value": 1230.50, "signal": "Buy"},
    {"name": "SMA 10", "value": 1225.30, "signal": "Buy"},
    {"name": "SMA 20", "value": 1210.00, "signal": "Buy"},
    {"name": "SMA 50", "value": 1180.00, "signal": "Buy"},
    {"name": "SMA 100", "value": 1140.00, "signal": "Buy"},
    {"name": "SMA 200", "value": 1050.00, "signal": "Buy"},
    {"name": "EMA 9", "value": 1232.00, "signal": "Buy"},
    {"name": "EMA 12", "value": 1228.50, "signal": "Buy"},
    {"name": "EMA 21", "value": 1218.00, "signal": "Buy"},
    {"name": "EMA 50", "value": 1185.00, "signal": "Buy"},
    {"name": "EMA 100", "value": 1145.00, "signal": "Buy"},
    {"name": "EMA 200", "value": 1060.00, "signal": "Buy"}
  ],
  "maSummary": "10 Buy, 2 Neutral — Price trading above all major MAs. Golden Cross active (50 SMA > 200 SMA).",

  "momentumIndicators": [
    {"name": "RSI (14)", "value": 58.3, "signal": "Neutral", "interpretation": "Neither overbought nor oversold"},
    {"name": "Stochastic %K (14,3,3)", "value": 72.5, "signal": "Neutral"},
    {"name": "Stochastic RSI", "value": 0.68, "signal": "Neutral"},
    {"name": "Williams %R (14)", "value": -27.5, "signal": "Overbought"},
    {"name": "CCI (20)", "value": 85.3, "signal": "Bullish"},
    {"name": "ROC (12)", "value": 4.2, "signal": "Bullish"},
    {"name": "MFI (14)", "value": 62.1, "signal": "Neutral"},
    {"name": "Ultimate Oscillator", "value": 56.8, "signal": "Neutral"},
    {"name": "Momentum (10)", "value": 35.2, "signal": "Bullish"}
  ],

  "trendIndicators": [
    {"name": "MACD (12,26,9)", "value": 15.3, "signal": "Bullish", "interpretation": "MACD above signal line, histogram positive"},
    {"name": "MACD Signal", "value": 10.1, "signal": "Bullish"},
    {"name": "MACD Histogram", "value": 5.2, "signal": "Bullish"},
    {"name": "ADX (14)", "value": 28.5, "signal": "Trending", "interpretation": "Moderate trend strength"},
    {"name": "+DI", "value": 32.1, "signal": "Bullish"},
    {"name": "-DI", "value": 18.4, "signal": "Bullish"},
    {"name": "Parabolic SAR", "value": 1195.00, "signal": "Bullish", "interpretation": "SAR below price = uptrend"},
    {"name": "Supertrend (10,3)", "value": 1185.00, "signal": "Bullish"},
    {"name": "Aroon Up", "value": 85.7, "signal": "Bullish"},
    {"name": "Aroon Down", "value": 21.4, "signal": "Bullish"},
    {"name": "Ichimoku Base Line", "value": 1200.00, "signal": "Bullish"},
    {"name": "Ichimoku Conv. Line", "value": 1225.00, "signal": "Bullish"},
    {"name": "VWAP", "value": 1232.50, "signal": "Neutral"}
  ],

  "volatilityIndicators": [
    {"name": "Bollinger Upper (20,2)", "value": 1280.00, "signal": "Neutral"},
    {"name": "Bollinger Middle", "value": 1210.00, "signal": "Buy"},
    {"name": "Bollinger Lower", "value": 1140.00, "signal": "Buy"},
    {"name": "Bollinger %B", "value": 0.67, "signal": "Neutral", "interpretation": "Price in upper half of bands"},
    {"name": "Bollinger Bandwidth", "value": 11.6, "signal": "Neutral"},
    {"name": "ATR (14)", "value": 32.5, "signal": "Normal"},
    {"name": "Keltner Upper", "value": 1270.00, "signal": "Neutral"},
    {"name": "Keltner Lower", "value": 1150.00, "signal": "Neutral"},
    {"name": "Historical Volatility", "value": "22.5%", "signal": "Normal"},
    {"name": "Std Dev (20)", "value": 35.0, "signal": "Normal"}
  ],

  "volumeIndicators": [
    {"name": "Volume", "value": "12.5M", "signal": "Above Avg"},
    {"name": "Volume Ratio", "value": 1.25, "signal": "Bullish"},
    {"name": "OBV", "value": "45.2M", "signal": "Bullish", "interpretation": "OBV trending up with price"},
    {"name": "Chaikin Money Flow", "value": 0.15, "signal": "Bullish"},
    {"name": "A/D Line", "value": "Rising", "signal": "Bullish"},
    {"name": "Volume SMA 20", "value": "10.0M", "signal": "Bullish"}
  ],

  "chartPattern": {
    "pattern": "Ascending Triangle",
    "timeframe": "Daily",
    "status": "In Progress",
    "completionPercent": 75,
    "breakoutLevel": 1260.00,
    "targetPrice": 1340.00,
    "stopLoss": 1185.00,
    "implication": "Bullish",
    "description": "Price forming higher lows with a flat resistance at 1260. A breakout above this level with volume could push the price toward 1340. A breakdown below the ascending trendline (~1185) would negate this pattern.",
    "additionalPatterns": ["Price above Ichimoku Cloud", "Golden Cross active"]
  },

  "supportResistance": {
    "support1": 1210.00,
    "support2": 1180.00,
    "support3": 1140.00,
    "resistance1": 1260.00,
    "resistance2": 1300.00,
    "resistance3": 1350.00,
    "pivotPoint": 1235.00,
    "fibRetracement38": 1195.00,
    "fibRetracement50": 1175.00,
    "fibRetracement62": 1155.00
  },

  "technicalIndicators": [
    {"name": "52-Week Range Position", "value": "55.7%", "signal": "Neutral"},
    {"name": "Distance from 52W High", "value": "-17.7%", "signal": "Neutral"},
    {"name": "Distance from 52W Low", "value": "+37.2%", "signal": "Neutral"},
    {"name": "Price vs SMA 200", "value": "+17.5%", "signal": "Bullish"},
    {"name": "Beta", "value": 1.15, "signal": "Neutral"},
    {"name": "Delivery %", "value": "42.5%", "signal": "Neutral"}
  ],

  "candlestickPatterns": [
    {"name": "Pattern name on recent chart", "signal": "Bullish/Bearish", "reliability": "High/Medium/Low"}
  ],

  "fundamentals": {
    "P/E (TTM)": 25.4,
    "P/E (Fwd)": 22.1,
    "P/B": 4.2,
    "EPS (TTM)": 48.7,
    "PEG": 1.2,
    "ROE": "18.5%",
    "ROCE": "22.1%",
    "ROA": "8.2%",
    "D/E": 0.3,
    "Current Ratio": 1.8,
    "Operating Margin": "24.5%",
    "Net Margin": "16.2%",
    "Revenue Growth (YoY)": "12%",
    "Profit Growth (YoY)": "8%",
    "FCF Yield": "3.2%",
    "Dividend Yield": "1.5%",
    "Book Value": 295.00,
    "Face Value": 10,
    "EV/EBITDA": 18.5,
    "Price/Sales": 5.2
  },

  "shareholding": {
    "promoter": 52.3,
    "fii": 18.7,
    "dii": 14.2,
    "public": 14.8
  },

  "smartMoney": [
    "Recent bulk deal: XYZ bought 2M shares",
    "FII net buyers last 5 sessions",
    "Promoter pledge status: 0% pledged"
  ],
  "news": [
    {"headline": "Headline text", "source": "Source name", "date": "May 2026"}
  ],
  "risks": ["Key risk 1", "Key risk 2", "Key risk 3"],
  "catalysts": ["Catalyst 1", "Catalyst 2", "Catalyst 3"],
  "strategies": [
    {"name": "Swing Trade", "description": "Entry, SL, Target details with levels"},
    {"name": "Positional", "description": "Medium-term strategy with levels"},
    {"name": "Long Term", "description": "Long-term accumulation strategy"}
  ],
  "researchLinks": [
    {"title": "Screener.in", "url": "https://www.screener.in/company/TICKER/"},
    {"title": "Trendlyne", "url": "https://trendlyne.com/equity/TICKER/"},
    {"title": "Tickertape", "url": "https://www.tickertape.in/stocks/TICKER"},
    {"title": "TradingView", "url": "https://www.tradingview.com/symbols/NSE-TICKER/"}
  ],
  "technicalScore": 65,
  "fundamentalScore": 72,
  "compositeScore": 69,
  "verdict": "Buy",
  "overallSummary": "2-3 sentence summary of the overall technical + fundamental picture and what a trader should watch for."
}

CRITICAL RULES:
1. Use Google Search to get REAL, CURRENT, LIVE prices and indicator data — never use stale or made-up data.
2. Return ONLY the JSON object. No markdown, no backticks, no explanation text before or after the JSON.
3. All number fields must be actual numbers, not strings (except percentages shown as strings).
4. The verdict must be exactly one of: "Strong Buy", "Buy", "Hold", "Sell", "Strong Sell".
5. Scores are 0-100 integers. Composite = Technical×0.45 + Fundamental×0.55.
6. Fill ALL fields — if exact data is unavailable, provide best estimates from available data.
7. For chartPattern: identify the CURRENT dominant chart pattern on the DAILY chart. Describe it with actionable breakout/breakdown levels.
8. For movingAverages: signal should be "Buy" if price > MA, "Sell" if price < MA, "Neutral" if within 0.5%.
9. The maSummary should count Buy/Sell/Neutral signals and mention any active crossovers (Golden Cross, Death Cross).
10. Include at least 3-5 recent news headlines.
11. Include at least 2 candlestick patterns visible on recent daily chart.
12. All support/resistance levels should be specific price numbers based on actual chart data.`;

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
