// pages/api/market.js — Live market data via NSE India API
// Uses cookie-based session for official NSE data

var NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

async function getNSECookies() {
  var res = await fetch('https://www.nseindia.com/', {
    headers: Object.assign({}, NSE_HEADERS, {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }),
    redirect: 'follow',
  });
  var cookieStr = '';
  try {
    // Node.js 18+ getSetCookie()
    if (typeof res.headers.getSetCookie === 'function') {
      cookieStr = res.headers.getSetCookie().map(function(c) { return c.split(';')[0]; }).join('; ');
    }
  } catch (e) {}
  if (!cookieStr) {
    // Fallback: parse raw set-cookie header
    var raw = res.headers.get('set-cookie') || '';
    var cookies = [];
    var re = /(nsit|nseappid|ak_bmsc|bm_sv|bm_sz|bm_mi|_abck|AKA_A2)=([^;]+)/g;
    var m;
    while ((m = re.exec(raw)) !== null) { cookies.push(m[1] + '=' + m[2]); }
    cookieStr = cookies.join('; ');
  }
  return cookieStr;
}

async function nseAPI(path, cookies) {
  var res = await fetch('https://www.nseindia.com' + path, {
    headers: Object.assign({}, NSE_HEADERS, {
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://www.nseindia.com/',
      'Cookie': cookies,
    }),
  });
  if (!res.ok) throw new Error('NSE returned ' + res.status);
  return res.json();
}

var WANTED_INDICES = {
  'NIFTY 50': { short: 'NIFTY', label: 'Nifty 50' },
  'NIFTY BANK': { short: 'BANKNIFTY', label: 'Bank Nifty' },
  'NIFTY IT': { short: 'CNXIT', label: 'Nifty IT' },
  'SENSEX': { short: 'SENSEX', label: 'Sensex' },
  'S&P BSE SENSEX': { short: 'SENSEX', label: 'Sensex' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  var detail = req.query.detail;

  try {
    var cookies = await getNSECookies();
    if (!cookies) throw new Error('Could not establish NSE session');

    // Fetch all indices
    var allIndices = await nseAPI('/api/allIndices', cookies);
    var indexData = (allIndices && allIndices.data) || [];

    var indices = [];
    indexData.forEach(function(idx) {
      var key = idx.indexSymbol || idx.key || idx.index || '';
      var config = WANTED_INDICES[key];
      if (!config) return;
      // Skip duplicates (SENSEX might appear as both)
      if (indices.some(function(i) { return i.short === config.short; })) return;
      indices.push({
        symbol: key,
        short: config.short,
        label: config.label,
        name: key,
        price: idx.last || idx.closePrice || 0,
        change: idx.variation || 0,
        changePercent: idx.percentChange || 0,
        prevClose: idx.previousClose || 0,
        dayHigh: idx.high || 0,
        dayLow: idx.low || 0,
        open: idx.open || 0,
        fiftyTwoWeekHigh: idx.yearHigh || 0,
        fiftyTwoWeekLow: idx.yearLow || 0,
        volume: 0,
        marketCap: 0,
        exchange: key.indexOf('BSE') >= 0 || key === 'SENSEX' ? 'BSE' : 'NSE',
        currency: 'INR',
        marketState: 'CLOSED',
      });
    });

    // Determine market state (NSE: Mon-Fri 9:15-15:30 IST)
    var now = new Date();
    var ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    var day = ist.getUTCDay();
    var timeNum = ist.getUTCHours() * 100 + ist.getUTCMinutes();
    var isOpen = day >= 1 && day <= 5 && timeNum >= 915 && timeNum <= 1530;
    var mktState = isOpen ? 'REGULAR' : 'CLOSED';
    indices.forEach(function(item) { item.marketState = mktState; });

    // Fetch Nifty 50 stocks for sidebar (top 5 by default)
    var stocks = [];
    try {
      var niftyData = await nseAPI('/api/equity-stockIndices?index=NIFTY%2050', cookies);
      var stockRows = (niftyData && niftyData.data) || [];
      // Take top 5 by traded volume or just first 5 non-index rows
      var stockCount = 0;
      for (var i = 0; i < stockRows.length && stockCount < 5; i++) {
        var s = stockRows[i];
        if (!s.symbol || s.symbol === 'NIFTY 50') continue;
        stocks.push({
          symbol: 'NSE:' + s.symbol,
          short: s.symbol,
          label: s.symbol,
          name: s.symbol,
          price: s.lastPrice || 0,
          change: s.change || 0,
          changePercent: s.pChange || 0,
          prevClose: s.previousClose || 0,
          dayHigh: s.dayHigh || 0,
          dayLow: s.dayLow || 0,
          open: s.open || 0,
          volume: s.totalTradedVolume || 0,
          marketCap: 0,
          fiftyTwoWeekHigh: s.yearHigh || 0,
          fiftyTwoWeekLow: s.yearLow || 0,
          exchange: 'NSE',
          currency: 'INR',
          marketState: mktState,
        });
        stockCount++;
      }
    } catch (e) { /* stocks section optional */ }

    // Performance data if detail symbol requested
    var performance = null;
    if (detail) {
      try {
        // Use Yahoo Finance v8 chart for performance (more reliable for historical)
        var chartUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
          encodeURIComponent(detail.replace('NSE:', '') + '.NS') + '?range=1y&interval=1d';
        var chartRes = await fetch(chartUrl, { headers: { 'User-Agent': NSE_HEADERS['User-Agent'] } });
        if (chartRes.ok) {
          var chartJson = await chartRes.json();
          var result = chartJson.chart && chartJson.chart.result && chartJson.chart.result[0];
          if (result) {
            var closes = (result.indicators && result.indicators.quote && result.indicators.quote[0]) ? result.indicators.quote[0].close : [];
            var timestamps = result.timestamp || [];
            if (closes.length > 0) {
              var curPrice = closes[closes.length - 1];
              var nowMs = Date.now();
              function getPriceAgo(days) {
                var target = nowMs - (days * 86400000);
                var best = null, bestDiff = Infinity;
                for (var j = 0; j < timestamps.length; j++) {
                  var diff = Math.abs((timestamps[j] * 1000) - target);
                  if (diff < bestDiff && closes[j] != null) { bestDiff = diff; best = closes[j]; }
                }
                return best;
              }
              function calcRet(past) { return (!past || past === 0) ? null : ((curPrice - past) / past * 100); }
              var jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
              var ytdP = null, ytdD = Infinity;
              for (var k = 0; k < timestamps.length; k++) {
                var dd = Math.abs((timestamps[k] * 1000) - jan1);
                if (dd < ytdD && closes[k] != null) { ytdD = dd; ytdP = closes[k]; }
              }
              performance = {
                '1W': calcRet(getPriceAgo(7)), '1M': calcRet(getPriceAgo(30)),
                '3M': calcRet(getPriceAgo(90)), '6M': calcRet(getPriceAgo(180)),
                'YTD': calcRet(ytdP), '1Y': calcRet(getPriceAgo(365)),
              };
            }
          }
        }
      } catch (e) { performance = null; }
    }

    return res.status(200).json({
      indices: indices, stocks: stocks, performance: performance,
      marketState: mktState, timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Market API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch market data' });
  }
}
