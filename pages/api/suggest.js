// pages/api/suggest.js
// ──────────────────────────────────────────────────────────────
// Stock Suggestion API — fuzzy-matches against 500+ NSE/BSE stocks
// Returns up to 8 suggestions ranked by relevance
// ──────────────────────────────────────────────────────────────

const STOCKS = [
  // ─── NIFTY 50 ───
  { name: "Reliance Industries", ticker: "RELIANCE", sector: "Energy" },
  { name: "Tata Consultancy Services", ticker: "TCS", sector: "IT" },
  { name: "HDFC Bank", ticker: "HDFCBANK", sector: "Banking" },
  { name: "Infosys", ticker: "INFY", sector: "IT" },
  { name: "ICICI Bank", ticker: "ICICIBANK", sector: "Banking" },
  { name: "Hindustan Unilever", ticker: "HINDUNILVR", sector: "FMCG" },
  { name: "ITC", ticker: "ITC", sector: "FMCG" },
  { name: "State Bank of India", ticker: "SBIN", sector: "Banking" },
  { name: "Bharti Airtel", ticker: "BHARTIARTL", sector: "Telecom" },
  { name: "Kotak Mahindra Bank", ticker: "KOTAKBANK", sector: "Banking" },
  { name: "Larsen & Toubro", ticker: "LT", sector: "Infrastructure" },
  { name: "Bajaj Finance", ticker: "BAJFINANCE", sector: "NBFC" },
  { name: "Asian Paints", ticker: "ASIANPAINT", sector: "Paints" },
  { name: "Maruti Suzuki", ticker: "MARUTI", sector: "Auto" },
  { name: "HCL Technologies", ticker: "HCLTECH", sector: "IT" },
  { name: "Axis Bank", ticker: "AXISBANK", sector: "Banking" },
  { name: "Titan Company", ticker: "TITAN", sector: "Consumer" },
  { name: "Sun Pharmaceutical", ticker: "SUNPHARMA", sector: "Pharma" },
  { name: "Bajaj Finserv", ticker: "BAJAJFINSV", sector: "NBFC" },
  { name: "Wipro", ticker: "WIPRO", sector: "IT" },
  { name: "Mahindra & Mahindra", ticker: "M&M", sector: "Auto" },
  { name: "Tata Motors", ticker: "TATAMOTORS", sector: "Auto" },
  { name: "NTPC", ticker: "NTPC", sector: "Power" },
  { name: "Power Grid Corporation", ticker: "POWERGRID", sector: "Power" },
  { name: "UltraTech Cement", ticker: "ULTRACEMCO", sector: "Cement" },
  { name: "Nestle India", ticker: "NESTLEIND", sector: "FMCG" },
  { name: "Tech Mahindra", ticker: "TECHM", sector: "IT" },
  { name: "IndusInd Bank", ticker: "INDUSINDBK", sector: "Banking" },
  { name: "Adani Enterprises", ticker: "ADANIENT", sector: "Conglomerate" },
  { name: "Adani Ports", ticker: "ADANIPORTS", sector: "Infrastructure" },
  { name: "Tata Steel", ticker: "TATASTEEL", sector: "Metals" },
  { name: "JSW Steel", ticker: "JSWSTEEL", sector: "Metals" },
  { name: "Grasim Industries", ticker: "GRASIM", sector: "Cement" },
  { name: "Cipla", ticker: "CIPLA", sector: "Pharma" },
  { name: "Dr. Reddy's Laboratories", ticker: "DRREDDY", sector: "Pharma" },
  { name: "Eicher Motors", ticker: "EICHERMOT", sector: "Auto" },
  { name: "Britannia Industries", ticker: "BRITANNIA", sector: "FMCG" },
  { name: "Coal India", ticker: "COALINDIA", sector: "Mining" },
  { name: "Divis Laboratories", ticker: "DIVISLAB", sector: "Pharma" },
  { name: "BPCL", ticker: "BPCL", sector: "Energy" },
  { name: "Hindalco Industries", ticker: "HINDALCO", sector: "Metals" },
  { name: "Hero MotoCorp", ticker: "HEROMOTOCO", sector: "Auto" },
  { name: "SBI Life Insurance", ticker: "SBILIFE", sector: "Insurance" },
  { name: "Bajaj Auto", ticker: "BAJAJ-AUTO", sector: "Auto" },
  { name: "ONGC", ticker: "ONGC", sector: "Energy" },
  { name: "Tata Consumer Products", ticker: "TATACONSUM", sector: "FMCG" },
  { name: "Apollo Hospitals", ticker: "APOLLOHOSP", sector: "Healthcare" },
  { name: "HDFC Life Insurance", ticker: "HDFCLIFE", sector: "Insurance" },
  { name: "Bharat Electronics", ticker: "BEL", sector: "Defence" },
  { name: "Shriram Finance", ticker: "SHRIRAMFIN", sector: "NBFC" },

  // ─── NIFTY NEXT 50 ───
  { name: "Havells India", ticker: "HAVELLS", sector: "Electricals" },
  { name: "Godrej Consumer Products", ticker: "GODREJCP", sector: "FMCG" },
  { name: "Pidilite Industries", ticker: "PIDILITIND", sector: "Chemicals" },
  { name: "Dabur India", ticker: "DABUR", sector: "FMCG" },
  { name: "Siemens", ticker: "SIEMENS", sector: "Electricals" },
  { name: "ABB India", ticker: "ABB", sector: "Electricals" },
  { name: "Ambuja Cements", ticker: "AMBUJACEM", sector: "Cement" },
  { name: "ACC", ticker: "ACC", sector: "Cement" },
  { name: "Marico", ticker: "MARICO", sector: "FMCG" },
  { name: "Berger Paints", ticker: "BERGEPAINT", sector: "Paints" },
  { name: "SRF", ticker: "SRF", sector: "Chemicals" },
  { name: "Colgate-Palmolive India", ticker: "COLPAL", sector: "FMCG" },
  { name: "ICICI Lombard", ticker: "ICICIGI", sector: "Insurance" },
  { name: "ICICI Prudential Life", ticker: "ICICIPRULI", sector: "Insurance" },
  { name: "Torrent Pharmaceuticals", ticker: "TORNTPHARM", sector: "Pharma" },
  { name: "Lupin", ticker: "LUPIN", sector: "Pharma" },
  { name: "Aurobindo Pharma", ticker: "AUROPHARMA", sector: "Pharma" },
  { name: "Biocon", ticker: "BIOCON", sector: "Pharma" },
  { name: "Zomato", ticker: "ZOMATO", sector: "Internet" },
  { name: "Paytm (One97)", ticker: "PAYTM", sector: "Fintech" },
  { name: "Nykaa (FSN E-Commerce)", ticker: "NYKAA", sector: "E-Commerce" },
  { name: "Delhivery", ticker: "DELHIVERY", sector: "Logistics" },
  { name: "PB Fintech (Policybazaar)", ticker: "POLICYBZR", sector: "Fintech" },
  { name: "Info Edge (Naukri)", ticker: "NAUKRI", sector: "Internet" },
  { name: "Mphasis", ticker: "MPHASIS", sector: "IT" },
  { name: "LTIMindtree", ticker: "LTIM", sector: "IT" },
  { name: "Persistent Systems", ticker: "PERSISTENT", sector: "IT" },
  { name: "Coforge", ticker: "COFORGE", sector: "IT" },
  { name: "L&T Technology Services", ticker: "LTTS", sector: "IT" },
  { name: "Trent", ticker: "TRENT", sector: "Retail" },
  { name: "Avenue Supermarts (DMart)", ticker: "DMART", sector: "Retail" },
  { name: "Page Industries", ticker: "PAGEIND", sector: "Textiles" },
  { name: "Dixon Technologies", ticker: "DIXON", sector: "Electronics" },
  { name: "Varun Beverages", ticker: "VBL", sector: "FMCG" },
  { name: "Jindal Steel & Power", ticker: "JINDALSTEL", sector: "Metals" },
  { name: "Vedanta", ticker: "VEDL", sector: "Mining" },
  { name: "Tata Power", ticker: "TATAPOWER", sector: "Power" },
  { name: "Adani Green Energy", ticker: "ADANIGREEN", sector: "Renewables" },
  { name: "Adani Total Gas", ticker: "ATGL", sector: "Gas" },
  { name: "Adani Wilmar", ticker: "AWL", sector: "FMCG" },
  { name: "Adani Power", ticker: "ADANIPOWER", sector: "Power" },
  { name: "Adani Transmission", ticker: "ADANITRANS", sector: "Power" },

  // ─── MID-CAP / POPULAR ───
  { name: "Bandhan Bank", ticker: "BANDHANBNK", sector: "Banking" },
  { name: "Federal Bank", ticker: "FEDERALBNK", sector: "Banking" },
  { name: "IDFC First Bank", ticker: "IDFCFIRSTB", sector: "Banking" },
  { name: "AU Small Finance Bank", ticker: "AUBANK", sector: "Banking" },
  { name: "Bank of Baroda", ticker: "BANKBARODA", sector: "Banking" },
  { name: "Canara Bank", ticker: "CANBK", sector: "Banking" },
  { name: "Punjab National Bank", ticker: "PNB", sector: "Banking" },
  { name: "Union Bank of India", ticker: "UNIONBANK", sector: "Banking" },
  { name: "Indian Bank", ticker: "INDIANB", sector: "Banking" },
  { name: "Bank of India", ticker: "BANKINDIA", sector: "Banking" },
  { name: "IDBI Bank", ticker: "IDBI", sector: "Banking" },
  { name: "Indian Overseas Bank", ticker: "IOB", sector: "Banking" },
  { name: "Central Bank of India", ticker: "CENTRALBK", sector: "Banking" },
  { name: "Yes Bank", ticker: "YESBANK", sector: "Banking" },
  { name: "RBL Bank", ticker: "RBLBANK", sector: "Banking" },
  { name: "Karnataka Bank", ticker: "KTKBANK", sector: "Banking" },
  { name: "South Indian Bank", ticker: "SOUTHBANK", sector: "Banking" },
  { name: "Ujjivan Small Finance Bank", ticker: "UJJIVANSFB", sector: "Banking" },
  { name: "Equitas Small Finance Bank", ticker: "EQUITASBNK", sector: "Banking" },

  // ─── PSU / DEFENCE / INFRA ───
  { name: "HAL (Hindustan Aeronautics)", ticker: "HAL", sector: "Defence" },
  { name: "Bharat Dynamics", ticker: "BDL", sector: "Defence" },
  { name: "Mazagon Dock Shipbuilders", ticker: "MAZDOCK", sector: "Defence" },
  { name: "Cochin Shipyard", ticker: "COCHINSHIP", sector: "Defence" },
  { name: "Garden Reach Shipbuilders", ticker: "GRSE", sector: "Defence" },
  { name: "Data Patterns", ticker: "DATAPATTNS", sector: "Defence" },
  { name: "Bharat Forge", ticker: "BHARATFORG", sector: "Auto Ancillary" },
  { name: "Solar Industries", ticker: "SOLARINDS", sector: "Defence" },
  { name: "BEML", ticker: "BEML", sector: "Defence" },
  { name: "Paras Defence", ticker: "PARASDEFEN", sector: "Defence" },
  { name: "IRCTC", ticker: "IRCTC", sector: "Railways" },
  { name: "Indian Railway Finance Corp", ticker: "IRFC", sector: "Railways" },
  { name: "RVNL (Rail Vikas)", ticker: "RVNL", sector: "Railways" },
  { name: "NHPC", ticker: "NHPC", sector: "Power" },
  { name: "SJVN", ticker: "SJVN", sector: "Power" },
  { name: "GAIL India", ticker: "GAIL", sector: "Gas" },
  { name: "Indian Oil Corporation", ticker: "IOC", sector: "Energy" },
  { name: "Hindustan Petroleum", ticker: "HINDPETRO", sector: "Energy" },
  { name: "Oil India", ticker: "OIL", sector: "Energy" },
  { name: "NMDC", ticker: "NMDC", sector: "Mining" },
  { name: "National Aluminium (NALCO)", ticker: "NATIONALUM", sector: "Metals" },
  { name: "Hindustan Copper", ticker: "HINDCOPPER", sector: "Metals" },
  { name: "SAIL", ticker: "SAIL", sector: "Metals" },
  { name: "MOIL", ticker: "MOIL", sector: "Mining" },
  { name: "Container Corporation", ticker: "CONCOR", sector: "Logistics" },
  { name: "NLC India", ticker: "NLCINDIA", sector: "Power" },
  { name: "Mazagon Dock", ticker: "MAZDOCK", sector: "Defence" },
  { name: "NBCC India", ticker: "NBCC", sector: "Infrastructure" },
  { name: "HUDCO", ticker: "HUDCO", sector: "NBFC" },
  { name: "REC Ltd", ticker: "RECLTD", sector: "NBFC" },
  { name: "Power Finance Corporation", ticker: "PFC", sector: "NBFC" },
  { name: "IREDA", ticker: "IREDA", sector: "NBFC" },
  { name: "LIC Housing Finance", ticker: "LICHSGFIN", sector: "NBFC" },
  { name: "Manappuram Finance", ticker: "MANAPPURAM", sector: "NBFC" },
  { name: "Muthoot Finance", ticker: "MUTHOOTFIN", sector: "NBFC" },
  { name: "Cholamandalam Investment", ticker: "CHOLAFIN", sector: "NBFC" },
  { name: "Mahindra & Mahindra Financial", ticker: "M&MFIN", sector: "NBFC" },
  { name: "Sundaram Finance", ticker: "SUNDARMFIN", sector: "NBFC" },
  { name: "Can Fin Homes", ticker: "CANFINHOME", sector: "NBFC" },

  // ─── PHARMA / HEALTHCARE ───
  { name: "Max Healthcare", ticker: "MAXHEALTH", sector: "Healthcare" },
  { name: "Fortis Healthcare", ticker: "FORTIS", sector: "Healthcare" },
  { name: "Narayana Hrudayalaya", ticker: "NH", sector: "Healthcare" },
  { name: "Laurus Labs", ticker: "LAURUSLABS", sector: "Pharma" },
  { name: "Glenmark Pharmaceuticals", ticker: "GLENMARK", sector: "Pharma" },
  { name: "Alkem Laboratories", ticker: "ALKEM", sector: "Pharma" },
  { name: "Ipca Laboratories", ticker: "IPCALAB", sector: "Pharma" },
  { name: "Abbott India", ticker: "ABBOTINDIA", sector: "Pharma" },
  { name: "Natco Pharma", ticker: "NATCOPHARM", sector: "Pharma" },
  { name: "Syngene International", ticker: "SYNGENE", sector: "Pharma" },
  { name: "Metropolis Healthcare", ticker: "METROPOLIS", sector: "Healthcare" },
  { name: "Dr. Lal PathLabs", ticker: "LALPATHLAB", sector: "Healthcare" },
  { name: "Thyrocare Technologies", ticker: "THYROCARE", sector: "Healthcare" },
  { name: "Aarti Drugs", ticker: "AARTIDRUGS", sector: "Pharma" },
  { name: "Granules India", ticker: "GRANULES", sector: "Pharma" },

  // ─── AUTO & AUTO ANCILLARY ───
  { name: "Ashok Leyland", ticker: "ASHOKLEY", sector: "Auto" },
  { name: "TVS Motor Company", ticker: "TVSMOTOR", sector: "Auto" },
  { name: "MRF", ticker: "MRF", sector: "Tyres" },
  { name: "Apollo Tyres", ticker: "APOLLOTYRE", sector: "Tyres" },
  { name: "CEAT", ticker: "CEAT", sector: "Tyres" },
  { name: "Balkrishna Industries", ticker: "BALKRISIND", sector: "Tyres" },
  { name: "Motherson Sumi Wiring", ticker: "MSUMI", sector: "Auto Ancillary" },
  { name: "Bosch", ticker: "BOSCHLTD", sector: "Auto Ancillary" },
  { name: "Exide Industries", ticker: "EXIDEIND", sector: "Auto Ancillary" },
  { name: "Amara Raja Energy", ticker: "AMARAJABAT", sector: "Auto Ancillary" },
  { name: "Tube Investments", ticker: "TIINDIA", sector: "Auto Ancillary" },
  { name: "Sona BLW Precision", ticker: "SONACOMS", sector: "Auto Ancillary" },
  { name: "Samvardhana Motherson", ticker: "MOTHERSON", sector: "Auto Ancillary" },
  { name: "Escorts Kubota", ticker: "ESCORTS", sector: "Auto" },
  { name: "Force Motors", ticker: "FORCEMOT", sector: "Auto" },
  { name: "Ola Electric", ticker: "OLAELEC", sector: "EV" },
  { name: "Ather Energy", ticker: "ATHERENRGY", sector: "EV" },

  // ─── CHEMICALS / SPECIALITY ───
  { name: "PI Industries", ticker: "PIIND", sector: "Chemicals" },
  { name: "UPL", ticker: "UPL", sector: "Agrochemicals" },
  { name: "Aarti Industries", ticker: "AARTIIND", sector: "Chemicals" },
  { name: "Deepak Nitrite", ticker: "DEEPAKNTR", sector: "Chemicals" },
  { name: "Clean Science and Technology", ticker: "CLEAN", sector: "Chemicals" },
  { name: "Navin Fluorine", ticker: "NAVINFLUOR", sector: "Chemicals" },
  { name: "Gujarat Fluorochemicals", ticker: "FLUOROCHEM", sector: "Chemicals" },
  { name: "Atul", ticker: "ATUL", sector: "Chemicals" },
  { name: "Tata Chemicals", ticker: "TATACHEM", sector: "Chemicals" },
  { name: "BASF India", ticker: "BASF", sector: "Chemicals" },
  { name: "Sudarshan Chemical", ticker: "SUDARSCHEM", sector: "Chemicals" },
  { name: "Gujarat Gas", ticker: "GUJGASLTD", sector: "Gas" },
  { name: "Indraprastha Gas", ticker: "IGL", sector: "Gas" },
  { name: "Mahanagar Gas", ticker: "MGL", sector: "Gas" },
  { name: "Petronet LNG", ticker: "PETRONET", sector: "Gas" },

  // ─── IT / TECH ───
  { name: "Happiest Minds", ticker: "HAPPSTMNDS", sector: "IT" },
  { name: "KPIT Technologies", ticker: "KPITTECH", sector: "IT" },
  { name: "Tata Elxsi", ticker: "TATAELXSI", sector: "IT" },
  { name: "Zensar Technologies", ticker: "ZENSARTECH", sector: "IT" },
  { name: "Birlasoft", ticker: "BSOFT", sector: "IT" },
  { name: "Cyient", ticker: "CYIENT", sector: "IT" },
  { name: "Mastek", ticker: "MASTEK", sector: "IT" },
  { name: "NIIT Technologies", ticker: "NIITTECH", sector: "IT" },
  { name: "Intellect Design Arena", ticker: "INTELLECT", sector: "IT" },
  { name: "Route Mobile", ticker: "ROUTE", sector: "IT" },
  { name: "Tanla Platforms", ticker: "TANLA", sector: "IT" },
  { name: "MapmyIndia (CE Info Systems)", ticker: "MAPMYINDIA", sector: "IT" },
  { name: "Latent View Analytics", ticker: "LATENTVIEW", sector: "IT" },

  // ─── FMCG / CONSUMER ───
  { name: "United Spirits", ticker: "UNITDSPR", sector: "Beverages" },
  { name: "United Breweries", ticker: "UBL", sector: "Beverages" },
  { name: "Radico Khaitan", ticker: "RADICO", sector: "Beverages" },
  { name: "Jubilant Foodworks", ticker: "JUBLFOOD", sector: "QSR" },
  { name: "Devyani International", ticker: "DEVYANI", sector: "QSR" },
  { name: "Sapphire Foods", ticker: "SAPPHIRE", sector: "QSR" },
  { name: "Westlife Foodworld", ticker: "WESTLIFE", sector: "QSR" },
  { name: "Emami", ticker: "EMAMILTD", sector: "FMCG" },
  { name: "Jyothy Labs", ticker: "JYOTHYLAB", sector: "FMCG" },
  { name: "Tata Consumer Products", ticker: "TATACONSUM", sector: "FMCG" },
  { name: "Godrej Industries", ticker: "GODREJIND", sector: "Conglomerate" },
  { name: "Godrej Properties", ticker: "GODREJPROP", sector: "Real Estate" },
  { name: "Godrej Agrovet", ticker: "GODREJAGRO", sector: "Agri" },

  // ─── REAL ESTATE ───
  { name: "DLF", ticker: "DLF", sector: "Real Estate" },
  { name: "Oberoi Realty", ticker: "OBEROIRLTY", sector: "Real Estate" },
  { name: "Prestige Estates", ticker: "PRESTIGE", sector: "Real Estate" },
  { name: "Brigade Enterprises", ticker: "BRIGADE", sector: "Real Estate" },
  { name: "Phoenix Mills", ticker: "PHOENIXLTD", sector: "Real Estate" },
  { name: "Sobha", ticker: "SOBHA", sector: "Real Estate" },
  { name: "Macrotech Developers (Lodha)", ticker: "LODHA", sector: "Real Estate" },
  { name: "Sunteck Realty", ticker: "SUNTECK", sector: "Real Estate" },

  // ─── CEMENT ───
  { name: "Shree Cement", ticker: "SHREECEM", sector: "Cement" },
  { name: "Dalmia Bharat", ticker: "DALBHARAT", sector: "Cement" },
  { name: "Ramco Cements", ticker: "RAMCOCEM", sector: "Cement" },
  { name: "JK Cement", ticker: "JKCEMENT", sector: "Cement" },
  { name: "Birla Corporation", ticker: "BIRLACORPN", sector: "Cement" },
  { name: "India Cements", ticker: "INDIACEM", sector: "Cement" },
  { name: "Star Cement", ticker: "STARCEMENT", sector: "Cement" },
  { name: "Heidelberg Cement India", ticker: "HEIDELBERG", sector: "Cement" },

  // ─── TELECOM / MEDIA ───
  { name: "Vodafone Idea", ticker: "IDEA", sector: "Telecom" },
  { name: "Jio Financial Services", ticker: "JIOFIN", sector: "NBFC" },
  { name: "Indus Towers", ticker: "INDUSTOWER", sector: "Telecom" },
  { name: "Zee Entertainment", ticker: "ZEEL", sector: "Media" },
  { name: "PVR INOX", ticker: "PVRINOX", sector: "Media" },
  { name: "Sun TV Network", ticker: "SUNTV", sector: "Media" },
  { name: "Network18 Media", ticker: "NETWORK18", sector: "Media" },
  { name: "TV18 Broadcast", ticker: "TV18BRDCST", sector: "Media" },

  // ─── CAPITAL GOODS / ENGINEERING ───
  { name: "Bharat Heavy Electricals (BHEL)", ticker: "BHEL", sector: "Capital Goods" },
  { name: "Thermax", ticker: "THERMAX", sector: "Capital Goods" },
  { name: "Cummins India", ticker: "CUMMINSIND", sector: "Capital Goods" },
  { name: "Honeywell Automation", ticker: "HONAUT", sector: "Capital Goods" },
  { name: "Crompton Greaves Consumer", ticker: "CROMPTON", sector: "Electricals" },
  { name: "Polycab India", ticker: "POLYCAB", sector: "Electricals" },
  { name: "KEI Industries", ticker: "KEI", sector: "Electricals" },
  { name: "Finolex Cables", ticker: "FINCABLES", sector: "Electricals" },
  { name: "V-Guard Industries", ticker: "VGUARD", sector: "Electricals" },
  { name: "Voltas", ticker: "VOLTAS", sector: "Consumer Durables" },
  { name: "Blue Star", ticker: "BLUESTARCO", sector: "Consumer Durables" },
  { name: "Whirlpool of India", ticker: "WHIRLPOOL", sector: "Consumer Durables" },
  { name: "Elgi Equipments", ticker: "ELGIEQUIP", sector: "Capital Goods" },
  { name: "Carborundum Universal", ticker: "CARBORUNIV", sector: "Capital Goods" },
  { name: "Grindwell Norton", ticker: "GRINDWELL", sector: "Capital Goods" },
  { name: "AIA Engineering", ticker: "AIAENG", sector: "Capital Goods" },
  { name: "Kaynes Technology", ticker: "KAYNES", sector: "Electronics" },

  // ─── INSURANCE ───
  { name: "LIC (Life Insurance Corp)", ticker: "LICI", sector: "Insurance" },
  { name: "General Insurance Corp", ticker: "GICRE", sector: "Insurance" },
  { name: "New India Assurance", ticker: "NIACL", sector: "Insurance" },
  { name: "Star Health Insurance", ticker: "STARHEALTH", sector: "Insurance" },
  { name: "Max Financial Services", ticker: "MFSL", sector: "Insurance" },

  // ─── TEXTILES / APPAREL ───
  { name: "Raymond", ticker: "RAYMOND", sector: "Textiles" },
  { name: "Arvind", ticker: "ARVIND", sector: "Textiles" },
  { name: "Welspun Living", ticker: "WELSPUNLIV", sector: "Textiles" },
  { name: "Lux Industries", ticker: "LUXIND", sector: "Textiles" },
  { name: "KPR Mill", ticker: "KPRMILL", sector: "Textiles" },
  { name: "Trident", ticker: "TRIDENT", sector: "Textiles" },
  { name: "Vedant Fashions (Manyavar)", ticker: "MANYAVAR", sector: "Retail" },
  { name: "Metro Brands", ticker: "METROBRAND", sector: "Retail" },
  { name: "Campus Activewear", ticker: "CAMPUS", sector: "Retail" },

  // ─── LOGISTICS / TRANSPORT ───
  { name: "Adani Logistics", ticker: "ADANILOG", sector: "Logistics" },
  { name: "Transport Corporation of India", ticker: "TCI", sector: "Logistics" },
  { name: "Allcargo Logistics", ticker: "ALLCARGO", sector: "Logistics" },
  { name: "Blue Dart Express", ticker: "BLUEDART", sector: "Logistics" },
  { name: "InterGlobe Aviation (IndiGo)", ticker: "INDIGO", sector: "Aviation" },
  { name: "SpiceJet", ticker: "SPICEJET", sector: "Aviation" },

  // ─── OTHER POPULAR ───
  { name: "IEX (Indian Energy Exchange)", ticker: "IEX", sector: "Exchange" },
  { name: "BSE Ltd", ticker: "BSE", sector: "Exchange" },
  { name: "Multi Commodity Exchange", ticker: "MCX", sector: "Exchange" },
  { name: "CDSL", ticker: "CDSL", sector: "Depository" },
  { name: "Computer Age Management (CAMS)", ticker: "CAMS", sector: "Fintech" },
  { name: "KFin Technologies", ticker: "KFINTECH", sector: "Fintech" },
  { name: "Angel One", ticker: "ANGELONE", sector: "Broking" },
  { name: "ICICI Securities", ticker: "ISEC", sector: "Broking" },
  { name: "Motilal Oswal Financial", ticker: "MOTILALOFS", sector: "Broking" },
  { name: "360 ONE WAM", ticker: "360ONE", sector: "Wealth Mgmt" },
  { name: "Divi's Laboratories", ticker: "DIVISLAB", sector: "Pharma" },
  { name: "Astral", ticker: "ASTRAL", sector: "Pipes" },
  { name: "Supreme Industries", ticker: "SUPREMEIND", sector: "Pipes" },
  { name: "APL Apollo Tubes", ticker: "APLAPOLLO", sector: "Pipes" },
  { name: "Prince Pipes", ticker: "PRINCEPIPE", sector: "Pipes" },
  { name: "Finolex Industries", ticker: "FINPIPE", sector: "Pipes" },
  { name: "CG Power & Industrial", ticker: "CGPOWER", sector: "Electricals" },
  { name: "Suzlon Energy", ticker: "SUZLON", sector: "Renewables" },
  { name: "Tata Technologies", ticker: "TATATECH", sector: "IT" },
  { name: "JSW Energy", ticker: "JSWENERGY", sector: "Power" },
  { name: "Torrent Power", ticker: "TORNTPOWER", sector: "Power" },
  { name: "CESC", ticker: "CESC", sector: "Power" },
  { name: "Kalyan Jewellers", ticker: "KALYANKJIL", sector: "Jewellery" },
  { name: "Senco Gold", ticker: "SENCO", sector: "Jewellery" },
  { name: "PC Jeweller", ticker: "PCJEWELLER", sector: "Jewellery" },
  { name: "Sapphire Foods India", ticker: "SAPPHIRE", sector: "QSR" },
  { name: "Dhanuka Agritech", ticker: "DHANUKA", sector: "Agrochemicals" },
  { name: "Sumitomo Chemical India", ticker: "SUMICHEM", sector: "Agrochemicals" },
  { name: "Bayer CropScience", ticker: "BAYERCROP", sector: "Agrochemicals" },
  { name: "Coromandel International", ticker: "COROMANDEL", sector: "Fertiliser" },
  { name: "Chambal Fertilisers", ticker: "CHAMBLFERT", sector: "Fertiliser" },
  { name: "Gujarat State Fertilizers (GSFC)", ticker: "GSFC", sector: "Fertiliser" },
  { name: "Rashtriya Chemicals (RCF)", ticker: "RCF", sector: "Fertiliser" },
  { name: "Deepak Fertilisers", ticker: "DEEPAKFERT", sector: "Fertiliser" },
  { name: "National Fertilizers", ticker: "NFL", sector: "Fertiliser" },
  { name: "FACT (Fertilisers And Chemicals)", ticker: "FACT", sector: "Fertiliser" },
  { name: "Multi Commodity Exchange", ticker: "MCX", sector: "Exchange" },
  { name: "Tata Communications", ticker: "TATACOMM", sector: "Telecom" },
  { name: "Cyient DLM", ticker: "CYIENTDLM", sector: "Electronics" },
  { name: "Waaree Energies", ticker: "WAAREEENER", sector: "Solar" },
  { name: "Premier Energies", ticker: "PREMIERENR", sector: "Solar" },
  { name: "Websol Energy System", ticker: "WEBELSOLAR", sector: "Solar" },

  // ─── MICRO / TRENDING / SME ───
  { name: "IREDA", ticker: "IREDA", sector: "NBFC" },
  { name: "Tata Investment Corporation", ticker: "TATAINVEST", sector: "Investment" },
  { name: "Quess Corp", ticker: "QUESS", sector: "Staffing" },
  { name: "TeamLease Services", ticker: "TEAMLEASE", sector: "Staffing" },
  { name: "JM Financial", ticker: "JMFINANCIL", sector: "NBFC" },
  { name: "IIFL Finance", ticker: "IIFL", sector: "NBFC" },
  { name: "Piramal Enterprises", ticker: "PEL", sector: "Diversified" },
  { name: "Aditya Birla Capital", ticker: "ABCAPITAL", sector: "NBFC" },
  { name: "Aditya Birla Fashion", ticker: "ABFRL", sector: "Retail" },
  { name: "Aditya Birla Sun Life AMC", ticker: "ABSLAMC", sector: "AMC" },
  { name: "HDFC AMC", ticker: "HDFCAMC", sector: "AMC" },
  { name: "Nippon Life India AMC", ticker: "NAM-INDIA", sector: "AMC" },
  { name: "UTI AMC", ticker: "UTIAMC", sector: "AMC" },
  { name: "Reliance Industries", ticker: "RELIANCE", sector: "Energy" },
];

// Remove duplicates by ticker
const STOCK_MAP = new Map();
STOCKS.forEach(s => { if (!STOCK_MAP.has(s.ticker)) STOCK_MAP.set(s.ticker, s); });
const UNIQUE_STOCKS = Array.from(STOCK_MAP.values());

// ─── Fuzzy scoring ───
function scoreMatch(stock, query) {
  const q = query.toLowerCase().trim();
  if (!q) return -1;

  const name = stock.name.toLowerCase();
  const ticker = stock.ticker.toLowerCase();
  const sector = stock.sector.toLowerCase();
  const words = q.split(/\s+/);

  let score = 0;

  // Exact ticker match → highest priority
  if (ticker === q) return 10000;

  // Ticker starts with query
  if (ticker.startsWith(q)) score += 5000;

  // Ticker contains query
  if (ticker.includes(q)) score += 3000;

  // Full name starts with query
  if (name.startsWith(q)) score += 4000;

  // Name contains exact query
  if (name.includes(q)) score += 2000;

  // All words present in name or ticker
  const allWordsMatch = words.every(w => name.includes(w) || ticker.includes(w) || sector.includes(w));
  if (allWordsMatch) score += 1500;

  // Partial word match — each word
  for (const w of words) {
    if (name.includes(w)) score += 500;
    if (ticker.includes(w)) score += 400;
    if (sector.includes(w)) score += 200;

    // Abbreviation match (e.g., "sbi" matches "state bank of india")
    const nameWords = name.split(/\s+/);
    const abbr = nameWords.map(nw => nw[0]).join('');
    if (abbr.includes(w)) score += 600;
  }

  // Fuzzy: Levenshtein-style for short queries (typo tolerance)
  if (q.length >= 3 && q.length <= 8) {
    if (levenshtein(q, ticker) <= 1) score += 2500;
    // Check name words for close matches
    const nameWords = name.split(/[\s&()]+/);
    for (const nw of nameWords) {
      if (nw.length >= 3 && levenshtein(q, nw.substring(0, q.length)) <= 1) score += 800;
    }
  }

  return score;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

export default function handler(req, res) {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 1) {
    return res.status(200).json({ suggestions: [] });
  }

  const scored = UNIQUE_STOCKS
    .map(s => ({ ...s, score: scoreMatch(s, q) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score, ...rest }) => rest);

  res.status(200).json({ suggestions: scored });
}
