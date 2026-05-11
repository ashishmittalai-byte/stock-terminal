// pages/api/suggest.js
// ─────────────────────────────────────────────────────────
// Live stock search via Yahoo Finance (ALL 5000+ NSE/BSE)
// Falls back to static list if Yahoo is down.
// ─────────────────────────────────────────────────────────

// ─── Live Yahoo Finance search ───
async function searchYahoo(query) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query&multiQuoteQueryId=multi_quote_single_token_query&enableCb=false&enableNavLinks=false&enableEnhancedTrivialQuery=false&region=IN`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const data = await res.json();

    return (data.quotes || [])
      .filter(q =>
        q.quoteType === 'EQUITY' &&
        (q.symbol?.endsWith('.NS') || q.symbol?.endsWith('.BO'))
      )
      .map(q => ({
        name: q.longname || q.shortname || q.symbol,
        ticker: q.symbol.replace(/\.(NS|BO)$/, ''),
        sector: q.industry || q.sector || q.exchDisp || 'Equity',
        exchange: q.exchDisp || 'NSE',
      }))
      .filter((item, idx, arr) => arr.findIndex(x => x.ticker === item.ticker) === idx)
      .slice(0, 8);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Static fallback (top 120 popular stocks) ───
const P = [
  ["Reliance Industries","RELIANCE","Energy"],["TCS","TCS","IT"],["HDFC Bank","HDFCBANK","Banking"],
  ["Infosys","INFY","IT"],["ICICI Bank","ICICIBANK","Banking"],["Hindustan Unilever","HINDUNILVR","FMCG"],
  ["ITC","ITC","FMCG"],["SBI","SBIN","Banking"],["Bharti Airtel","BHARTIARTL","Telecom"],
  ["Kotak Mahindra Bank","KOTAKBANK","Banking"],["L&T","LT","Infra"],["Bajaj Finance","BAJFINANCE","NBFC"],
  ["Asian Paints","ASIANPAINT","Paints"],["Maruti Suzuki","MARUTI","Auto"],["HCL Tech","HCLTECH","IT"],
  ["Axis Bank","AXISBANK","Banking"],["Titan","TITAN","Consumer"],["Sun Pharma","SUNPHARMA","Pharma"],
  ["Wipro","WIPRO","IT"],["M&M","M&M","Auto"],["Tata Motors","TATAMOTORS","Auto"],
  ["NTPC","NTPC","Power"],["Power Grid","POWERGRID","Power"],["UltraTech Cement","ULTRACEMCO","Cement"],
  ["Nestle India","NESTLEIND","FMCG"],["Tech Mahindra","TECHM","IT"],["Adani Enterprises","ADANIENT","Conglomerate"],
  ["Tata Steel","TATASTEEL","Metals"],["JSW Steel","JSWSTEEL","Metals"],["Cipla","CIPLA","Pharma"],
  ["Dr. Reddy's","DRREDDY","Pharma"],["Britannia","BRITANNIA","FMCG"],["Coal India","COALINDIA","Mining"],
  ["BPCL","BPCL","Energy"],["Bajaj Auto","BAJAJ-AUTO","Auto"],["ONGC","ONGC","Energy"],
  ["Tata Consumer","TATACONSUM","FMCG"],["Apollo Hospitals","APOLLOHOSP","Healthcare"],["BEL","BEL","Defence"],
  ["Zomato","ZOMATO","Internet"],["LTIMindtree","LTIM","IT"],["Trent","TRENT","Retail"],
  ["DMart","DMART","Retail"],["Vedanta","VEDL","Mining"],["Tata Power","TATAPOWER","Power"],
  ["HAL","HAL","Defence"],["IRCTC","IRCTC","Railways"],["IRFC","IRFC","Railways"],
  ["RVNL","RVNL","Railways"],["NHPC","NHPC","Power"],["GAIL","GAIL","Gas"],["IOC","IOC","Energy"],
  ["SAIL","SAIL","Metals"],["REC","RECLTD","NBFC"],["PFC","PFC","NBFC"],["IREDA","IREDA","NBFC"],
  ["Bank of Baroda","BANKBARODA","Banking"],["Canara Bank","CANBK","Banking"],["PNB","PNB","Banking"],
  ["Bank of Maharashtra","MAHABANK","Banking"],["Union Bank","UNIONBANK","Banking"],
  ["Yes Bank","YESBANK","Banking"],["IDBI Bank","IDBI","Banking"],["Federal Bank","FEDERALBNK","Banking"],
  ["IndusInd Bank","INDUSINDBK","Banking"],["Bandhan Bank","BANDHANBNK","Banking"],
  ["Vodafone Idea","IDEA","Telecom"],["Jio Financial","JIOFIN","NBFC"],["DLF","DLF","Real Estate"],
  ["Polycab","POLYCAB","Electricals"],["Havells","HAVELLS","Electricals"],["Siemens","SIEMENS","Capital Goods"],
  ["ABB India","ABB","Capital Goods"],["LIC","LICI","Insurance"],["Lupin","LUPIN","Pharma"],
  ["Suzlon","SUZLON","Renewables"],["Tata Elxsi","TATAELXSI","IT"],["KPIT Tech","KPITTECH","IT"],
  ["Dixon Tech","DIXON","Electronics"],["Adani Power","ADANIPOWER","Power"],["Adani Green","ADANIGREEN","Renewables"],
  ["JSW Energy","JSWENERGY","Power"],["BHEL","BHEL","Capital Goods"],["Mazagon Dock","MAZDOCK","Defence"],
  ["Cochin Shipyard","COCHINSHIP","Defence"],["IndiGo","INDIGO","Aviation"],["MRF","MRF","Tyres"],
  ["Ashok Leyland","ASHOKLEY","Auto"],["TVS Motor","TVSMOTOR","Auto"],["Hero MotoCorp","HEROMOTOCO","Auto"],
  ["Godrej Properties","GODREJPROP","Real Estate"],["Pidilite","PIDILITIND","Chemicals"],
  ["SRF","SRF","Chemicals"],["Deepak Nitrite","DEEPAKNTR","Chemicals"],["Dabur","DABUR","FMCG"],
  ["Marico","MARICO","FMCG"],["Colgate","COLPAL","FMCG"],["BSE Ltd","BSE","Exchange"],
  ["MCX","MCX","Exchange"],["CDSL","CDSL","Depository"],["Angel One","ANGELONE","Broking"],
  ["Shree Cement","SHREECEM","Cement"],["Ambuja Cements","AMBUJACEM","Cement"],
  ["NBCC","NBCC","Infra"],["HUDCO","HUDCO","NBFC"],["CG Power","CGPOWER","Electricals"],
  ["Waaree Energies","WAAREEENER","Solar"],["Hindustan Copper","HINDCOPPER","Metals"],
  ["NALCO","NATIONALUM","Metals"],["Jindal Steel","JINDALSTEL","Metals"],
  ["Kalyan Jewellers","KALYANKJIL","Jewellery"],["Voltas","VOLTAS","Consumer Durables"],
  ["Crompton","CROMPTON","Electricals"],["Paytm","PAYTM","Fintech"],["Nykaa","NYKAA","E-Commerce"],
  ["PB Fintech","POLICYBZR","Fintech"],["Naukri","NAUKRI","Internet"],["Coforge","COFORGE","IT"],
  ["Mphasis","MPHASIS","IT"],["Persistent","PERSISTENT","IT"],["Tata Tech","TATATECH","IT"],
  ["Star Health","STARHEALTH","Insurance"],["ICICI Lombard","ICICIGI","Insurance"],
  ["HDFC AMC","HDFCAMC","AMC"],["Piramal Enterprises","PEL","Diversified"],
  ["Aditya Birla Capital","ABCAPITAL","NBFC"],["Grasim","GRASIM","Cement"],
  ["Torrent Power","TORNTPOWER","Power"],["Jubilant Foodworks","JUBLFOOD","QSR"],
  ["PVR INOX","PVRINOX","Media"],["Zee Entertainment","ZEEL","Media"],
].map(([name,ticker,sector]) => ({name,ticker,sector}));

function staticSearch(q) {
  const ql = q.toLowerCase();
  const words = ql.split(/\s+/);
  return P.map(s => {
    const nl = s.name.toLowerCase(), tl = s.ticker.toLowerCase();
    let sc = 0;
    if (tl === ql) sc += 10000;
    if (tl.startsWith(ql)) sc += 5000;
    if (nl.startsWith(ql)) sc += 4000;
    if (nl.includes(ql)) sc += 2000;
    if (tl.includes(ql)) sc += 3000;
    for (const w of words) { if (nl.includes(w)) sc += 500; if (tl.includes(w)) sc += 400; if (s.sector.toLowerCase().includes(w)) sc += 200; }
    const abbr = nl.split(/\s+/).map(w => w[0]).join('');
    if (abbr.includes(ql)) sc += 600;
    return { ...s, sc };
  }).filter(s => s.sc > 0).sort((a,b) => b.sc - a.sc).slice(0,8).map(({sc,...r}) => r);
}

// ─── Handler ───
export default async function handler(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(200).json({ suggestions: [] });

  // Try live Yahoo Finance first
  try {
    const results = await searchYahoo(q);
    if (results.length > 0) {
      return res.status(200).json({ suggestions: results });
    }
  } catch (e) {
    console.warn('[suggest] Yahoo failed:', e.message);
  }

  // Fallback to static
  return res.status(200).json({ suggestions: staticSearch(q) });
}
