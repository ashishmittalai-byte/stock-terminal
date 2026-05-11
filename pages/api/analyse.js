// pages/api/analyse.js — V3.1 Fixed
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set." });
  const { stockQuery } = req.body;
  if (!stockQuery?.trim()) return res.status(400).json({ error: "Missing stockQuery." });

  const prompt = `You are an elite Indian equity research analyst. Analyse: ${stockQuery.trim()}

Return ONLY valid JSON with ALL these fields. Use your most recent knowledge of this stock. If unavailable use null.

{
  "stockName": "Full company name",
  "ticker": "NSE ticker",
  "exchange": "NSE or BSE",
  "sector": "Sector",
  "industry": "Industry",
  "currentPrice": number,
  "currency": "INR",
  "dayChange": number,
  "dayHigh": number,
  "dayLow": number,
  "open": number,
  "prevClose": number,
  "fiftyTwoWeekHigh": number,
  "fiftyTwoWeekLow": number,
  "volume": number,
  "avgVolume": number,
  "marketCap": number,
  "marketCapLabel": "formatted string like 1,23,456 Cr",
  "pe": number or null,
  "forwardPe": number or null,
  "pb": number or null,
  "ps": number or null,
  "evToEbitda": number or null,
  "eps": number or null,
  "dividendYield": number or null,
  "roe": number or null,
  "roce": number or null,
  "roa": number or null,
  "debtToEquity": number or null,
  "currentRatio": number or null,
  "interestCoverage": number or null,
  "bookValue": number or null,
  "faceValue": number or null,
  "promoterHolding": number or null,
  "promoterHoldingChange": number or null,
  "fiiHolding": number or null,
  "fiiHoldingChange": number or null,
  "diiHolding": number or null,
  "diiHoldingChange": number or null,
  "publicHolding": number or null,
  "pledgedShares": number or null,
  "revenueGrowthYoY": number or null,
  "revenueGrowth3Y": number or null,
  "profitGrowthYoY": number or null,
  "profitGrowth3Y": number or null,
  "salesGrowth5Y": number or null,
  "profitGrowth5Y": number or null,
  "operatingMargin": number or null,
  "netMargin": number or null,
  "freeCashFlow": number or null,
  "freeCashFlowYield": number or null,
  "peg": number or null,
  "beta": number or null,
  "sma20": number or null,
  "sma50": number or null,
  "sma200": number or null,
  "historicalPrices": [50 recent daily closing prices oldest first as numbers],
  "historicalHighs": [50 daily highs as numbers],
  "historicalLows": [50 daily lows as numbers],
  "historicalOpens": [50 daily opens as numbers],
  "historicalVolumes": [50 daily volumes as numbers],
  "intrinsicValueEstimate": number or null,
  "grahamNumber": number or null,
  "analystConsensus": "Strong Buy" or "Buy" or "Hold" or "Sell" or "Strong Sell" or null,
  "analystTargetPrice": number or null,
  "analystCount": number or null,
  "recentNews": [
    {"headline": "news headline 1", "summary": "1-2 sentence summary", "sentiment": "positive", "date": "2025-05-10", "source": "ET Markets"},
    {"headline": "news headline 2", "summary": "summary", "sentiment": "negative", "date": "2025-05-09", "source": "Moneycontrol"},
    {"headline": "news headline 3", "summary": "summary", "sentiment": "neutral", "date": "2025-05-08", "source": "Livemint"},
    {"headline": "news headline 4", "summary": "summary", "sentiment": "positive", "date": "2025-05-07", "source": "CNBCTV18"},
    {"headline": "news headline 5", "summary": "summary", "sentiment": "neutral", "date": "2025-05-06", "source": "Business Standard"}
  ],
  "smartMoneySignals": "string about recent bulk deals, block deals, insider buying/selling, FII/DII activity for this stock",
  "keyRisks": ["risk 1", "risk 2", "risk 3"],
  "keyCatalysts": ["catalyst 1", "catalyst 2", "catalyst 3"],
  "peerComparison": [
    {"name": "Peer Company 1", "pe": number, "roe": number, "marketCap": number},
    {"name": "Peer Company 2", "pe": number, "roe": number, "marketCap": number},
    {"name": "Peer Company 3", "pe": number, "roe": number, "marketCap": number}
  ],
  "businessDescription": "2-3 sentence company overview",
  "competitiveAdvantage": "1-2 sentence moat description",
  "managementQuality": "Good/Average/Poor with brief reason"
}

CRITICAL: historicalPrices MUST have exactly 50 numbers. recentNews MUST have 5 items with all fields filled. All number fields must be actual numbers not strings.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini error:", response.status, errBody);
      if (response.status === 429) return res.status(429).json({ error: "Rate limit. Wait 1 min (5/min) or check daily quota (20/day)." });
      if (response.status === 403) return res.status(403).json({ error: "API key invalid." });
      return res.status(502).json({ error: `Gemini API error (${response.status}).` });
    }

    const data = await response.json();
    let text = "";
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      text = (data.candidates[0].content.parts || [])
        .filter(p => p.text)
        .map(p => p.text)
        .join("\n")
        .trim();
    }

    if (!text) return res.status(422).json({ error: "Empty response from Gemini." });

    // Clean and parse JSON
    let jsonStr = text.replace(/```json|```/g, "").trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) jsonStr = match[0];

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(422).json({ error: "Could not parse response. Try exact ticker like SBIN, RELIANCE, BAJFINANCE." });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
