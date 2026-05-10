// pages/api/analyse.js
// Secure backend using Google Gemini 2.0 Flash (FREE tier)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfigured: GEMINI_API_KEY not set." });
  }

  const { stockQuery } = req.body;
  if (!stockQuery || typeof stockQuery !== "string" || stockQuery.trim().length === 0) {
    return res.status(400).json({ error: "Missing or empty stockQuery." });
  }

  const prompt = `You are a professional Indian equity research analyst with deep knowledge of BSE and NSE markets.

Analyse this Indian stock: ${stockQuery.trim()}

Return a JSON object with the latest available data. Use your knowledge of Indian stock market data. Return ONLY valid JSON — no markdown, no backticks, no explanation.

JSON schema:
{
  "stockName": "Full company name",
  "ticker": "NSE/BSE ticker symbol",
  "exchange": "NSE or BSE",
  "sector": "Sector",
  "industry": "Industry",
  "currentPrice": number,
  "currency": "INR",
  "dayChange": number (percent),
  "dayHigh": number,
  "dayLow": number,
  "open": number,
  "prevClose": number,
  "fiftyTwoWeekHigh": number,
  "fiftyTwoWeekLow": number,
  "volume": number,
  "avgVolume": number,
  "marketCap": number (crores),
  "marketCapLabel": "formatted string",
  "pe": number or null,
  "pb": number or null,
  "eps": number or null,
  "dividendYield": number or null,
  "roe": number or null,
  "roce": number or null,
  "debtToEquity": number or null,
  "bookValue": number or null,
  "faceValue": number or null,
  "promoterHolding": number or null,
  "fiiHolding": number or null,
  "diiHolding": number or null,
  "publicHolding": number or null,
  "revenueGrowthYoY": number or null,
  "profitGrowthYoY": number or null,
  "operatingMargin": number or null,
  "netMargin": number or null,
  "freeCashFlowYield": number or null,
  "peg": number or null,
  "historicalPrices": [30 recent daily closing prices, oldest first],
  "historicalHighs": [30 recent daily highs],
  "historicalLows": [30 recent daily lows],
  "historicalVolumes": [30 recent daily volumes],
  "sma20": number or null,
  "sma50": number or null,
  "sma200": number or null,
  "beta": number or null,
  "intrinsicValueEstimate": number or null,
  "analystConsensus": "Strong Buy" or "Buy" or "Hold" or "Sell" or "Strong Sell" or null,
  "analystTargetPrice": number or null,
  "recentNews": ["headline1", "headline2", "headline3"],
  "smartMoneySignals": "bulk deals, insider activity, FII/DII flows",
  "keyRisks": ["risk1", "risk2"],
  "keyCatalysts": ["catalyst1", "catalyst2"]
}

Return ONLY the JSON. No other text.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini error:", response.status, errBody);

      if (response.status === 429) {
        return res.status(429).json({ error: "Rate limit reached. Free tier allows 15 requests/minute. Please wait a moment and try again." });
      }
      if (response.status === 403) {
        return res.status(403).json({ error: "API key invalid. Check at https://aistudio.google.com/app/apikey" });
      }
      return res.status(502).json({ error: `Gemini API error (${response.status}).` });
    }

    const data = await response.json();

    let fullText = "";
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const parts = data.candidates[0].content.parts || [];
      fullText = parts.filter((p) => p.text).map((p) => p.text).join("\n").trim();
    }

    if (!fullText) {
      return res.status(422).json({ error: "Empty response. Try again." });
    }

    // Parse JSON
    let jsonStr = fullText.replace(/```json|```/g, "").trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) jsonStr = match[0];

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(422).json({ error: "Could not parse response. Try a specific ticker like TATAMOTORS instead of Tata Motors." });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error. Try again." });
  }
}
