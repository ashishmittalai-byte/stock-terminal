// pages/api/analyse.js — V2 Enhanced
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server misconfigured: GEMINI_API_KEY not set." });
  const { stockQuery } = req.body;
  if (!stockQuery?.trim()) return res.status(400).json({ error: "Missing stockQuery." });

  const prompt = `You are an elite Indian equity research analyst with encyclopedic knowledge of BSE/NSE markets.

Analyse: ${stockQuery.trim()}

Return ONLY a valid JSON object (no markdown, no backticks, no extra text) with ALL these fields. Use your most recent knowledge. If unavailable, use null.

{
  "stockName": "Full name",
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
  "marketCapLabel": "formatted",
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
  "quickRatio": number or null,
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
  "operatingMargin": number or null,
  "netMargin": number or null,
  "freeCashFlow": number or null,
  "freeCashFlowYield": number or null,
  "peg": number or null,
  "returnOnCapital": number or null,
  "salesGrowth5Y": number or null,
  "profitGrowth5Y": number or null,
  "historicalPrices": [50 daily closing prices oldest first],
  "historicalHighs": [50 daily highs],
  "historicalLows": [50 daily lows],
  "historicalCloses": [50 daily closes same as historicalPrices],
  "historicalVolumes": [50 daily volumes],
  "historicalOpens": [50 daily opens],
  "sma20": number or null,
  "sma50": number or null,
  "sma100": number or null,
  "sma200": number or null,
  "ema12": number or null,
  "ema26": number or null,
  "beta": number or null,
  "avgDeliveryPct": number or null,
  "intrinsicValueEstimate": number or null,
  "grahamNumber": number or null,
  "analystConsensus": "Strong Buy/Buy/Hold/Sell/Strong Sell" or null,
  "analystTargetPrice": number or null,
  "analystCount": number or null,
  "recentNews": [
    {"headline": "string", "summary": "1-2 sentence summary", "sentiment": "positive/negative/neutral", "date": "YYYY-MM-DD or approximate"},
    {"headline": "string", "summary": "summary", "sentiment": "sentiment", "date": "date"},
    {"headline": "string", "summary": "summary", "sentiment": "sentiment", "date": "date"},
    {"headline": "string", "summary": "summary", "sentiment": "sentiment", "date": "date"},
    {"headline": "string", "summary": "summary", "sentiment": "sentiment", "date": "date"}
  ],
  "smartMoneySignals": "string about bulk/block deals, insider trading, FII/DII recent activity",
  "keyRisks": ["risk1", "risk2", "risk3"],
  "keyCatalysts": ["catalyst1", "catalyst2", "catalyst3"],
  "quarterlyRevenue": [4 recent quarters in crores],
  "quarterlyProfit": [4 recent quarters in crores],
  "quarterlyLabels": ["Q1FY25", "Q2FY25", "Q3FY25", "Q4FY25"],
  "peerComparison": [
    {"name": "Peer1", "pe": number, "roe": number, "marketCap": number},
    {"name": "Peer2", "pe": number, "roe": number, "marketCap": number},
    {"name": "Peer3", "pe": number, "roe": number, "marketCap": number}
  ],
  "businessDescription": "2-3 sentence company overview",
  "competitiveAdvantage": "1-2 sentence moat description",
  "managementQuality": "Good/Average/Poor with brief reason"
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: "application/json" },
      }),
    });
    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini error:", response.status, errBody);
      if (response.status === 429) return res.status(429).json({ error: "Rate limit reached (15/min). Wait a moment." });
      if (response.status === 403) return res.status(403).json({ error: "API key invalid." });
      return res.status(502).json({ error: `Gemini API error (${response.status}).` });
    }
    const data = await response.json();
    let fullText = "";
    if (data.candidates?.[0]?.content) {
      fullText = (data.candidates[0].content.parts || []).filter(p => p.text).map(p => p.text).join("\n").trim();
    }
    if (!fullText) return res.status(422).json({ error: "Empty response." });
    let jsonStr = fullText.replace(/```json|```/g, "").trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) jsonStr = match[0];
    let parsed;
    try { parsed = JSON.parse(jsonStr); } catch { return res.status(422).json({ error: "Parse error. Try exact ticker e.g. TATAMOTORS." }); }
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
