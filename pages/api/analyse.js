// pages/api/analyse.js — V3.1 Full data request with historical prices
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set." });
  const { stockQuery } = req.body;
  if (!stockQuery?.trim()) return res.status(400).json({ error: "Missing stockQuery." });

  const prompt = `You are an elite Indian equity research analyst. Analyse: ${stockQuery.trim()}

Search for the LATEST current data. Return ONLY valid JSON (no markdown, no backticks, no explanation):
{
  "stockName":"Full company name","ticker":"NSE ticker","exchange":"NSE or BSE","sector":"Sector","industry":"Industry",
  "currentPrice":number,"currency":"INR","dayChange":number,"dayHigh":number,"dayLow":number,"open":number,"prevClose":number,
  "fiftyTwoWeekHigh":number,"fiftyTwoWeekLow":number,"volume":number,"avgVolume":number,
  "marketCap":number,"marketCapLabel":"formatted string",
  "pe":number or null,"forwardPe":number or null,"pb":number or null,"ps":number or null,"evToEbitda":number or null,
  "eps":number or null,"dividendYield":number or null,
  "roe":number or null,"roce":number or null,"roa":number or null,
  "debtToEquity":number or null,"currentRatio":number or null,"interestCoverage":number or null,
  "bookValue":number or null,"faceValue":number or null,
  "promoterHolding":number or null,"promoterHoldingChange":number or null,
  "fiiHolding":number or null,"fiiHoldingChange":number or null,
  "diiHolding":number or null,"diiHoldingChange":number or null,
  "publicHolding":number or null,"pledgedShares":number or null,
  "revenueGrowthYoY":number or null,"revenueGrowth3Y":number or null,
  "profitGrowthYoY":number or null,"profitGrowth3Y":number or null,
  "salesGrowth5Y":number or null,"profitGrowth5Y":number or null,
  "operatingMargin":number or null,"netMargin":number or null,
  "freeCashFlow":number or null,"freeCashFlowYield":number or null,"peg":number or null,
  "beta":number or null,
  "sma20":number or null,"sma50":number or null,"sma200":number or null,
  "historicalPrices":[50 recent daily closing prices oldest first],
  "historicalHighs":[50 daily highs],
  "historicalLows":[50 daily lows],
  "historicalOpens":[50 daily opens],
  "historicalVolumes":[50 daily volumes],
  "intrinsicValueEstimate":number or null,"grahamNumber":number or null,
  "analystConsensus":"Strong Buy/Buy/Hold/Sell/Strong Sell" or null,
  "analystTargetPrice":number or null,"analystCount":number or null,
  "recentNews":[
    {"headline":"","summary":"1-2 sentences","sentiment":"positive/negative/neutral","date":"YYYY-MM-DD","source":"publication"},
    {"headline":"","summary":"","sentiment":"","date":"","source":""},
    {"headline":"","summary":"","sentiment":"","date":"","source":""},
    {"headline":"","summary":"","sentiment":"","date":"","source":""},
    {"headline":"","summary":"","sentiment":"","date":"","source":""}
  ],
  "smartMoneySignals":"bulk/block deals, insider trading, FII/DII activity string",
  "keyRisks":["risk1","risk2","risk3"],
  "keyCatalysts":["catalyst1","catalyst2","catalyst3"],
  "peerComparison":[{"name":"Peer1","pe":0,"roe":0,"marketCap":0},{"name":"Peer2","pe":0,"roe":0,"marketCap":0},{"name":"Peer3","pe":0,"roe":0,"marketCap":0}],
  "businessDescription":"2-3 sentences",
  "competitiveAdvantage":"moat description",
  "managementQuality":"Good/Average/Poor with reason"
}

Use REAL current data from search. If unavailable use null. historicalPrices MUST have 30+ numbers.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    });
    if (!response.ok) {
      const err = await response.text(); console.error("Gemini:", response.status, err);
      if (response.status === 429) return res.status(429).json({ error: "Rate limit. Wait 1 min (5/min) or try tomorrow (20/day)." });
      return res.status(502).json({ error: `Gemini error (${response.status}).` });
    }
    const data = await response.json();
    let text = (data.candidates?.[0]?.content?.parts || []).filter(p => p.text).map(p => p.text).join("\n").trim();
    if (!text) return res.status(422).json({ error: "Empty response." });
    text = text.replace(/```json|```/g, "").trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) text = m[0];
    try { return res.status(200).json(JSON.parse(text)); }
    catch { return res.status(422).json({ error: "Parse error. Try exact ticker like SBIN, RELIANCE." }); }
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error." }); }
}
