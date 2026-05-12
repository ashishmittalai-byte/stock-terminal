// pages/api/market.js — Live market data via Yahoo Finance

var DEFAULT_INDICES = [
  { symbol: '^NSEI', label: 'NIFTY 50', short: 'NIFTY' },
  { symbol: '^NSEBANK', label: 'Bank Nifty', short: 'BANKNIFTY' },
  { symbol: '^BSESN', label: 'Sensex', short: 'SENSEX' },
  { symbol: '^CNXIT', label: 'Nifty IT', short: 'CNXIT' },
  { symbol: '^GSPC', label: 'S&P 500', short: 'SPX' },
];

var DEFAULT_STOCKS = [
  'RELIANCE.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'TCS.NS', 'INFY.NS',
];

var YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  var customSymbols = req.query.symbols;
  var detail = req.query.detail;

  try {
    var indexSymbols = DEFAULT_INDICES.map(function(i) { return i.symbol; });
    var stockSymbols = customSymbols
      ? customSymbols.split(',').map(function(s) { return s.trim(); })
      : DEFAULT_STOCKS;
    var allSymbols = indexSymbols.concat(stockSymbols);
    var symbolStr = allSymbols.join(',');

    var quoteRes = null;
    var endpoints = [
      'https://query1.finance.yahoo.com/v7/finance/quote?symbols=',
      'https://query2.finance.yahoo.com/v7/finance/quote?symbols=',
      'https://query1.finance.yahoo.com/v6/finance/quote?symbols=',
    ];

    for (var e = 0; e < endpoints.length; e++) {
      try {
        quoteRes = await fetch(endpoints[e] + encodeURIComponent(symbolStr), {
          headers: YF_HEADERS,
        });
        if (quoteRes.ok) break;
        quoteRes = null;
      } catch (fetchErr) {
        quoteRes = null;
      }
    }

    if (!quoteRes || !quoteRes.ok) {
      throw new Error('Yahoo Finance API unavailable');
    }

    var quoteData = await quoteRes.json();
    var results = (quoteData.quoteResponse && quoteData.quoteResponse.result) || [];

    var indices = [];
    var stocks = [];

    results.forEach(function(q) {
      var item = {
        symbol: q.symbol || '',
        name: q.shortName || q.longName || q.symbol || '',
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePercent: q.regularMarketChangePercent || 0,
        prevClose: q.regularMarketPreviousClose || 0,
        dayHigh: q.regularMarketDayHigh || 0,
        dayLow: q.regularMarketDayLow || 0,
        volume: q.regularMarketVolume || 0,
        marketCap: q.marketCap || 0,
        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh || 0,
        fiftyTwoWeekLow: q.fiftyTwoWeekLow || 0,
        marketState: q.marketState || 'CLOSED',
        exchange: q.exchange || '',
        currency: q.currency || 'INR',
      };

      var isIndex = false;
      for (var i = 0; i < DEFAULT_INDICES.length; i++) {
        if (DEFAULT_INDICES[i].symbol === q.symbol) {
          item.label = DEFAULT_INDICES[i].label;
          item.short = DEFAULT_INDICES[i].short;
          isIndex = true;
          break;
        }
      }
      if (isIndex) indices.push(item);
      else {
        item.short = (q.symbol || '').replace('.NS', '').replace('.BO', '');
        item.label = q.shortName || item.short;
        stocks.push(item);
      }
    });

    var performance = null;
    if (detail) {
      try { performance = await fetchPerformance(detail); } catch (e) { performance = null; }
    }

    return res.status(200).json({ indices: indices, stocks: stocks, performance: performance, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Market API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch market data' });
  }
}

async function fetchPerformance(symbol) {
  var chartUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=1y&interval=1d';
  var chartRes = await fetch(chartUrl, { headers: YF_HEADERS });
  if (!chartRes.ok) return null;
  var chartData = await chartRes.json();
  var result = chartData.chart && chartData.chart.result && chartData.chart.result[0];
  if (!result) return null;
  var closes = (result.indicators && result.indicators.quote && result.indicators.quote[0]) ? result.indicators.quote[0].close : [];
  var timestamps = result.timestamp || [];
  if (closes.length === 0) return null;
  var currentPrice = closes[closes.length - 1];
  var now = Date.now();
  function getPriceNDaysAgo(days) {
    var target = now - (days * 86400000);
    var closest = null, closestDiff = Infinity;
    for (var i = 0; i < timestamps.length; i++) {
      var diff = Math.abs((timestamps[i] * 1000) - target);
      if (diff < closestDiff && closes[i] != null) { closestDiff = diff; closest = closes[i]; }
    }
    return closest;
  }
  function calcReturn(past) { return (!past || past === 0) ? null : ((currentPrice - past) / past * 100); }
  var jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
  var ytdPrice = null, ytdDiff = Infinity;
  for (var i = 0; i < timestamps.length; i++) {
    var diff = Math.abs((timestamps[i] * 1000) - jan1);
    if (diff < ytdDiff && closes[i] != null) { ytdDiff = diff; ytdPrice = closes[i]; }
  }
  return { '1W': calcReturn(getPriceNDaysAgo(7)), '1M': calcReturn(getPriceNDaysAgo(30)), '3M': calcReturn(getPriceNDaysAgo(90)), '6M': calcReturn(getPriceNDaysAgo(180)), 'YTD': calcReturn(ytdPrice), '1Y': calcReturn(getPriceNDaysAgo(365)) };
}
