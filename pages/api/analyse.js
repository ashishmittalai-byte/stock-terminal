// pages/api/quote.js — Yahoo Finance live price proxy
// Fetches real-time price + 3-month daily OHLCV for Indian stocks (NSE/BSE)

const TICKER_MAP = {
  "reliance": "RELIANCE.NS", "tcs": "TCS.NS", "infosys": "INFY.NS", "infy": "INFY.NS",
  "hdfc bank": "HDFCBANK.NS", "hdfcbank": "HDFCBANK.NS", "icici bank": "ICICIBANK.NS",
  "sbi": "SBIN.NS", "state bank": "SBIN.NS", "kotak": "KOTAKBANK.NS", "kotak bank": "KOTAKBANK.NS",
  "axis bank": "AXISBANK.NS", "itc": "ITC.NS", "wipro": "WIPRO.NS", "hcl tech": "HCLTECH.NS",
  "bajaj finance": "BAJFINANCE.NS", "bajaj finserv": "BAJAJFINSV.NS", "bharti airtel": "BHARTIARTL.NS",
  "airtel": "BHARTIARTL.NS", "asian paints": "ASIANPAINT.NS", "maruti": "MARUTI.NS",
  "sun pharma": "SUNPHARMA.NS", "tata motors": "TATAMOTORS.NS", "tatamotors": "TATAMOTORS.NS",
  "tata steel": "TATASTEEL.NS", "titan": "TITAN.NS", "ultratech": "ULTRACEMCO.NS",
  "power grid": "POWERGRID.NS", "ntpc": "NTPC.NS", "ongc": "ONGC.NS", "coal india": "COALINDIA.NS",
  "adani ports": "ADANIPORTS.NS", "adani enterprises": "ADANIENT.NS", "adani green": "ADANIGREEN.NS",
  "tech mahindra": "TECHM.NS", "m&m": "M&M.NS", "mahindra": "M&M.NS", "indusind bank": "INDUSINDBK.NS",
  "hdfc life": "HDFCLIFE.NS", "sbi life": "SBILIFE.NS", "divis lab": "DIVISLAB.NS",
  "dr reddy": "DRREDDY.NS", "cipla": "CIPLA.NS", "grasim": "GRASIM.NS", "nestle": "NESTLEIND.NS",
  "britannia": "BRITANNIA.NS", "hindalco": "HINDALCO.NS", "jsw steel": "JSWSTEEL.NS",
  "tata consumer": "TATACONSUM.NS", "hero motocorp": "HEROMOTOCO.NS", "eicher motors": "EICHERMOT.NS",
  "bhel": "BHEL.NS", "canara bank": "CANBK.NS", "pnb": "PNB.NS", "bank of baroda": "BANKBARODA.NS",
  "vedanta": "VEDL.NS", "zomato": "ZOMATO.NS", "paytm": "PAYTM.NS", "dmart": "DMART.NS",
  "avenue supermarts": "DMART.NS", "irctc": "IRCTC.NS", "lic": "LICI.NS", "hal": "HAL.NS",
  "bel": "BEL.NS", "tata power": "TATAPOWER.NS", "ioc": "IOC.NS", "bpcl": "BPCL.NS",
  "hpcl": "HINDPETRO.NS", "gail": "GAIL.NS",
};

function resolveYahooTicker(query) {
  const q = query.toLowerCase().trim();
  if (TICKER_MAP[q]) return TICKER_MAP[q];
  if (q.includes(".ns") || q.includes(".bo")) return q.toUpperCase();
  return q.toUpperCase() + ".NS";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { stockQuery } = req.body;
  if (!stockQuery?.trim()) return res.status(400).json({ error: "Missing stockQuery." });

  const ticker = resolveYahooTicker(stockQuery);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=3mo&interval=1d&includePrePost=false`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Yahoo Finance error (${response.status}). Try exact NSE ticker like SBIN, RELIANCE.` });
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return res.status(422).json({ error: "No data found for this ticker." });

    const meta = result.meta || {};
    const ts = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};

    const opens = (quote.open || []).map(v => v ?? 0);
    const highs = (quote.high || []).map(v => v ?? 0);
    const lows = (quote.low || []).map(v => v ?? 0);
    const closes = (quote.close || []).map(v => v ?? 0);
    const volumes = (quote.volume || []).map(v => v ?? 0);
    const dates = ts.map(t => new Date(t * 1000).toISOString().split("T")[0]);

    // Filter out zero/null entries
    const candles = [];
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] > 0 && opens[i] > 0) {
        candles.push({ date: dates[i], open: opens[i], high: highs[i], low: lows[i], close: closes[i], volume: volumes[i] });
      }
    }

    return res.status(200).json({
      ticker: meta.symbol || ticker,
      currency: meta.currency || "INR",
      currentPrice: meta.regularMarketPrice || closes[closes.length - 1],
      previousClose: meta.chartPreviousClose || meta.previousClose,
      dayHigh: meta.regularMarketDayHigh || highs[highs.length - 1],
      dayLow: meta.regularMarketDayLow || lows[lows.length - 1],
      open: opens[opens.length - 1],
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      volume: volumes[volumes.length - 1],
      candles,
      source: "Yahoo Finance",
    });
  } catch (err) {
    console.error("Yahoo Finance error:", err);
    return res.status(502).json({ error: "Could not fetch live price. Try exact NSE ticker." });
  }
}
