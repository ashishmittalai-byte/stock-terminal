// pages/api/analyse.js
// Secure backend proxy using Google Gemini API (FREE tier) with Google Search grounding.

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

  const systemInstruction = `You are a professional Indian equity research analyst. The user will give you a stock name/ticker (BSE or NSE listed). You MUST return a STRICT JSON object (no markdown, no backticks, no extra text) with this schema:

{
  "stockName": "Full company name",
  "ticker": "NSE/BSE ticker",
  "exchange": "NSE or BSE",
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
  "marketCapLabel": "string like ₹1,23,456 Cr",
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
  "historicalPrices": [array of 30 recent daily closing prices oldest first],
  "historicalHighs": [array of 30 recent daily high prices],
  "historicalLows": [array of 30 recent daily low prices],
  "historicalVolumes": [array of 30 recent daily volumes],
  "sma20": number or null,
  "sma50": number or null,
  "sma200": number or null,
  "avgDeliveryPct": number or null,
  "beta": number or null,
  "intrinsicValueEstimate": number or null,
  "analystConsensus": "Strong Buy" or "Buy" or "Hold" or "Sell" or "Strong Sell" or null,
  "analystTargetPrice": number or null,
  "recentNews": ["headline1", "headline2", "headline3"],
  "smartMoneySignals": "string about bulk/block deals, insider trading, FII/DII activity",
  "keyRisks": ["risk1", "risk2"],
  "keyCatalysts": ["catalyst1", "catalyst2"]
}

CRITICAL: Return ONLY valid JSON. No markdown. No backticks. No explanation text. Use real data. If unavailable use null.`;

  const userMessage = `Analyse this Indian stock: ${stockQuery.trim()}. Search for its current price, fundamentals, technicals, shareholding, and recent news. Return ONLY the JSON object, nothing else.`;

  // Try multiple Gemini API configurations
  const attempts = [
    {
      // Attempt 1: Gemini 2.0 Flash with google_search tool
      model: "gemini-2.0-flash",
      apiVersion: "v1beta",
      tools: [{ google_search: {} }],
    },
    {
      // Attempt 2: Gemini 2.0 Flash with googleSearchRetrieval
      model: "gemini-2.0-flash",
      apiVersion: "v1beta",
      tools: [{ google_search_retrieval: {} }],
    },
    {
      // Attempt 3: Gemini 1.5 Flash with google search retrieval
      model: "gemini-1.5-flash",
      apiVersion: "v1beta",
      tools: [{ google_search_retrieval: {} }],
    },
    {
      // Attempt 4: Gemini 2.0 Flash without search (uses training data)
      model: "gemini-2.0-flash",
      apiVersion: "v1beta",
      tools: null,
    },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const url = `https://generativelanguage.googleapis.com/${attempt.apiVersion}/models/${attempt.model}:generateContent?key=${apiKey}`;

      const requestBody = {
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      };

      if (attempt.tools) {
        requestBody.tools = attempt.tools;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`Attempt ${i + 1} (${attempt.model}) failed:`, response.status, errBody);

        if (response.status === 429) {
          return res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." });
        }
        if (response.status === 403) {
          return res.status(403).json({ error: "API key invalid or Gemini API not enabled. Check your key at https://aistudio.google.com/app/apikey" });
        }

        // Try next attempt
        continue;
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
        console.error(`Attempt ${i + 1}: Empty response`);
        continue;
      }

      // Extract JSON from response
      let jsonStr = fullText;
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      jsonStr = jsonStr.replace(/```json|```/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Try harder - strip everything before first { and after last }
        const start = jsonStr.indexOf("{");
        const end = jsonStr.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          try {
            parsed = JSON.parse(jsonStr.substring(start, end + 1));
          } catch {
            console.error(`Attempt ${i + 1}: JSON parse failed`);
            continue;
          }
        } else {
          continue;
        }
      }

      // Success!
      console.log(`Success on attempt ${i + 1} (${attempt.model}${attempt.tools ? " with search" : ""})`);
      return res.status(200).json(parsed);

    } catch (err) {
      console.error(`Attempt ${i + 1} error:`, err.message);
      continue;
    }
  }

  // All attempts failed
  return res.status(502).json({
    error: "All API attempts failed. Please try again in a moment, or try a different stock name/ticker.",
  });
}
