// pages/api/suggest.js
// ──────────────────────────────────────────────────────────
// Stock Suggestion API — LIVE search via Yahoo Finance
// Covers ALL 5,000+ NSE & BSE listed stocks.
// Falls back to static list if Yahoo is down.
// ──────────────────────────────────────────────────────────

export const config = { runtime: 'edge' };

// ─── Live search via Yahoo Finance (all Indian stocks) ───
async function searchYahoo(query) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query&multiQuoteQueryId=multi_quote_single_token_query&enableCb=false&enableNavLinks=false&enableEnhancedTrivialQuery=false&region=IN`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000); // 3s timeout

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
        sector: q.industry || q.sector || (q.exchDisp === 'NSE' ? 'NSE' : 'BSE'),
        exchange: q.exchDisp || 'NSE',
      }))
      // Deduplicate by ticker (prefer NSE over BSE)
      .filter((item, idx, arr) => arr.findIndex(x => x.ticker === item.ticker) === idx)
      .slice(0, 8);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Static fallback: top 200 popular stocks ───
const POPULAR = [
  { name:"Reliance Industries",ticker:"RELIANCE",sector:"Energy" },
  { name:"Tata Consultancy Services",ticker:"TCS",sector:"IT" },
  { name:"HDFC Bank",ticker:"HDFCBANK",sector:"Banking" },
  { name:"Infosys",ticker:"INFY",sector:"IT" },
  { name:"ICICI Bank",ticker:"ICICIBANK",sector:"Banking" },
  { name:"Hindustan Unilever",ticker:"HINDUNILVR",sector:"FMCG" },
  { name:"ITC",ticker:"ITC",sector:"FMCG" },
  { name:"State Bank of India",ticker:"SBIN",sector:"Banking" },
  { name:"Bharti Airtel",ticker:"BHARTIARTL",sector:"Telecom" },
  { name:"Kotak Mahindra Bank",ticker:"KOTAKBANK",sector:"Banking" },
  { name:"Larsen & Toubro",ticker:"LT",sector:"Infrastructure" },
  { name:"Bajaj Finance",ticker:"BAJFINANCE",sector:"NBFC" },
  { name:"Asian Paints",ticker:"ASIANPAINT",sector:"Paints" },
  { name:"Maruti Suzuki",ticker:"MARUTI",sector:"Auto" },
  { name:"HCL Technologies",ticker:"HCLTECH",sector:"IT" },
  { name:"Axis Bank",ticker:"AXISBANK",sector:"Banking" },
  { name:"Titan Company",ticker:"TITAN",sector:"Consumer" },
  { name:"Sun Pharmaceutical",ticker:"SUNPHARMA",sector:"Pharma" },
  { name:"Bajaj Finserv",ticker:"BAJAJFINSV",sector:"NBFC" },
  { name:"Wipro",ticker:"WIPRO",sector:"IT" },
  { name:"Mahindra & Mahindra",ticker:"M&M",sector:"Auto" },
  { name:"Tata Motors",ticker:"TATAMOTORS",sector:"Auto" },
  { name:"NTPC",ticker:"NTPC",sector:"Power" },
  { name:"Power Grid Corporation",ticker:"POWERGRID",sector:"Power" },
  { name:"UltraTech Cement",ticker:"ULTRACEMCO",sector:"Cement" },
  { name:"Nestle India",ticker:"NESTLEIND",sector:"FMCG" },
  { name:"Tech Mahindra",ticker:"TECHM",sector:"IT" },
  { name:"Adani Enterprises",ticker:"ADANIENT",sector:"Conglomerate" },
  { name:"Adani Ports",ticker:"ADANIPORTS",sector:"Infrastructure" },
  { name:"Tata Steel",ticker:"TATASTEEL",sector:"Metals" },
  { name:"JSW Steel",ticker:"JSWSTEEL",sector:"Metals" },
  { name:"Cipla",ticker:"CIPLA",sector:"Pharma" },
  { name:"Dr. Reddy's Laboratories",ticker:"DRREDDY",sector:"Pharma" },
  { name:"Eicher Motors",ticker:"EICHERMOT",sector:"Auto" },
  { name:"Britannia Industries",ticker:"BRITANNIA",sector:"FMCG" },
  { name:"Coal India",ticker:"COALINDIA",sector:"Mining" },
  { name:"BPCL",ticker:"BPCL",sector:"Energy" },
  { name:"Hindalco Industries",ticker:"HINDALCO",sector:"Metals" },
  { name:"SBI Life Insurance",ticker:"SBILIFE",sector:"Insurance" },
  { name:"Bajaj Auto",ticker:"BAJAJ-AUTO",sector:"Auto" },
  { name:"ONGC",ticker:"ONGC",sector:"Energy" },
  { name:"Tata Consumer Products",ticker:"TATACONSUM",sector:"FMCG" },
  { name:"Apollo Hospitals",ticker:"APOLLOHOSP",sector:"Healthcare" },
  { name:"Bharat Electronics",ticker:"BEL",sector:"Defence" },
  { name:"Zomato",ticker:"ZOMATO",sector:"Internet" },
  { name:"Paytm",ticker:"PAYTM",sector:"Fintech" },
  { name:"Nykaa",ticker:"NYKAA",sector:"E-Commerce" },
  { name:"LTIMindtree",ticker:"LTIM",sector:"IT" },
  { name:"Persistent Systems",ticker:"PERSISTENT",sector:"IT" },
  { name:"Trent",ticker:"TRENT",sector:"Retail" },
  { name:"Avenue Supermarts (DMart)",ticker:"DMART",sector:"Retail" },
  { name:"Dixon Technologies",ticker:"DIXON",sector:"Electronics" },
  { name:"Varun Beverages",ticker:"VBL",sector:"FMCG" },
  { name:"Vedanta",ticker:"VEDL",sector:"Mining" },
  { name:"Tata Power",ticker:"TATAPOWER",sector:"Power" },
  { name:"Adani Green Energy",ticker:"ADANIGREEN",sector:"Renewables" },
  { name:"HAL",ticker:"HAL",sector:"Defence" },
  { name:"Mazagon Dock",ticker:"MAZDOCK",sector:"Defence" },
  { name:"Cochin Shipyard",ticker:"COCHINSHIP",sector:"Defence" },
  { name:"IRCTC",ticker:"IRCTC",sector:"Railways" },
  { name:"IRFC",ticker:"IRFC",sector:"Railways" },
  { name:"RVNL",ticker:"RVNL",sector:"Railways" },
  { name:"NHPC",ticker:"NHPC",sector:"Power" },
  { name:"GAIL India",ticker:"GAIL",sector:"Gas" },
  { name:"Indian Oil Corporation",ticker:"IOC",sector:"Energy" },
  { name:"NMDC",ticker:"NMDC",sector:"Mining" },
  { name:"SAIL",ticker:"SAIL",sector:"Metals" },
  { name:"REC Ltd",ticker:"RECLTD",sector:"NBFC" },
  { name:"Power Finance Corporation",ticker:"PFC",sector:"NBFC" },
  { name:"IREDA",ticker:"IREDA",sector:"NBFC" },
  { name:"Muthoot Finance",ticker:"MUTHOOTFIN",sector:"NBFC" },
  { name:"Cholamandalam",ticker:"CHOLAFIN",sector:"NBFC" },
  { name:"Bank of Baroda",ticker:"BANKBARODA",sector:"Banking" },
  { name:"Canara Bank",ticker:"CANBK",sector:"Banking" },
  { name:"Punjab National Bank",ticker:"PNB",sector:"Banking" },
  { name:"Bank of Maharashtra",ticker:"MAHABANK",sector:"Banking" },
  { name:"Union Bank of India",ticker:"UNIONBANK",sector:"Banking" },
  { name:"Indian Bank",ticker:"INDIANB",sector:"Banking" },
  { name:"Yes Bank",ticker:"YESBANK",sector:"Banking" },
  { name:"IDBI Bank",ticker:"IDBI",sector:"Banking" },
  { name:"Federal Bank",ticker:"FEDERALBNK",sector:"Banking" },
  { name:"IDFC First Bank",ticker:"IDFCFIRSTB",sector:"Banking" },
  { name:"Bandhan Bank",ticker:"BANDHANBNK",sector:"Banking" },
  { name:"IndusInd Bank",ticker:"INDUSINDBK",sector:"Banking" },
  { name:"AU Small Finance Bank",ticker:"AUBANK",sector:"Banking" },
  { name:"Vodafone Idea",ticker:"IDEA",sector:"Telecom" },
  { name:"Jio Financial Services",ticker:"JIOFIN",sector:"NBFC" },
  { name:"DLF",ticker:"DLF",sector:"Real Estate" },
  { name:"Godrej Properties",ticker:"GODREJPROP",sector:"Real Estate" },
  { name:"Prestige Estates",ticker:"PRESTIGE",sector:"Real Estate" },
  { name:"Macrotech (Lodha)",ticker:"LODHA",sector:"Real Estate" },
  { name:"Polycab India",ticker:"POLYCAB",sector:"Electricals" },
  { name:"Havells India",ticker:"HAVELLS",sector:"Electricals" },
  { name:"Siemens",ticker:"SIEMENS",sector:"Capital Goods" },
  { name:"ABB India",ticker:"ABB",sector:"Capital Goods" },
  { name:"LIC",ticker:"LICI",sector:"Insurance" },
  { name:"Max Healthcare",ticker:"MAXHEALTH",sector:"Healthcare" },
  { name:"Fortis Healthcare",ticker:"FORTIS",sector:"Healthcare" },
  { name:"Lupin",ticker:"LUPIN",sector:"Pharma" },
  { name:"Biocon",ticker:"BIOCON",sector:"Pharma" },
  { name:"PI Industries",ticker:"PIIND",sector:"Chemicals" },
  { name:"SRF",ticker:"SRF",sector:"Chemicals" },
  { name:"Deepak Nitrite",ticker:"DEEPAKNTR",sector:"Chemicals" },
  { name:"InterGlobe Aviation (IndiGo)",ticker:"INDIGO",sector:"Aviation" },
  { name:"Suzlon Energy",ticker:"SUZLON",sector:"Renewables" },
  { name:"Tata Technologies",ticker:"TATATECH",sector:"IT" },
  { name:"Tata Elxsi",ticker:"TATAELXSI",sector:"IT" },
  { name:"KPIT Technologies",ticker:"KPITTECH",sector:"IT" },
  { name:"Jubilant Foodworks",ticker:"JUBLFOOD",sector:"QSR" },
  { name:"Kalyan Jewellers",ticker:"KALYANKJIL",sector:"Jewellery" },
  { name:"BSE Ltd",ticker:"BSE",sector:"Exchange" },
  { name:"MCX",ticker:"MCX",sector:"Exchange" },
  { name:"CDSL",ticker:"CDSL",sector:"Depository" },
  { name:"Angel One",ticker:"ANGELONE",sector:"Broking" },
  { name:"Shree Cement",ticker:"SHREECEM",sector:"Cement" },
  { name:"Ambuja Cements",ticker:"AMBUJACEM",sector:"Cement" },
  { name:"ACC",ticker:"ACC",sector:"Cement" },
  { name:"MRF",ticker:"MRF",sector:"Tyres" },
  { name:"Ashok Leyland",ticker:"ASHOKLEY",sector:"Auto" },
  { name:"TVS Motor",ticker:"TVSMOTOR",sector:"Auto" },
  { name:"Hero MotoCorp",ticker:"HEROMOTOCO",sector:"Auto" },
  { name:"Bosch",ticker:"BOSCHLTD",sector:"Auto Ancillary" },
  { name:"Motherson Sumi",ticker:"MOTHERSON",sector:"Auto Ancillary" },
  { name:"Voltas",ticker:"VOLTAS",sector:"Consumer Durables" },
  { name:"Crompton Greaves",ticker:"CROMPTON",sector:"Electricals" },
  { name:"CG Power",ticker:"CGPOWER",sector:"Electricals" },
  { name:"Bharat Forge",ticker:"BHARATFORG",sector:"Auto Ancillary" },
  { name:"BHEL",ticker:"BHEL",sector:"Capital Goods" },
  { name:"Hindustan Copper",ticker:"HINDCOPPER",sector:"Metals" },
  { name:"NALCO",ticker:"NATIONALUM",sector:"Metals" },
  { name:"Jindal Steel & Power",ticker:"JINDALSTEL",sector:"Metals" },
  { name:"Waaree Energies",ticker:"WAAREEENER",sector:"Solar" },
  { name:"Adani Power",ticker:"ADANIPOWER",sector:"Power" },
  { name:"JSW Energy",ticker:"JSWENERGY",sector:"Power" },
  { name:"Torrent Power",ticker:"TORNTPOWER",sector:"Power" },
  { name:"NBCC India",ticker:"NBCC",sector:"Infrastructure" },
  { name:"HUDCO",ticker:"HUDCO",sector:"NBFC" },
  { name:"Raymond",ticker:"RAYMOND",sector:"Textiles" },
  { name:"Page Industries",ticker:"PAGEIND",sector:"Textiles" },
  { name:"Dabur India",ticker:"DABUR",sector:"FMCG" },
  { name:"Marico",ticker:"MARICO",sector:"FMCG" },
  { name:"Colgate-Palmolive India",ticker:"COLPAL",sector:"FMCG" },
  { name:"Godrej Consumer Products",ticker:"GODREJCP",sector:"FMCG" },
  { name:"Pidilite Industries",ticker:"PIDILITIND",sector:"Chemicals" },
  { name:"Berger Paints",ticker:"BERGEPAINT",sector:"Paints" },
  { name:"Astral",ticker:"ASTRAL",sector:"Pipes" },
  { name:"Indraprastha Gas",ticker:"IGL",sector:"Gas" },
  { name:"Petronet LNG",ticker:"PETRONET",sector:"Gas" },
  { name:"Gujarat Gas",ticker:"GUJGASLTD",sector:"Gas" },
  { name:"IEX",ticker:"IEX",sector:"Exchange" },
  { name:"Ola Electric",ticker:"OLAELEC",sector:"EV" },
  { name:"PVR INOX",ticker:"PVRINOX",sector:"Media" },
  { name:"Zee Entertainment",ticker:"ZEEL",sector:"Media" },
  { name:"Info Edge (Naukri)",ticker:"NAUKRI",sector:"Internet" },
  { name:"PB Fintech (Policybazaar)",ticker:"POLICYBZR",sector:"Fintech" },
  { name:"Delhivery",ticker:"DELHIVERY",sector:"Logistics" },
  { name:"Coforge",ticker:"COFORGE",sector:"IT" },
  { name:"Mphasis",ticker:"MPHASIS",sector:"IT" },
  { name:"Piramal Enterprises",ticker:"PEL",sector:"Diversified" },
  { name:"Aditya Birla Capital",ticker:"ABCAPITAL",sector:"NBFC" },
  { name:"HDFC AMC",ticker:"HDFCAMC",sector:"AMC" },
  { name:"Star Health Insurance",ticker:"STARHEALTH",sector:"Insurance" },
  { name:"ICICI Lombard",ticker:"ICICIGI",sector:"Insurance" },
  { name:"Grasim Industries",ticker:"GRASIM",sector:"Cement" },
];

// ─── Static fuzzy search fallback ───
function staticSearch(query) {
  const q = query.toLowerCase();
  const words = q.split(/\s+/);

  return POPULAR
    .map(s => {
      const name = s.name.toLowerCase();
      const ticker = s.ticker.toLowerCase();
      let score = 0;
      if (ticker === q) score += 10000;
      if (ticker.startsWith(q)) score += 5000;
      if (name.startsWith(q)) score += 4000;
      if (name.includes(q)) score += 2000;
      if (ticker.includes(q)) score += 3000;
      for (const w of words) {
        if (name.includes(w)) score += 500;
        if (ticker.includes(w)) score += 400;
        if (s.sector.toLowerCase().includes(w)) score += 200;
      }
      // Abbreviation match
      const abbr = name.split(/\s+/).map(w => w[0]).join('');
      if (abbr.includes(q)) score += 600;
      return { ...s, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score, ...rest }) => rest);
}

// ─── Edge handler ───
export default async function handler(req) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();

  if (!q || q.length < 1) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Try live Yahoo Finance search first (covers ALL 5000+ stocks)
  try {
    const results = await searchYahoo(q);
    if (results.length > 0) {
      return new Response(JSON.stringify({ suggestions: results }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    console.warn('[suggest] Yahoo search failed, using static fallback:', e.message);
  }

  // Fallback to static list
  const results = staticSearch(q);
  return new Response(JSON.stringify({ suggestions: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
