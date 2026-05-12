// pages/api/market.js — Live market data via TradingView Scanner API
// Reliable server-side access, no auth needed, real-time Indian market data

var INDEX_TICKERS = [
  { tv: 'NSE:NIFTY', short: 'NIFTY', label: 'Nifty 50', exchange: 'NSE' },
  { tv: 'NSE:BANKNIFTY', short: 'BANKNIFTY', label: 'Bank Nifty', exchange: 'NSE' },
  { tv: 'BSE:SENSEX', short: 'SENSEX', label: 'Sensex', exchange: 'BSE' },
  { tv: 'NSE:CNXIT', short: 'CNXIT', label: 'Nifty IT', exchange: 'NSE' },
];

var DEFAULT_STOCK_TICKERS = [
  'NSE:RELIANCE', 'NSE:HDFCBANK', 'NSE:ICICIBANK', 'NSE:TCS', 'NSE:INFY',
];

var TV_COLUMNS = [
  'name', 'description', 'close', 'change', 'change_abs',
  'open', 'high', 'low', 'prev_close_price', 'volume',
  'market_cap_basic', 'price_52_week_high', 'price_52_week_low',
  'exchange', 'currency',
];

var PERF_COLUMNS = [
  'name', 'close', 'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.YTD', 'Perf.Y',
];

async function tvScan(tickers, columns) {
  var res = await fetch('https://scanner.tradingview.com/india/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      symbols: { tickers: tickers },
      columns: columns,
    }),
  });
  if (!res.ok) throw new Error('TradingView returned ' + res.status);
  return res.json();
}

function mapRow(cols, values) {
  var obj = {};
  for (var i = 0; i < cols.length; i++) {
    obj[cols[i]] = values[i];
  }
  return obj;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  var customSymbols = req.query.symbols;
  var detail = req.query.detail;

  try {
    // Build ticker lists
    var indexTickers = INDEX_TICKERS.map(function(i) { return i.tv; });
    var stockTickers = customSymbols
      ? customSymbols.split(',').map(function(s) {
          s = s.trim();
          if (s.indexOf(':') === -1) return 'NSE:' + s.replace('.NS', '').replace('.BO', '');
          return s;
        })
      : DEFAULT_STOCK_TICKERS;

    var allTickers = indexTickers.concat(stockTickers);

    var data = await tvScan(allTickers, TV_COLUMNS);
    var rows = (data && data.data) || [];

    var indices = [];
    var stocks = [];

    rows.forEach(function(row) {
      var d = mapRow(TV_COLUMNS, row.d);
      var tvSymbol = row.s || '';

      var item = {
        symbol: tvSymbol,
        name: d.description || d.name || '',
        short: d.name || tvSymbol.split(':')[1] || '',
        price: d.close || 0,
        change: d.change_abs || 0,
        changePercent: d.change || 0,
        prevClose: d.prev_close_price || 0,
        dayHigh: d.high || 0,
        dayLow: d.low || 0,
        volume: d.volume || 0,
        marketCap: d.market_cap_basic || 0,
        fiftyTwoWeekHigh: d.price_52_week_high || 0,
        fiftyTwoWeekLow: d.price_52_week_low || 0,
        exchange: d.exchange || tvSymbol.split(':')[0] || 'NSE',
        currency: d.currency || 'INR',
        marketState: 'CLOSED', // will be updated below
      };

      // Check if this is an index
      var isIndex = false;
      for (var i = 0; i < INDEX_TICKERS.length; i++) {
        if (INDEX_TICKERS[i].tv === tvSymbol) {
          item.label = INDEX_TICKERS[i].label;
          item.short = INDEX_TICKERS[i].short;
          isIndex = true;
          break;
        }
      }

      if (isIndex) indices.push(item);
      else stocks.push(item);
    });

    // Determine market state (NSE: Mon-Fri 9:15-15:30 IST)
    var now = new Date();
    var istOffset = 5.5 * 60 * 60 * 1000;
    var ist = new Date(now.getTime() + istOffset);
    var day = ist.getUTCDay();
    var hours = ist.getUTCHours();
    var mins = ist.getUTCMinutes();
    var timeNum = hours * 100 + mins;
    var isOpen = day >= 1 && day <= 5 && timeNum >= 915 && timeNum <= 1530;
    var mktState = isOpen ? 'REGULAR' : 'CLOSED';

    // Apply market state
    indices.forEach(function(item) { item.marketState = mktState; });
    stocks.forEach(function(item) { item.marketState = mktState; });

    // Performance data if requested
    var performance = null;
    if (detail) {
      try {
        var perfData = await tvScan([detail], PERF_COLUMNS);
        if (perfData && perfData.data && perfData.data[0]) {
          var p = mapRow(PERF_COLUMNS, perfData.data[0].d);
          performance = {
            '1W': p['Perf.W'] || null,
            '1M': p['Perf.1M'] || null,
            '3M': p['Perf.3M'] || null,
            '6M': p['Perf.6M'] || null,
            'YTD': p['Perf.YTD'] || null,
            '1Y': p['Perf.Y'] || null,
          };
        }
      } catch (e) { performance = null; }
    }

    return res.status(200).json({
      indices: indices,
      stocks: stocks,
      performance: performance,
      marketState: mktState,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Market API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch market data' });
  }
}
