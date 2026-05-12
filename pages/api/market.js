// pages/api/market.js — Live market data via Yahoo Finance
// Returns: current quotes for indices + watchlist, plus optional performance data

const DEFAULT_INDICES = [
  { symbol: '^NSEI', label: 'NIFTY 50', short: 'NIFTY' },
  { symbol: '^NSEBANK', label: 'Bank Nifty', short: 'BANKNIFTY' },
  { symbol: '^BSESN', label: 'Sensex', short: 'SENSEX' },
  { symbol: '^CNXIT', label: 'Nifty IT', short: 'CNXIT' },
  { symbol: '^GSPC', label: 'S&P 500', short: 'SPX' },
];

const DEFAULT_STOCKS = [
  'RELIANCE.NS',
  'HDFCBANK.NS',
  'ICICIBANK.NS',
  'TCS.NS',
  'INFY.NS',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const { symbols: customSymbols, detail } = req.query;

  try {
    // Build symbol list: indices + default/custom stocks
    var indexSymbols = DEFAULT_INDICES.map(function(i) { return i.symbol; });
    var stockSymbols = customSymbols
      ? customSymbols.split(',').map(function(s) { return s.trim(); })
      : DEFAULT_STOCKS;
    var allSymbols = indexSymbols.concat(stockSymbols);
    var symbolStr = allSymbols.join(',');

    // Fetch quotes from Yahoo Finance v7
    var quoteUrl = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(symbolStr);
    var quoteRes = await fetch(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!quoteRes.ok) {
      // Fallback to v6 if v7 fails
      quoteUrl = 'https://query2.finance.yahoo.com/v6/finance/quote?symbols=' + encodeURIComponent(symbolStr);
      quoteRes = await fetch(quoteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
    }

    if (!quoteRes.ok) {
      throw new Error('Yahoo Finance API returned ' + quoteRes.status);
    }

    var quoteData = await quoteRes.json();
    var results = quoteData.quoteResponse ? quoteData.quoteResponse.result : [];

    // Map to clean format
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

      // Check if it's an index
      var isIndex = false;
      for (var i = 0; i < DEFAULT_INDICES.length; i++) {
        if (DEFAULT_INDICES[i].symbol === q.symbol) {
          item.label = DEFAULT_INDICES[i].label;
          item.short = DEFAULT_INDICES[i].short;
          isIndex = true;
          break;
        }
      }

      if (isIndex) {
        indices.push(item);
      } else {
        // Clean stock name — remove ".NS" / ".BO"
        item.short = (q.symbol || '').replace('.NS', '').replace('.BO', '');
        item.label = q.shortName || item.short;
        stocks.push(item);
      }
    });

    // If detail requested, fetch performance (spark) for that symbol
    var performance = null;
    if (detail) {
      try {
        performance = await fetchPerformance(detail);
      } catch (e) {
        performance = null;
      }
    }

    return res.status(200).json({
      indices: indices,
      stocks: stocks,
      performance: performance,
      timestamp: new Date().toISOString(),
      marketState: indices.length > 0 ? indices[0].marketState : 'UNKNOWN',
    });
  } catch (err) {
    console.error('Market API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch market data' });
  }
}

async function fetchPerformance(symbol) {
  // Fetch 1Y daily data to calculate performance periods
  var chartUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?range=1y&interval=1d';

  var chartRes = await fetch(chartUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!chartRes.ok) return null;

  var chartData = await chartRes.json();
  var result = chartData.chart && chartData.chart.result && chartData.chart.result[0];
  if (!result) return null;

  var closes = result.indicators && result.indicators.quote && result.indicators.quote[0]
    ? result.indicators.quote[0].close
    : [];
  var timestamps = result.timestamp || [];

  if (closes.length === 0) return null;

  var currentPrice = closes[closes.length - 1];
  var now = Date.now();

  function getPriceNDaysAgo(days) {
    var target = now - (days * 24 * 60 * 60 * 1000);
    var closest = null;
    var closestDiff = Infinity;
    for (var i = 0; i < timestamps.length; i++) {
      var diff = Math.abs((timestamps[i] * 1000) - target);
      if (diff < closestDiff && closes[i] != null) {
        closestDiff = diff;
        closest = closes[i];
      }
    }
    return closest;
  }

  function calcReturn(pastPrice) {
    if (!pastPrice || pastPrice === 0) return null;
    return ((currentPrice - pastPrice) / pastPrice * 100);
  }

  // Get YTD price (Jan 1 of current year)
  var jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
  var ytdPrice = null;
  var ytdDiff = Infinity;
  for (var i = 0; i < timestamps.length; i++) {
    var diff = Math.abs((timestamps[i] * 1000) - jan1);
    if (diff < ytdDiff && closes[i] != null) {
      ytdDiff = diff;
      ytdPrice = closes[i];
    }
  }

  return {
    '1W': calcReturn(getPriceNDaysAgo(7)),
    '1M': calcReturn(getPriceNDaysAgo(30)),
    '3M': calcReturn(getPriceNDaysAgo(90)),
    '6M': calcReturn(getPriceNDaysAgo(180)),
    'YTD': calcReturn(ytdPrice),
    '1Y': calcReturn(getPriceNDaysAgo(365)),
  };
}
