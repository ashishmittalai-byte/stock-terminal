// pages/api/tv-screener.js — Top stocks screener data via Yahoo Finance
// Returns: price, change%, volume, market cap, P/E, EPS, div yield, sector

var STOCK_LISTS = {
  nifty50: [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
    'HINDUNILVR.NS', 'ITC.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'KOTAKBANK.NS',
    'LT.NS', 'AXISBANK.NS', 'BAJFINANCE.NS', 'ASIANPAINT.NS', 'MARUTI.NS',
    'TATAMOTORS.NS', 'SUNPHARMA.NS', 'TITAN.NS', 'WIPRO.NS', 'ULTRACEMCO.NS',
  ],
  banknifty: [
    'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS',
    'INDUSINDBK.NS', 'BANKBARODA.NS', 'PNB.NS', 'FEDERALBNK.NS', 'IDFCFIRSTB.NS',
    'AUBANK.NS', 'BANDHANBNK.NS',
  ],
  niftyit: [
    'TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS', 'TECHM.NS',
    'LTIM.NS', 'MPHASIS.NS', 'PERSISTENT.NS', 'COFORGE.NS', 'LTTS.NS',
  ],
};

var YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  var index = (req.query.index || 'nifty50').toLowerCase();
  var symbols = STOCK_LISTS[index] || STOCK_LISTS.nifty50;
  var symbolStr = symbols.join(',');

  try {
    // Try v7 first
    var url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(symbolStr);
    var response = await fetch(url, { headers: YF_HEADERS });

    if (!response.ok) {
      // Fallback v6
      url = 'https://query2.finance.yahoo.com/v6/finance/quote?symbols=' + encodeURIComponent(symbolStr);
      response = await fetch(url, { headers: YF_HEADERS });
    }

    if (!response.ok) {
      throw new Error('Yahoo Finance returned ' + response.status);
    }

    var data = await response.json();
    var quotes = (data.quoteResponse && data.quoteResponse.result) || [];

    var results = quotes.map(function(q) {
      var avgVol = q.averageDailyVolume3Month || q.averageDailyVolume10Day || 0;
      var relVol = avgVol > 0 ? (q.regularMarketVolume || 0) / avgVol : 0;
      return {
        symbol: (q.symbol || '').replace('.NS', '').replace('.BO', ''),
        name: q.shortName || q.longName || q.symbol || '',
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0,
        volume: q.regularMarketVolume || 0,
        relVolume: Math.round(relVol * 100) / 100,
        marketCap: q.marketCap || 0,
        pe: q.trailingPE || null,
        forwardPe: q.forwardPE || null,
        eps: q.epsTrailingTwelveMonths || null,
        epsGrowth: q.earningsQuarterlyGrowth || null,
        divYield: q.dividendYield ? q.dividendYield * 100 : null,
        sector: q.sector || '—',
        weekHigh52: q.fiftyTwoWeekHigh || 0,
        weekLow52: q.fiftyTwoWeekLow || 0,
        dayHigh: q.regularMarketDayHigh || 0,
        dayLow: q.regularMarketDayLow || 0,
        marketState: q.marketState || 'CLOSED',
        exchange: q.exchange || 'NSE',
      };
    });

    // Sort by market cap descending by default
    results.sort(function(a, b) { return b.marketCap - a.marketCap; });

    return res.status(200).json({
      index: index,
      count: results.length,
      results: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('TV Screener error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch screener data' });
  }
}
