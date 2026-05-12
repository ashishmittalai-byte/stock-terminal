// pages/api/tv-screener.js — Stock screener via TradingView Scanner API
// Real-time NSE/BSE data, sortable, filterable

var NIFTY50 = [
  'NSE:RELIANCE','NSE:TCS','NSE:HDFCBANK','NSE:INFY','NSE:ICICIBANK',
  'NSE:HINDUNILVR','NSE:ITC','NSE:SBIN','NSE:BHARTIARTL','NSE:KOTAKBANK',
  'NSE:LT','NSE:AXISBANK','NSE:BAJFINANCE','NSE:ASIANPAINT','NSE:MARUTI',
  'NSE:TATAMOTORS','NSE:SUNPHARMA','NSE:TITAN','NSE:WIPRO','NSE:ULTRACEMCO',
];

var BANKNIFTY = [
  'NSE:HDFCBANK','NSE:ICICIBANK','NSE:SBIN','NSE:KOTAKBANK','NSE:AXISBANK',
  'NSE:INDUSINDBK','NSE:BANKBARODA','NSE:PNB','NSE:FEDERALBNK','NSE:IDFCFIRSTB',
  'NSE:AUBANK','NSE:BANDHANBNK',
];

var NIFTYIT = [
  'NSE:TCS','NSE:INFY','NSE:WIPRO','NSE:HCLTECH','NSE:TECHM',
  'NSE:LTIM','NSE:MPHASIS','NSE:PERSISTENT','NSE:COFORGE','NSE:LTTS',
];

var INDEX_MAP = {
  nifty50: NIFTY50,
  banknifty: BANKNIFTY,
  niftyit: NIFTYIT,
};

var COLUMNS = [
  'name', 'description', 'close', 'change', 'change_abs',
  'volume', 'relative_volume_10d_calc', 'market_cap_basic',
  'price_earnings_ttm', 'earnings_per_share_basic_ttm',
  'earnings_per_share_forecast_next_fq', 'dividend_yield_recent',
  'sector', 'high', 'low', 'price_52_week_high', 'price_52_week_low',
  'open', 'prev_close_price', 'Recommend.All',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  var index = (req.query.index || 'nifty50').toLowerCase();
  var tickers = INDEX_MAP[index] || NIFTY50;

  try {
    var response = await fetch('https://scanner.tradingview.com/india/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        symbols: { tickers: tickers },
        columns: COLUMNS,
      }),
    });

    if (!response.ok) {
      throw new Error('TradingView returned ' + response.status);
    }

    var data = await response.json();
    var rows = (data && data.data) || [];

    var results = rows.map(function(row) {
      var d = {};
      for (var i = 0; i < COLUMNS.length; i++) {
        d[COLUMNS[i]] = row.d[i];
      }

      var recVal = d['Recommend.All'];
      var rating = '—';
      if (recVal != null) {
        if (recVal >= 0.5) rating = 'Strong Buy';
        else if (recVal >= 0.1) rating = 'Buy';
        else if (recVal > -0.1) rating = 'Neutral';
        else if (recVal > -0.5) rating = 'Sell';
        else rating = 'Strong Sell';
      }

      return {
        symbol: d.name || (row.s || '').split(':')[1] || '',
        name: d.description || d.name || '',
        price: d.close || 0,
        change: d.change_abs || 0,
        changePct: d.change || 0,
        volume: d.volume || 0,
        relVolume: d.relative_volume_10d_calc || 0,
        marketCap: d.market_cap_basic || 0,
        pe: d.price_earnings_ttm || null,
        eps: d.earnings_per_share_basic_ttm || null,
        divYield: d.dividend_yield_recent || null,
        sector: d.sector || '—',
        dayHigh: d.high || 0,
        dayLow: d.low || 0,
        open: d.open || 0,
        prevClose: d.prev_close_price || 0,
        weekHigh52: d.price_52_week_high || 0,
        weekLow52: d.price_52_week_low || 0,
        rating: rating,
        ratingValue: recVal,
        exchange: (row.s || '').split(':')[0] || 'NSE',
      };
    });

    // Sort by market cap descending
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
