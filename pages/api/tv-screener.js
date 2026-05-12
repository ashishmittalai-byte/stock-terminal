// pages/api/tv-screener.js — Stock screener via NSE India API
// Returns top stocks with live price data from NSE

var NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

var INDEX_MAP = {
  nifty50: 'NIFTY%2050',
  banknifty: 'NIFTY%20BANK',
  niftyit: 'NIFTY%20IT',
};

// Sector mapping for common NSE stocks
var SECTORS = {
  RELIANCE: 'Energy', TCS: 'IT', HDFCBANK: 'Banking', INFY: 'IT',
  ICICIBANK: 'Banking', HINDUNILVR: 'FMCG', ITC: 'FMCG', SBIN: 'Banking',
  BHARTIARTL: 'Telecom', KOTAKBANK: 'Banking', LT: 'Infra', AXISBANK: 'Banking',
  BAJFINANCE: 'NBFC', ASIANPAINT: 'Paints', MARUTI: 'Auto', TATAMOTORS: 'Auto',
  SUNPHARMA: 'Pharma', TITAN: 'Consumer', WIPRO: 'IT', ULTRACEMCO: 'Cement',
  HCLTECH: 'IT', TECHM: 'IT', LTIM: 'IT', MPHASIS: 'IT', PERSISTENT: 'IT',
  COFORGE: 'IT', LTTS: 'IT', INDUSINDBK: 'Banking', BANKBARODA: 'Banking',
  PNB: 'Banking', FEDERALBNK: 'Banking', IDFCFIRSTB: 'Banking', AUBANK: 'Banking',
  BANDHANBNK: 'Banking', BAJAJFINSV: 'NBFC', NESTLEIND: 'FMCG',
  POWERGRID: 'Power', NTPC: 'Power', ONGC: 'Energy', COALINDIA: 'Mining',
  TATASTEEL: 'Metals', JSWSTEEL: 'Metals', HINDALCO: 'Metals',
  ADANIENT: 'Conglomerate', ADANIPORTS: 'Infra',
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
    if (typeof res.headers.getSetCookie === 'function') {
      cookieStr = res.headers.getSetCookie().map(function(c) { return c.split(';')[0]; }).join('; ');
    }
  } catch (e) {}
  if (!cookieStr) {
    var raw = res.headers.get('set-cookie') || '';
    var cookies = [];
    var re = /(nsit|nseappid|ak_bmsc|bm_sv|bm_sz|bm_mi|_abck|AKA_A2)=([^;]+)/g;
    var m;
    while ((m = re.exec(raw)) !== null) { cookies.push(m[1] + '=' + m[2]); }
    cookieStr = cookies.join('; ');
  }
  return cookieStr;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  var index = (req.query.index || 'nifty50').toLowerCase();
  var nseIndex = INDEX_MAP[index] || INDEX_MAP.nifty50;

  try {
    var cookies = await getNSECookies();
    if (!cookies) throw new Error('Could not establish NSE session');

    var apiRes = await fetch(
      'https://www.nseindia.com/api/equity-stockIndices?index=' + nseIndex,
      {
        headers: Object.assign({}, NSE_HEADERS, {
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.nseindia.com/',
          'Cookie': cookies,
        }),
      }
    );

    if (!apiRes.ok) throw new Error('NSE returned ' + apiRes.status);

    var data = await apiRes.json();
    var rows = (data && data.data) || [];

    // Decode index name for filtering
    var indexName = decodeURIComponent(nseIndex);

    var results = [];
    rows.forEach(function(s) {
      if (!s.symbol || s.symbol === indexName) return; // skip the index row itself

      var pe = null;
      if (s.perChange365d && s.lastPrice) {
        // NSE doesn't directly give P/E, but we can derive from meta if available
        pe = s.pe || null;
      }

      results.push({
        symbol: s.symbol,
        name: s.meta && s.meta.companyName ? s.meta.companyName : s.symbol,
        price: s.lastPrice || 0,
        change: s.change || 0,
        changePct: s.pChange || 0,
        volume: s.totalTradedVolume || 0,
        relVolume: 0, // NSE doesn't provide this directly
        marketCap: 0, // NSE index API doesn't include market cap
        pe: pe,
        eps: null,
        divYield: null,
        sector: SECTORS[s.symbol] || '—',
        dayHigh: s.dayHigh || 0,
        dayLow: s.dayLow || 0,
        open: s.open || 0,
        prevClose: s.previousClose || 0,
        weekHigh52: s.yearHigh || 0,
        weekLow52: s.yearLow || 0,
        rating: null,
        ratingValue: null,
        exchange: 'NSE',
      });
    });

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
