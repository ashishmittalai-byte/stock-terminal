// pages/api/analyse.js
// Secure backend proxy using Google Gemini API (FREE tier) with Google Search grounding.
// Get your free API key at: https://aistudio.google.com/app/apikey

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

  const systemInstruction = `You are a professional Indian equity research analyst. The user will give you a stock name/ticker (BSE or NSE listed). You MUST:
1. Use Google Search grounding to find the LATEST current market data for this stock.
2. Return a STRICT JSON object (no markdown, no backticks, no extra text) with exactly this schema:

{
  "stockName": "Full company name",
  "ticker": "NSE/BSE ticker",
  "exchange": "NSE" or "BSE",
  "sector": "Sector name",
  "industry": "Industry name",
  "currentPrice": number,
  "currency": "INR",
  "dayChange": number (percentage),
  "dayHigh": number,
  "dayLow": number,
  "open": number,
  "prevClose": number,
  "fiftyTwoWeekHigh": number,
  "fiftyTwoWeekLow": number,
  "volume": number,
  "avgVolume": number,
  "marketCap": number (in crores),
  "marketCapLabel": "string like '₹1,23,456 Cr'",
  "pe": number or null,
  "pb": number or null,
  "eps": number or null,
  "dividendYield": number or null (percentage),
  "roe": number or null (percentage),
  "roce": number or null (percentage),
  "debtToEquity": number or null,
  "bookValue": number or null,
  "faceValue": number or null,
  "promoterHolding": number or null (percentage),
  "fiiHolding": number or null (percentage),
  "diiHolding": number or null (percentage),
  "publicHolding": number or null (percentage),
  "revenueGrowthYoY": number or null (percentage),
  "profitGrowthYoY": number or null (percentage),
  "operatingMargin": number or null (percentage),
  "netMargin": number or null (percentage),
  "freeCashFlowYield": number or null (percentage),
  "peg": number or null,
  "historicalPrices": [array of ~30 recent daily closing prices, oldest first],
  "historicalHighs": [array of ~30 recent daily high prices],
  "historicalLows": [array of ~30 recent daily low prices],
  "historicalVolumes": [array of ~30 recent daily volumes],
  "sma20": number or null,
  "sma50": number or null,
  "sma200": number or null,
  "avgDeliveryPct": number or null (percentage),
  "beta": number or null,
  "intrinsicValueEstimate": number or null,
  "analystConsensus": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | null,
  "analystTargetPrice": number or null,
  "recentNews": ["string headline 1", "string headline 2", "string headline 3"],
  "smartMoneySignals": "string: any bulk/block deal info, insider trading, FII/DII activity",
  "keyRisks": ["risk1", "risk2"],
  "keyCatalysts": ["catalyst1", "catalyst2"]
}

CRITICAL RULES:
- Return ONLY the JSON object. No other text, no markdown, no backticks.
- Use real, current data from search results. Do NOT fabricate numbers.
- If a value is not available, use null.
- historicalPrices must have at least 15 data points for indicator computation.
- All prices in INR. MarketCap in crores.`;

  const userMessage = `Analyse this Indian stock: ${stockQuery.trim()}. Search for its current price, fundamentals, technicals, shareholding, and recent news. Return ONLY the JSON object.`;

  try {
    // Gemini 2.0 Flash — free tier: 15 RPM, 1M tokens/day
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini API error:", response.status, errBody);

      if (response.status === 429) {
        return res.status(429).json({ error: "Rate limit reached. Free tier allows 15 requests/minute. Please wait a moment and try again." });
      }
      if (response.status === 403) {
        return res.status(403).json({ error: "API key invalid or Gemini API not enabled. Check your key at https://aistudio.google.com/app/apikey" });
      }
      return res.status(502).json({ error: `Gemini API error (${response.status}).` });
    }

    const data = await response.json();

    // Extract text from Gemini response
    let fullText = "";
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const parts = data.candidates[0].content.parts || [];
      fullText = parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join("\n")
        .trim();
    }

    if (!fullText) {
      return res.status(422).json({ error: "Empty response from Gemini. Try again." });
    }

    // Extract JSON — handle markdown wrapping
    let jsonStr = fullText;
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    jsonStr = jsonStr.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const secondPass = jsonStr.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
      try {
        parsed = JSON.parse(secondPass);
      } catch {
        return res.status(422).json({
          error: "Could not parse stock data. Try again or use a more specific ticker (e.g. RELIANCE instead of Reliance Industries).",
          raw: fullText.slice(0, 500),
        });
      }
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
