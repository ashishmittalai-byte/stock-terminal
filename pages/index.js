import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

// ─── Utility Helpers ───────────────────────────────────────────
const QUICK_PICKS = [
  { name: 'Reliance', sector: 'Energy' },
  { name: 'TCS', sector: 'IT' },
  { name: 'HDFC Bank', sector: 'Banking' },
  { name: 'Infosys', sector: 'IT' },
  { name: 'ITC', sector: 'FMCG' },
  { name: 'SBI', sector: 'Banking' },
  { name: 'Tata Motors', sector: 'Auto' },
  { name: 'Bajaj Finance', sector: 'NBFC' },
];

const VERDICT_CONFIG = {
  'Strong Buy':  { color: '#15803d', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.25)', icon: '▲▲' },
  'Buy':         { color: '#16a34a', bg: 'rgba(22,163,74,0.06)', border: 'rgba(22,163,74,0.2)', icon: '▲' },
  'Hold':        { color: '#d97706', bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.22)', icon: '◆' },
  'Sell':        { color: '#dc2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)', icon: '▼' },
  'Strong Sell': { color: '#991b1b', bg: 'rgba(153,27,27,0.07)', border: 'rgba(153,27,27,0.25)', icon: '▼▼' },
};

function getVerdictStyle(verdict) {
  if (!verdict) return VERDICT_CONFIG['Hold'];
  for (const key of Object.keys(VERDICT_CONFIG)) {
    if (verdict.toLowerCase().includes(key.toLowerCase())) return VERDICT_CONFIG[key];
  }
  return VERDICT_CONFIG['Hold'];
}

function parseScore(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') { const n = parseFloat(val); return isNaN(n) ? 0 : n; }
  return 0;
}

// ─── Sub-components ────────────────────────────────────────────

function ScoreRing({ score, size = 72, stroke = 5, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size * 0.22} fontWeight="700" fontFamily="'JetBrains Mono', monospace"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {Math.round(pct)}
      </text>
    </svg>
  );
}

function ShareholdingBar({ data }) {
  if (!data) return null;
  const segments = [
    { label: 'Promoter', value: data.promoter, color: '#4f46e5' },
    { label: 'FII', value: data.fii, color: '#0891b2' },
    { label: 'DII', value: data.dii, color: '#16a34a' },
    { label: 'Public', value: data.public, color: '#d97706' },
  ].filter(s => s.value && s.value > 0);
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 14, background: 'rgba(0,0,0,0.04)' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.value}%`, background: s.color, transition: 'width 0.8s ease' }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span className="label-text">{s.label}</span>
            <span className="mono-value" style={{ fontSize: 12 }}>{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IndicatorPill({ label, value, signal }) {
  const sigColor = signal === 'Bullish' || signal === 'Buy' ? '#16a34a'
    : signal === 'Bearish' || signal === 'Sell' ? '#dc2626' : '#d97706';
  return (
    <div className="indicator-pill">
      <span className="label-text" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span className="mono-value" style={{ whiteSpace: 'nowrap' }}>{typeof value === 'number' ? value.toFixed(2) : value || '—'}</span>
      {signal && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: `${sigColor}15`, color: sigColor, textTransform: 'uppercase',
          letterSpacing: '0.05em', whiteSpace: 'nowrap',
        }}>
          {signal}
        </span>
      )}
    </div>
  );
}

function Card({ title, icon, children, style, accentColor }) {
  return (
    <div className="card" style={style}>
      {title && (
        <div className="card-header">
          {icon && <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>}
          <h3 className="card-title" style={{ color: accentColor || 'var(--text-secondary)' }}>{title}</h3>
          <div className="card-header-line" />
        </div>
      )}
      {children}
    </div>
  );
}

function NewsItem({ item }) {
  return (
    <a href={item.url || '#'} target="_blank" rel="noopener noreferrer" className="news-item">
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {item.headline || item.title || item}
      </p>
      {item.source && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
          {item.source}{item.date && ` · ${item.date}`}
        </p>
      )}
    </a>
  );
}

function TextBlock({ item }) {
  return (
    <div className="text-block">
      {typeof item === 'string' ? item : (
        <>
          {(item.name || item.pattern) && <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>{item.name || item.pattern}</span>}
          {item.description || item.details || item.signal || JSON.stringify(item)}
          {item.signal && typeof item !== 'string' && item.name && (
            <span style={{ marginLeft: 8, fontSize: 11, color: item.signal === 'Bullish' ? '#16a34a' : item.signal === 'Bearish' ? '#dc2626' : '#d97706', fontWeight: 600 }}>({item.signal})</span>
          )}
        </>
      )}
    </div>
  );
}


// ─── Main Page ─────────────────────────────────────────────────

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [watchlist, setWatchlist] = useState([]);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const resultsRef = useRef(null);
  const suggestRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    try { const w = JSON.parse(localStorage.getItem('stockWatchlist') || '[]'); setWatchlist(w); } catch {}
  }, []);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        setSuggestions(json.suggestions || []);
        setShowSuggestions((json.suggestions || []).length > 0);
        setActiveIdx(-1);
      } catch { setSuggestions([]); }
    }, 180);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const saveWatchlist = (w) => { setWatchlist(w); localStorage.setItem('stockWatchlist', JSON.stringify(w)); };
  const toggleWatchlist = (name) => {
    if (watchlist.includes(name)) saveWatchlist(watchlist.filter(n => n !== name));
    else saveWatchlist([...watchlist, name]);
  };

  const analyse = useCallback(async (stockName) => {
    const q = (stockName || query).trim();
    if (!q) return;
    setQuery(q);
    setSuggestions([]);
    setShowSuggestions(false);
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: q }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (e) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < suggestions.length) {
          const picked = suggestions[activeIdx];
          analyse(picked.name);
        } else {
          analyse();
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter') {
      analyse();
    }
  };

  const pickSuggestion = (s) => {
    setQuery(s.name);
    setSuggestions([]);
    setShowSuggestions(false);
    analyse(s.name);
  };

  // Safe field extraction
  const d = data || {};
  const price = d.currentPrice || d.price || d.ltp;
  const change = d.change;
  const changePct = d.changePercent || d.changePct;
  const isPositive = change > 0 || (changePct && changePct > 0);
  const verdictText = d.verdict || d.compositeVerdict || d.signal || '';
  const vs = getVerdictStyle(verdictText);

  // Technical sections
  const movingAverages = d.movingAverages || [];
  const maSummary = d.maSummary || '';
  const momentumIndicators = d.momentumIndicators || [];
  const trendIndicators = d.trendIndicators || [];
  const volatilityIndicators = d.volatilityIndicators || [];
  const volumeIndicators = d.volumeIndicators || [];
  const chartPattern = d.chartPattern || null;
  const supportResistance = d.supportResistance || {};
  const technicals = d.technicalIndicators || d.technicals || [];
  const candlestickPatterns = d.candlestickPatterns || [];

  // Fundamentals & other
  const fundamentals = d.fundamentals || d.fundamentalMetrics || {};
  const shareholding = d.shareholding || d.shareholdingPattern || {};
  const news = d.news || d.recentNews || [];
  const smartMoney = d.smartMoney || d.smartMoneySignals || [];
  const risks = d.risks || d.keyRisks || [];
  const catalysts = d.catalysts || d.keyCatalysts || [];
  const strategies = d.strategies || d.tradingStrategies || [];
  const researchLinks = d.researchLinks || [];
  const overallSummary = d.overallSummary || '';

  const techScore = parseScore(d.technicalScore || d.techScore);
  const fundScore = parseScore(d.fundamentalScore || d.fundScore);
  const compositeScore = parseScore(d.compositeScore || d.overallScore || ((techScore * 0.45) + (fundScore * 0.55)));
  const stockName = d.stockName || d.name || query;

  return (
    <>
      <Head>
        <title>Equity Analysis Terminal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        /* ─── Design Tokens — Premium Light ─── */
        :root {
          --bg-primary: #f5f6fa;
          --bg-elevated: #ffffff;
          --card-bg: #ffffff;
          --card-border: rgba(0,0,0,0.06);
          --card-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03);
          --card-shadow-hover: 0 4px 12px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.04);
          --text-primary: #1a1f36;
          --text-secondary: #4a5568;
          --text-muted: #94a0b4;
          --accent-blue: #4f46e5;
          --accent-purple: #7c3aed;
          --accent-green: #16a34a;
          --accent-red: #dc2626;
          --accent-amber: #d97706;
          --pill-bg: #f3f4f8;
          --pill-border: rgba(0,0,0,0.04);
          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 16px;
          --radius-xl: 20px;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow-x: hidden;
        }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; }

        /* ─── Keyframes ─── */
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }

        /* ─── Typography ─── */
        .label-text { font-size: 12px; color: var(--text-muted); font-weight: 500; }
        .mono-value { font-size: 13px; font-weight: 600; font-family: 'JetBrains Mono', monospace; color: var(--text-primary); }

        /* ─── Card ─── */
        .card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--radius-lg);
          padding: 24px;
          box-shadow: var(--card-shadow);
          animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both;
          transition: box-shadow 0.3s, border-color 0.3s;
        }
        .card:hover {
          box-shadow: var(--card-shadow-hover);
          border-color: rgba(0,0,0,0.09);
        }
        .card-header { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
        .card-title {
          margin:0; font-size:13px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.09em;
        }
        .card-header-line { flex:1; height:1px; background:rgba(0,0,0,0.06); }

        /* ─── Indicator Pill ─── */
        .indicator-pill {
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          padding:10px 14px; border-radius:var(--radius-sm);
          background:var(--pill-bg); border:1px solid var(--pill-border);
          transition: background 0.2s;
        }
        .indicator-pill:hover { background:#ecedf2; }

        /* ─── Text Block ─── */
        .text-block {
          padding:10px 14px; border-radius:var(--radius-sm);
          background:var(--pill-bg); border:1px solid var(--pill-border);
          font-size:13px; line-height:1.55; color:var(--text-secondary);
        }

        /* ─── News Item ─── */
        .news-item {
          display:block; padding:12px 14px; border-radius:var(--radius-sm); text-decoration:none;
          background:var(--pill-bg); border:1px solid var(--pill-border);
          transition: all 0.2s;
        }
        .news-item:hover { background:#ecedf2; border-color:rgba(0,0,0,0.08); }

        /* ─── Search Input ─── */
        .search-input {
          width:100%; padding:16px 20px 16px 50px;
          font-size:16px; font-family:'DM Sans',sans-serif; font-weight:500;
          background:#ffffff; border:1.5px solid rgba(0,0,0,0.1);
          border-radius:var(--radius-md); color:var(--text-primary); outline:none;
          transition:all 0.25s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .search-input::placeholder { color:var(--text-muted); font-weight:400; }
        .search-input:focus {
          border-color:var(--accent-blue);
          box-shadow:0 0 0 4px rgba(79,70,229,0.1), 0 1px 4px rgba(0,0,0,0.03);
        }

        /* ─── Buttons ─── */
        .btn-primary {
          display:inline-flex; align-items:center; gap:8px;
          padding:14px 36px; font-size:14px; font-weight:700; font-family:'DM Sans',sans-serif;
          letter-spacing:0.05em; color:#fff;
          background:linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
          border:none; border-radius:var(--radius-md); cursor:pointer;
          transition:all 0.25s; text-transform:uppercase;
        }
        .btn-primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(79,70,229,0.25); }
        .btn-primary:active:not(:disabled) { transform:scale(0.97); }
        .btn-primary:disabled { opacity:0.45; cursor:not-allowed; }

        .btn-ghost {
          display:inline-flex; align-items:center; gap:6px;
          padding:9px 16px; font-size:13px; font-weight:600; font-family:'DM Sans',sans-serif;
          color:var(--text-secondary); background:#ffffff;
          border:1px solid rgba(0,0,0,0.1); border-radius:var(--radius-sm); cursor:pointer;
          transition:all 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .btn-ghost:hover { background:#f8f9fc; color:var(--text-primary); border-color:rgba(0,0,0,0.15); }

        .chip {
          border:1px solid rgba(0,0,0,0.08); background:#ffffff;
          color:var(--text-secondary); padding:9px 16px; border-radius:var(--radius-sm);
          font-size:13px; font-weight:500; cursor:pointer;
          transition:all 0.2s; font-family:'DM Sans',sans-serif;
          display:inline-flex; align-items:center; gap:8px; white-space:nowrap;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .chip:hover {
          border-color:var(--accent-blue); background:rgba(79,70,229,0.04);
          color:var(--text-primary); transform:translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .chip:active { transform:scale(0.97); }
        .chip .tag {
          font-size:10px; color:var(--text-muted); background:var(--pill-bg);
          padding:2px 6px; border-radius:4px; font-weight:600; letter-spacing:0.04em;
        }

        .fund-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(155px,1fr)); gap:8px; }
        .fund-item {
          display:flex; flex-direction:column; gap:4px;
          padding:12px 14px; border-radius:var(--radius-sm);
          background:var(--pill-bg); border:1px solid var(--pill-border);
        }
        .fund-label {
          font-size:11px; color:var(--text-muted); text-transform:uppercase;
          letter-spacing:0.06em; font-weight:600;
        }
        .fund-value { font-size:15px; font-weight:700; color:var(--text-primary); font-family:'JetBrains Mono',monospace; }

        .loader-ring {
          width:48px; height:48px;
          border:3px solid rgba(0,0,0,0.06);
          border-top-color:var(--accent-blue);
          border-radius:50%;
          animation:spin 0.8s linear infinite;
        }

        /* ─── Autocomplete Dropdown ─── */
        .suggest-dropdown {
          position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:50;
          background:#ffffff; border:1px solid rgba(0,0,0,0.1);
          border-radius:var(--radius-md); overflow:hidden;
          box-shadow:0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03);
          max-height:400px; overflow-y:auto;
        }
        .suggest-item {
          display:flex; align-items:center; gap:12px;
          padding:12px 16px; cursor:pointer; transition:background 0.15s;
          border-bottom:1px solid rgba(0,0,0,0.04);
        }
        .suggest-item:last-child { border-bottom:none; }
        .suggest-item:hover, .suggest-item.active { background:rgba(79,70,229,0.05); }
        .suggest-item .s-name {
          font-size:14px; font-weight:600; color:var(--text-primary); flex:1;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .suggest-item .s-ticker {
          font-size:12px; font-weight:600; font-family:'JetBrains Mono',monospace;
          color:var(--accent-blue); background:rgba(79,70,229,0.06);
          padding:2px 8px; border-radius:4px; letter-spacing:0.03em;
        }
        .suggest-item .s-sector {
          font-size:11px; color:var(--text-muted); font-weight:500;
          white-space:nowrap;
        }
        .suggest-hint {
          padding:8px 16px; font-size:11px; color:var(--text-muted);
          border-top:1px solid rgba(0,0,0,0.05); background:#fafbfc;
          display:flex; align-items:center; gap:6px;
        }
        .suggest-hint kbd {
          display:inline-block; padding:1px 5px; font-size:10px;
          border:1px solid rgba(0,0,0,0.12); border-radius:3px;
          color:var(--text-secondary); font-family:'JetBrains Mono',monospace;
          background:#f3f4f8;
        }

        /* ─── Responsive ─── */
        @media (max-width:768px) {
          .results-grid { grid-template-columns:1fr !important; }
          .hero-title { font-size:28px !important; }
          .fund-grid { grid-template-columns:repeat(2,1fr) !important; }
          .price-header { flex-direction:column !important; }
          .score-row { gap:24px !important; }
        }
      `}</style>

      {/* Background — subtle warm gradient */}
      <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:'-20%', left:'-10%', width:'50%', height:'50%', background:'radial-gradient(ellipse, rgba(79,70,229,0.04) 0%, transparent 65%)', filter:'blur(60px)' }} />
        <div style={{ position:'absolute', bottom:'-15%', right:'-10%', width:'40%', height:'40%', background:'radial-gradient(ellipse, rgba(124,58,237,0.03) 0%, transparent 65%)', filter:'blur(60px)' }} />
      </div>

      <div style={{ position:'relative', zIndex:1, maxWidth:1140, margin:'0 auto', padding:'0 24px' }}>

        {/* ── Header ── */}
        <header style={{ padding:'28px 0 12px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:38, height:38, borderRadius:10,
              background:'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, fontWeight:700, color:'#fff', boxShadow:'0 4px 12px rgba(79,70,229,0.2)',
            }}>₹</div>
            <div>
              <h1 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.01em', lineHeight:1.2 }}>
                Equity Analysis Terminal
              </h1>
              <p style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                BSE · NSE · AI-Powered
              </p>
            </div>
          </div>
          <button className="btn-ghost" onClick={() => setShowWatchlist(!showWatchlist)}>
            <span style={{ fontSize:15, color:'#d97706' }}>★</span>
            Watchlist ({watchlist.length})
          </button>
        </header>

        {/* ── Watchlist Panel ── */}
        {showWatchlist && watchlist.length > 0 && (
          <div className="card" style={{ marginBottom:16, padding:16 }}>
            <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Saved Stocks</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {watchlist.map(w => (
                <button key={w} className="chip" onClick={() => { analyse(w); setShowWatchlist(false); }}>
                  {w}
                  <span onClick={e => { e.stopPropagation(); toggleWatchlist(w); }}
                    style={{ color:'#dc2626', cursor:'pointer', fontSize:14 }}>×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Hero ── */}
        {!data && !loading && (
          <div style={{ textAlign:'center', padding:'56px 0 40px' }}>
            <div style={{ marginBottom:20 }}>
              <span style={{
                display:'inline-block', padding:'6px 14px', borderRadius:8,
                background:'rgba(79,70,229,0.06)', border:'1px solid rgba(79,70,229,0.14)',
                fontSize:11, fontWeight:600, color:'var(--accent-blue)', letterSpacing:'0.07em', textTransform:'uppercase',
              }}>
                Gemini 2.0 Flash · Search-Grounded Analysis
              </span>
            </div>
            <h2 className="hero-title" style={{
              fontSize:44, fontWeight:700, lineHeight:1.12, letterSpacing:'-0.03em',
              background:'linear-gradient(135deg, #1a1f36 25%, #4a5568 85%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              marginBottom:16, maxWidth:520, marginLeft:'auto', marginRight:'auto',
            }}>
              Comprehensive Stock Intelligence
            </h2>
            <p style={{ fontSize:15, color:'var(--text-muted)', maxWidth:460, margin:'0 auto', lineHeight:1.65, fontWeight:400 }}>
              Live prices, 25+ technical indicators, candlestick patterns, smart money, fundamentals, news, and AI-scored verdicts — all in one query.
            </p>
          </div>
        )}

        {/* ── Search Bar ── */}
        <div ref={suggestRef} style={{ maxWidth:600, margin: data || loading ? '20px auto' : '0 auto', position:'relative' }}>
          <div style={{ position:'relative' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position:'absolute', left:17, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', opacity:0.7 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input className="search-input" type="text"
              placeholder="Enter stock name or ticker… e.g. Reliance, INFY"
              value={query} onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
              onKeyDown={handleKeyDown} disabled={loading}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              autoComplete="off" />

            {/* ── Autocomplete Dropdown ── */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggest-dropdown">
                {suggestions.map((s, i) => (
                  <div key={`${s.ticker}-${i}`}
                    className={`suggest-item${i === activeIdx ? ' active' : ''}`}
                    onClick={() => pickSuggestion(s)}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span className="s-name">{s.name}</span>
                    <span className="s-ticker">{s.ticker}</span>
                    <span className="s-sector">{s.sector}</span>
                  </div>
                ))}
                <div className="suggest-hint">
                  <kbd>↑</kbd><kbd>↓</kbd> navigate
                  <kbd>↵</kbd> select
                  <kbd>esc</kbd> close
                </div>
              </div>
            )}
          </div>
          <div style={{ display:'flex', justifyContent:'center', marginTop:14 }}>
            <button className="btn-primary" onClick={() => analyse()} disabled={loading || !query.trim()}>
              {loading ? (
                <><span className="loader-ring" style={{ width:16, height:16, borderWidth:2 }} /> Analysing…</>
              ) : (
                <>Analyse <span style={{ fontSize:16, marginLeft:2 }}>→</span></>
              )}
            </button>
          </div>
        </div>

        {/* ── Quick Picks ── */}
        {!data && !loading && (
          <div style={{ marginTop:36, textAlign:'center' }}>
            <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em' }}>
              Popular Stocks
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:8 }}>
              {QUICK_PICKS.map(p => (
                <button key={p.name} className="chip" onClick={() => analyse(p.name)}>
                  {p.name}<span className="tag">{p.sector}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'72px 20px', gap:20 }}>
            <div className="loader-ring" />
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:16, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>Analysing {query}…</p>
              <p style={{ fontSize:13, color:'var(--text-muted)' }}>Fetching live market data via Google Search grounding</p>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{
            maxWidth:600, margin:'20px auto', padding:'14px 20px', borderRadius:'var(--radius-md)',
            background:'rgba(220,38,38,0.05)', border:'1px solid rgba(220,38,38,0.15)',
            color:'#dc2626', fontSize:14, textAlign:'center',
          }}>
            {error}
          </div>
        )}

        {/* ── Results ── */}
        {data && !loading && (
          <div ref={resultsRef} style={{ marginTop:28, paddingBottom:80 }}>

            {/* Price Header */}
            <Card style={{ marginBottom:18, animationDelay:'0s' }}>
              <div className="price-header" style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-start', justifyContent:'space-between', gap:20 }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <h2 style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.02em' }}>{stockName}</h2>
                    <button onClick={() => toggleWatchlist(stockName)} title="Toggle watchlist" style={{
                      background: watchlist.includes(stockName) ? 'rgba(217,119,6,0.08)' : 'transparent',
                      border: `1px solid ${watchlist.includes(stockName) ? 'rgba(217,119,6,0.3)' : 'rgba(0,0,0,0.1)'}`,
                      borderRadius:8, padding:'3px 10px', cursor:'pointer', fontSize:16,
                      color: watchlist.includes(stockName) ? '#d97706' : 'var(--text-muted)', transition:'all 0.2s',
                    }}>
                      {watchlist.includes(stockName) ? '★' : '☆'}
                    </button>
                  </div>
                  {price && (
                    <div style={{ display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap' }}>
                      <span style={{ fontSize:38, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", letterSpacing:'-0.02em' }}>
                        ₹{typeof price === 'number' ? price.toLocaleString('en-IN', { maximumFractionDigits:2 }) : price}
                      </span>
                      {(change !== undefined || changePct !== undefined) && (
                        <span style={{
                          fontSize:16, fontWeight:600, fontFamily:"'JetBrains Mono',monospace",
                          color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)', display:'flex', alignItems:'center', gap:4,
                          padding:'4px 10px', borderRadius:6,
                          background: isPositive ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                        }}>
                          {isPositive ? '▲' : '▼'}
                          {change !== undefined && (typeof change === 'number' ? Math.abs(change).toFixed(2) : change)}
                          {changePct !== undefined && ` (${typeof changePct === 'number' ? Math.abs(changePct).toFixed(2) : changePct}%)`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {verdictText && (
                  <div style={{ textAlign:'center', padding:'16px 28px', borderRadius:14, background:vs.bg, border:`1.5px solid ${vs.border}` }}>
                    <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>AI Verdict</p>
                    <p style={{ fontSize:22, fontWeight:700, color:vs.color, letterSpacing:'-0.01em' }}>{vs.icon} {verdictText}</p>
                  </div>
                )}
              </div>

              {(techScore > 0 || fundScore > 0) && (
                <div className="score-row" style={{
                  display:'flex', justifyContent:'center', gap:36, marginTop:24, padding:'20px 0 0',
                  borderTop:'1px solid rgba(0,0,0,0.06)',
                }}>
                  {techScore > 0 && (
                    <div style={{ textAlign:'center' }}>
                      <ScoreRing score={techScore} color="#4f46e5" />
                      <p className="label-text" style={{ marginTop:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Technical (45%)</p>
                    </div>
                  )}
                  {fundScore > 0 && (
                    <div style={{ textAlign:'center' }}>
                      <ScoreRing score={fundScore} color="#7c4dff" />
                      <p className="label-text" style={{ marginTop:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Fundamental (55%)</p>
                    </div>
                  )}
                  {compositeScore > 0 && (
                    <div style={{ textAlign:'center' }}>
                      <ScoreRing score={compositeScore} size={84} stroke={6} color={vs.color} />
                      <p className="label-text" style={{ marginTop:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Composite</p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Overall Summary */}
            {overallSummary && (
              <Card style={{ marginBottom:14, animationDelay:'0.03s' }}>
                <p style={{ fontSize:14, lineHeight:1.7, color:'var(--text-secondary)' }}>{overallSummary}</p>
              </Card>
            )}

            {/* Market Stats Row */}
            {(d.dayHigh || d.volume || d.weekHigh52) && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:8, marginBottom:14 }}>
                {[
                  d.open && { l:'Open', v:`₹${d.open}` },
                  d.dayHigh && { l:'Day High', v:`₹${d.dayHigh}` },
                  d.dayLow && { l:'Day Low', v:`₹${d.dayLow}` },
                  d.previousClose && { l:'Prev Close', v:`₹${d.previousClose}` },
                  d.volume && { l:'Volume', v: typeof d.volume === 'number' ? (d.volume >= 1e7 ? `${(d.volume/1e7).toFixed(1)} Cr` : d.volume >= 1e5 ? `${(d.volume/1e5).toFixed(1)} L` : d.volume.toLocaleString()) : d.volume },
                  d.weekHigh52 && { l:'52W High', v:`₹${d.weekHigh52}` },
                  d.weekLow52 && { l:'52W Low', v:`₹${d.weekLow52}` },
                  d.marketCap && { l:'Market Cap', v: d.marketCap },
                ].filter(Boolean).map((item, i) => (
                  <div key={i} className="fund-item">
                    <span className="fund-label">{item.l}</span>
                    <span className="mono-value" style={{ fontSize:13 }}>{item.v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Chart Pattern — full-width prominent card */}
            {chartPattern && chartPattern.pattern && (
              <Card title="Current Chart Pattern" icon="📐" accentColor="#7c3aed" style={{ marginBottom:14, animationDelay:'0.05s' }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:16, alignItems:'flex-start' }}>
                  <div style={{ flex:'1 1 300px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                      <span style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>{chartPattern.pattern}</span>
                      <span style={{
                        fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:6,
                        background: chartPattern.implication === 'Bullish' ? 'rgba(22,163,74,0.08)' : chartPattern.implication === 'Bearish' ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)',
                        color: chartPattern.implication === 'Bullish' ? '#16a34a' : chartPattern.implication === 'Bearish' ? '#dc2626' : '#d97706',
                        textTransform:'uppercase', letterSpacing:'0.05em',
                      }}>{chartPattern.implication}</span>
                      {chartPattern.timeframe && <span className="label-text">({chartPattern.timeframe})</span>}
                    </div>
                    {chartPattern.description && (
                      <p style={{ fontSize:13, lineHeight:1.65, color:'var(--text-secondary)', marginBottom:12 }}>{chartPattern.description}</p>
                    )}
                    {chartPattern.additionalPatterns && chartPattern.additionalPatterns.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {chartPattern.additionalPatterns.map((p, i) => (
                          <span key={i} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, background:'var(--pill-bg)', border:'1px solid var(--pill-border)', color:'var(--text-secondary)', fontWeight:500 }}>{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8, flex:'0 0 auto', minWidth:200 }}>
                    {[
                      chartPattern.breakoutLevel && { l:'Breakout', v:`₹${chartPattern.breakoutLevel}`, c:'#4f46e5' },
                      chartPattern.targetPrice && { l:'Target', v:`₹${chartPattern.targetPrice}`, c:'#16a34a' },
                      chartPattern.stopLoss && { l:'Stop Loss', v:`₹${chartPattern.stopLoss}`, c:'#dc2626' },
                      chartPattern.completionPercent && { l:'Completion', v:`${chartPattern.completionPercent}%`, c:'#7c3aed' },
                    ].filter(Boolean).map((item, i) => (
                      <div key={i} className="fund-item">
                        <span className="fund-label">{item.l}</span>
                        <span className="mono-value" style={{ color:item.c }}>{item.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Grid */}
            <div className="results-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>

              {/* Moving Averages */}
              {Array.isArray(movingAverages) && movingAverages.length > 0 && (
                <Card title="Moving Averages" icon="〰️" accentColor="#4f46e5" style={{ animationDelay:'0.06s' }}>
                  {maSummary && <p style={{ fontSize:13, lineHeight:1.6, color:'var(--text-secondary)', marginBottom:14, padding:'10px 14px', background:'rgba(79,70,229,0.04)', borderRadius:8, borderLeft:'3px solid #4f46e5' }}>{maSummary}</p>}
                  <div style={{ display:'grid', gap:5 }}>
                    {movingAverages.map((t, i) => (
                      <IndicatorPill key={i} label={t.name} value={t.value} signal={t.signal} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Momentum Indicators */}
              {Array.isArray(momentumIndicators) && momentumIndicators.length > 0 && (
                <Card title="Momentum" icon="⚡" accentColor="#d97706" style={{ animationDelay:'0.08s' }}>
                  <div style={{ display:'grid', gap:5 }}>
                    {momentumIndicators.map((t, i) => (
                      <IndicatorPill key={i} label={t.name} value={t.value} signal={t.signal} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Trend Indicators */}
              {Array.isArray(trendIndicators) && trendIndicators.length > 0 && (
                <Card title="Trend" icon="📈" accentColor="#16a34a" style={{ animationDelay:'0.1s' }}>
                  <div style={{ display:'grid', gap:5 }}>
                    {trendIndicators.map((t, i) => (
                      <IndicatorPill key={i} label={t.name} value={t.value} signal={t.signal} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Volatility Indicators */}
              {Array.isArray(volatilityIndicators) && volatilityIndicators.length > 0 && (
                <Card title="Volatility" icon="📊" accentColor="#ea580c" style={{ animationDelay:'0.12s' }}>
                  <div style={{ display:'grid', gap:5 }}>
                    {volatilityIndicators.map((t, i) => (
                      <IndicatorPill key={i} label={t.name} value={t.value} signal={t.signal} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Volume Indicators */}
              {Array.isArray(volumeIndicators) && volumeIndicators.length > 0 && (
                <Card title="Volume Analysis" icon="📶" accentColor="#0891b2" style={{ animationDelay:'0.14s' }}>
                  <div style={{ display:'grid', gap:5 }}>
                    {volumeIndicators.map((t, i) => (
                      <IndicatorPill key={i} label={t.name} value={t.value} signal={t.signal} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Support & Resistance */}
              {Object.keys(supportResistance).length > 0 && (
                <Card title="Support & Resistance" icon="🎯" accentColor="#7c3aed" style={{ animationDelay:'0.16s' }}>
                  <div className="fund-grid">
                    {Object.entries(supportResistance).map(([key, val]) => {
                      const isSupport = key.toLowerCase().includes('support') || key.toLowerCase().includes('fib');
                      const isResistance = key.toLowerCase().includes('resistance');
                      return (
                        <div className="fund-item" key={key}>
                          <span className="fund-label">{key.replace(/([A-Z])/g,' $1').replace(/(\d)/,' $1').trim()}</span>
                          <span className="fund-value" style={{ color: isSupport ? '#16a34a' : isResistance ? '#dc2626' : 'var(--text-primary)' }}>
                            {typeof val === 'number' ? `₹${val.toLocaleString('en-IN')}` : val}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Fallback: legacy technicalIndicators */}
              {Array.isArray(technicals) && technicals.length > 0 && movingAverages.length === 0 && (
                <Card title="Technical Indicators" icon="📊" accentColor="#4f46e5" style={{ animationDelay:'0.05s' }}>
                  <div style={{ display:'grid', gap:5 }}>
                    {technicals.map((t, i) => (
                      <IndicatorPill key={i}
                        label={t.name || t.indicator || t.label || Object.keys(t)[0]}
                        value={t.value ?? t[Object.keys(t)[0]]}
                        signal={t.signal || t.interpretation} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Candlestick Patterns */}
              {Array.isArray(candlestickPatterns) && candlestickPatterns.length > 0 && (
                <Card title="Candlestick Patterns" icon="🕯" accentColor="#ea580c" style={{ animationDelay:'0.18s' }}>
                  <div style={{ display:'grid', gap:6 }}>{candlestickPatterns.map((p, i) => <TextBlock key={i} item={p} />)}</div>
                </Card>
              )}

              {/* Fundamentals */}
              {Object.keys(fundamentals).length > 0 && (
                <Card title="Fundamental Metrics" icon="📋" accentColor="#7c3aed" style={{ animationDelay:'0.2s' }}>
                  <div className="fund-grid">
                    {Object.entries(fundamentals).map(([key, val]) => (
                      <div className="fund-item" key={key}>
                        <span className="fund-label">{key.replace(/([A-Z])/g,' $1').replace(/_/g,' ').trim()}</span>
                        <span className="fund-value">{val ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Shareholding */}
              {Object.keys(shareholding).length > 0 && (
                <Card title="Shareholding Pattern" icon="🏛" accentColor="#0891b2" style={{ animationDelay:'0.22s' }}>
                  <ShareholdingBar data={shareholding} />
                </Card>
              )}

              {/* Smart Money */}
              {Array.isArray(smartMoney) && smartMoney.length > 0 && (
                <Card title="Smart Money Signals" icon="💰" accentColor="#d97706" style={{ animationDelay:'0.24s' }}>
                  <div style={{ display:'grid', gap:6 }}>
                    {smartMoney.map((item, i) => <TextBlock key={i} item={item} />)}
                  </div>
                </Card>
              )}

              {/* News */}
              {Array.isArray(news) && news.length > 0 && (
                <Card title="Recent News" icon="📰" accentColor="#16a34a" style={{ animationDelay:'0.26s' }}>
                  <div style={{ display:'grid', gap:5 }}>{news.map((item, i) => <NewsItem key={i} item={item} />)}</div>
                </Card>
              )}

              {/* Risks & Catalysts */}
              {(risks.length > 0 || catalysts.length > 0) && (
                <Card title="Risks & Catalysts" icon="⚠️" accentColor="#dc2626" style={{ animationDelay:'0.28s' }}>
                  {risks.length > 0 && (
                    <div style={{ marginBottom: catalysts.length > 0 ? 18 : 0 }}>
                      <p style={{ fontSize:12, color:'#dc2626', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Risks</p>
                      {risks.map((r, i) => (
                        <p key={i} style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:6, paddingLeft:12, borderLeft:'2px solid rgba(220,38,38,0.25)' }}>
                          {typeof r === 'string' ? r : r.description || JSON.stringify(r)}
                        </p>
                      ))}
                    </div>
                  )}
                  {catalysts.length > 0 && (
                    <div>
                      <p style={{ fontSize:12, color:'#16a34a', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Catalysts</p>
                      {catalysts.map((c, i) => (
                        <p key={i} style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:6, paddingLeft:12, borderLeft:'2px solid rgba(22,163,74,0.25)' }}>
                          {typeof c === 'string' ? c : c.description || JSON.stringify(c)}
                        </p>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Strategies */}
              {Array.isArray(strategies) && strategies.length > 0 && (
                <Card title="Trading Strategies" icon="🎯" accentColor="#4f46e5" style={{ animationDelay:'0.3s' }}>
                  <div style={{ display:'grid', gap:6 }}>{strategies.map((s, i) => <TextBlock key={i} item={s} />)}</div>
                </Card>
              )}

              {/* Research Links */}
              {Array.isArray(researchLinks) && researchLinks.length > 0 && (
                <Card title="Research Links" icon="🔗" accentColor="#0891b2" style={{ animationDelay:'0.32s' }}>
                  <div style={{ display:'grid', gap:5 }}>
                    {researchLinks.map((link, i) => (
                      <a key={i} href={link.url || link.href || link} target="_blank" rel="noopener noreferrer"
                        className="news-item" style={{ color:'var(--accent-blue)', fontWeight:500, display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:14 }}>↗</span>
                        {link.title || link.name || link.url || link}
                      </a>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Disclaimer */}
            <div style={{
              marginTop:28, padding:'14px 20px', borderRadius:'var(--radius-md)',
              background:'#ffffff', border:'1px solid rgba(0,0,0,0.06)', textAlign:'center',
            }}>
              <p style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.65 }}>
                <strong style={{ color:'var(--text-secondary)' }}>Disclaimer:</strong> For informational and educational purposes only. Not financial or investment advice. Always consult a SEBI-registered financial advisor.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
