// pages/stocks.js — Free Stocks Screener with auto-refresh
import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

function fmtNum(n) { if (n == null || isNaN(n)) return '—'; if (Math.abs(n) >= 100000) return n.toLocaleString('en-IN', { maximumFractionDigits: 2 }); return Number(n).toFixed(2); }
function fmtPct(n) { return (n == null || isNaN(n)) ? '—' : Number(n).toFixed(2); }
function fmtVol(v) { if (!v) return '—'; if (v >= 1e7) return (v / 1e7).toFixed(1) + ' Cr'; if (v >= 1e5) return (v / 1e5).toFixed(1) + ' L'; if (v >= 1e3) return (v / 1e3).toFixed(1) + ' K'; return String(v); }
function timeAgo(ts) {
  if (!ts) return '';
  var diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  return Math.floor(diff / 3600) + 'h ago';
}

export default function StocksPage() {
  var router = useRouter();
  var [tvData, setTvData] = useState([]);
  var [tvLoading, setTvLoading] = useState(true);
  var [tvError, setTvError] = useState('');
  var [tvIndex, setTvIndex] = useState('nifty50');
  var [tvSort, setTvSort] = useState({ col: 'changePct', dir: 'desc' });
  var [tvFilter, setTvFilter] = useState('all');
  var [lastUpdated, setLastUpdated] = useState('');
  var [refreshing, setRefreshing] = useState(false);
  var [countdown, setCountdown] = useState(30);

  var [mktIndices, setMktIndices] = useState([]);
  var [mktError, setMktError] = useState('');
  var mktRef = useRef(null);
  var stockRef = useRef(null);
  var countRef = useRef(null);
  var tvIndexRef = useRef(tvIndex);

  // Keep ref in sync
  useEffect(function() { tvIndexRef.current = tvIndex; }, [tvIndex]);

  // Market ticker — auto refresh every 30s
  useEffect(function() {
    function fetchMkt() {
      fetch('/api/market').then(function(r) { return r.json(); }).then(function(d) {
        if (d.error) { setMktError(d.error); return; }
        setMktError('');
        if (d.indices) setMktIndices(d.indices);
      }).catch(function() { setMktError('Market data unavailable'); });
    }
    fetchMkt();
    mktRef.current = setInterval(fetchMkt, 30000);
    return function() { clearInterval(mktRef.current); };
  }, []);

  // Stock data fetch
  var fetchData = useCallback(function(idx, silent) {
    var index = idx || tvIndexRef.current;
    if (!silent) setTvLoading(true);
    else setRefreshing(true);
    setTvError('');
    fetch('/api/tv-screener?index=' + index).then(function(r) { return r.json(); }).then(function(d) {
      if (d.error) { setTvError(d.error); setTvData([]); }
      else { setTvData(d.results || []); setLastUpdated(d.timestamp || new Date().toISOString()); }
      setTvLoading(false);
      setRefreshing(false);
      setCountdown(30);
    }).catch(function(e) { setTvError(e.message || 'Failed'); setTvLoading(false); setRefreshing(false); });
  }, []);

  // Initial fetch + auto refresh every 30s
  useEffect(function() {
    fetchData(tvIndex, false);
    stockRef.current = setInterval(function() {
      fetchData(null, true); // silent refresh
    }, 30000);
    return function() { clearInterval(stockRef.current); };
  }, [tvIndex]);

  // Countdown timer
  useEffect(function() {
    countRef.current = setInterval(function() {
      setCountdown(function(c) { return c > 0 ? c - 1 : 30; });
    }, 1000);
    return function() { clearInterval(countRef.current); };
  }, []);

  // Sort
  var sortData = function(data) {
    var s = data.slice();
    s.sort(function(a, b) {
      var aV = a[tvSort.col], bV = b[tvSort.col];
      if (aV == null) aV = -Infinity; if (bV == null) bV = -Infinity;
      if (typeof aV === 'string') return tvSort.dir === 'asc' ? aV.localeCompare(bV) : bV.localeCompare(aV);
      return tvSort.dir === 'asc' ? aV - bV : bV - aV;
    });
    return s;
  };
  var toggleSort = function(col) {
    setTvSort(function(p) {
      return p.col === col ? { col: col, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { col: col, dir: 'desc' };
    });
  };

  var filtered = tvData.filter(function(r) {
    if (tvFilter === 'gainers') return r.changePct > 0;
    if (tvFilter === 'losers') return r.changePct < 0;
    return true;
  });
  filtered = sortData(filtered);
  var isLoggedIn = false;
  try { isLoggedIn = JSON.parse(localStorage.getItem('eat_auth') || '{}').loggedIn; } catch (e) {}

  return (<>
    <Head><title>Stocks — Equity Analysis Terminal</title></Head>
    <style jsx>{`
      .nav{display:flex;align-items:center;justify-content:space-between;padding:16px 40px;max-width:1200px;margin:0 auto}.nav-logo{display:flex;align-items:center;gap:10px;cursor:pointer}.nav-links{display:flex;align-items:center;gap:20px}.nav-link{font-size:13px;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:color 0.15s}.nav-link:hover{color:#4f46e5}.nav-link.active{color:#4f46e5;font-weight:600}.nav-btn{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all 0.2s;font-family:'DM Sans',sans-serif}
      .mkt-bar{height:38px;background:#fff;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;overflow-x:auto;box-shadow:0 1px 2px rgba(0,0,0,0.03)}.mkt-bar::-webkit-scrollbar{display:none}.mkt-label{padding:0 14px;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#4f46e5;border-right:1px solid rgba(0,0,0,0.06);height:100%;display:flex;align-items:center;flex-shrink:0}.mkt-item{display:flex;align-items:center;gap:7px;padding:0 18px;height:38px;border-right:1px solid rgba(0,0,0,0.03);flex-shrink:0;white-space:nowrap;font-size:11px}.mkt-sym{font-weight:600;color:var(--text-primary);font-family:'JetBrains Mono',monospace}.mkt-price{color:var(--text-secondary);font-family:'JetBrains Mono',monospace}.mkt-chg{font-weight:600;font-family:'JetBrains Mono',monospace;font-size:10px}.up{color:#16a34a}.down{color:#dc2626}
      .content{max-width:1200px;margin:0 auto;padding:20px 40px 40px}.filter-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding:12px 16px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:12px}.filter-group{display:flex;gap:4px}.fchip{padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;border:1px solid rgba(0,0,0,0.08);background:#fff;color:var(--text-secondary);cursor:pointer;transition:all 0.15s;white-space:nowrap}.fchip:hover{border-color:#4f46e5;color:#4f46e5}.fchip.active{background:#4f46e5;color:#fff;border-color:#4f46e5}
      .table-wrap{overflow-x:auto;border-radius:12px;border:1px solid rgba(0,0,0,0.06);background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04)}table{width:100%;border-collapse:collapse;font-size:12px;min-width:900px}th{padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid rgba(0,0,0,0.08);cursor:pointer;white-space:nowrap;user-select:none;background:#fafbfc;position:sticky;top:0}th:hover{color:var(--text-primary)}th.r{text-align:right}tr.row{transition:background 0.12s}tr.row:hover{background:rgba(79,70,229,0.03)}td{padding:10px 12px;border-bottom:1px solid rgba(0,0,0,0.04);font-size:12px;color:var(--text-secondary)}td.r{text-align:right}.mono{font-family:'JetBrains Mono',monospace;font-weight:500}
      .abtn{padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;font-family:'DM Sans',sans-serif;border:1px solid rgba(79,70,229,0.2);background:rgba(79,70,229,0.04);color:#4f46e5;cursor:pointer;transition:all 0.15s}.abtn:hover{background:#4f46e5;color:#fff}.loader{width:40px;height:40px;border:3px solid rgba(0,0,0,0.06);border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}.err{padding:14px 20px;border-radius:12px;background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.15);color:#dc2626;font-size:14px;text-align:center;margin-bottom:16px}
      .live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#16a34a;margin-right:6px;animation:pulse 2s infinite}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      .refresh-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:10px;font-size:11px;color:var(--text-muted);margin-bottom:12px}
      .progress-bg{width:60px;height:3px;background:rgba(0,0,0,0.06);border-radius:2px;overflow:hidden}.progress-fill{height:100%;background:#4f46e5;border-radius:2px;transition:width 1s linear}
      .foot{margin-top:40px;border-top:1px solid rgba(0,0,0,0.06);background:#fff}.foot-inner{max-width:1200px;margin:0 auto;padding:32px 40px 20px;display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:28px}.foot-title{font-size:12px;font-weight:700;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px}.foot-link{display:block;font-size:13px;color:var(--text-secondary);padding:2px 0;cursor:pointer;transition:color 0.15s}.foot-link:hover{color:#4f46e5}.foot-bottom{border-top:1px solid rgba(0,0,0,0.04);padding:14px 40px;max-width:1200px;margin:0 auto}
      @media(max-width:768px){.content{padding:16px 20px}.foot-inner{grid-template-columns:1fr!important;gap:20px}.nav{padding:12px 20px}.nav-links{gap:12px}}
    `}</style>

    {/* Market Ticker */}
    <div className="mkt-bar"><div className="mkt-label">MARKET</div>
      {mktError ? <div className="mkt-item"><span style={{color:'var(--text-muted)',fontSize:11}}>{mktError}</span></div>
       : mktIndices.length === 0 ? <div className="mkt-item"><span style={{color:'var(--text-muted)'}}>Loading…</span></div>
       : mktIndices.map(function(idx) { var u = idx.change >= 0; return (<div key={idx.symbol} className="mkt-item"><span className="mkt-sym">{idx.short}</span><span className="mkt-price">{fmtNum(idx.price)}</span><span className={'mkt-chg ' + (u ? 'up' : 'down')}>{u?'+':''}{fmtNum(idx.change)} ({u?'+':''}{fmtPct(idx.changePercent)}%)</span></div>); })
      }
    </div>

    {/* Nav */}
    <nav className="nav">
      <div className="nav-logo" onClick={function(){router.push('/')}}>
        <div style={{width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#4f46e5,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:'#fff'}}>₹</div>
        <div><div style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>Equity Analysis Terminal</div><div style={{fontSize:10,color:'var(--text-muted)',fontWeight:500,letterSpacing:'0.06em',textTransform:'uppercase'}}>BSE · NSE · AI-Powered</div></div>
      </div>
      <div className="nav-links">
        <span className="nav-link" onClick={function(){router.push('/')}}>Home</span>
        <span className="nav-link active">Stocks</span>
        <span className="nav-link" onClick={function(){router.push('/about')}}>About</span>
        {isLoggedIn
          ? <button className="nav-btn" style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',color:'#fff'}} onClick={function(){router.push('/app')}}>Open App →</button>
          : <button className="nav-btn" style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',color:'#fff'}} onClick={function(){router.push('/')}}>Login</button>}
      </div>
    </nav>

    <div className="content">
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:24,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>Stock Screener</h2>
        <p style={{fontSize:13,color:'var(--text-muted)'}}>
          <span className="live-dot"></span>Live NSE data · Auto-refreshes every 30s · Free, no login required
        </p>
      </div>

      {/* Auto-refresh status bar */}
      {!tvLoading && tvData.length > 0 && (
        <div className="refresh-bar">
          <span>
            {refreshing ? '🔄 Refreshing…' : '✓ Updated ' + timeAgo(lastUpdated)}
            {' · '}{filtered.length} of {tvData.length} stocks
          </span>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span>Next refresh in {countdown}s</span>
            <div className="progress-bg"><div className="progress-fill" style={{width: ((30 - countdown) / 30 * 100) + '%'}}></div></div>
            <button className="fchip" style={{padding:'3px 10px',fontSize:11}} onClick={function(){fetchData(null, true); setCountdown(30);}}>Refresh now</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group">
          {[{key:'nifty50',label:'Nifty 50'},{key:'banknifty',label:'Bank Nifty'},{key:'niftyit',label:'Nifty IT'}].map(function(idx){return(<button key={idx.key} className={'fchip'+(tvIndex===idx.key?' active':'')} onClick={function(){setTvIndex(idx.key);}}>{idx.label}</button>);})}
        </div>
        <div className="filter-group">
          {[{key:'all',label:'All'},{key:'gainers',label:'▲ Gainers'},{key:'losers',label:'▼ Losers'}].map(function(f){return(<button key={f.key} className={'fchip'+(tvFilter===f.key?' active':'')} onClick={function(){setTvFilter(f.key);}}>{f.label}</button>);})}
        </div>
      </div>

      {/* Loading */}
      {tvLoading && <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'60px 0',gap:16}}><div className="loader"/><span style={{fontSize:14,color:'var(--text-muted)'}}>Loading stock data…</span></div>}
      {tvError && <div className="err">{tvError}</div>}

      {/* Table */}
      {!tvLoading && filtered.length > 0 && (
        <div className="table-wrap"><table><thead><tr>
          {[{key:'symbol',label:'Symbol',al:''},{key:'price',label:'Price',al:'r'},{key:'changePct',label:'Chg %',al:'r'},{key:'volume',label:'Volume',al:'r'},{key:'open',label:'Open',al:'r'},{key:'dayHigh',label:'High',al:'r'},{key:'dayLow',label:'Low',al:'r'},{key:'weekHigh52',label:'52W H',al:'r'},{key:'weekLow52',label:'52W L',al:'r'},{key:'sector',label:'Sector',al:''}].map(function(col){var isSorted=tvSort.col===col.key;return(<th key={col.key} className={col.al} onClick={function(){toggleSort(col.key);}}>{col.label}{isSorted&&<span style={{fontSize:10,color:'#4f46e5'}}>{tvSort.dir==='asc'?' ▲':' ▼'}</span>}</th>);})}
          <th className="r" style={{width:70}}>Action</th>
        </tr></thead><tbody>
          {filtered.map(function(r,i){var u=r.changePct>=0;return(
            <tr key={r.symbol} className="row">
              <td><span style={{fontWeight:600,color:'var(--text-primary)',fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{r.symbol}</span></td>
              <td className="r mono">{'₹'+fmtNum(r.price)}</td>
              <td className={'r mono '+(u?'up':'down')} style={{fontWeight:600}}>{u?'+':''}{fmtPct(r.changePct)}%</td>
              <td className="r mono">{fmtVol(r.volume)}</td>
              <td className="r mono">{'₹'+fmtNum(r.open)}</td>
              <td className="r mono">{'₹'+fmtNum(r.dayHigh)}</td>
              <td className="r mono">{'₹'+fmtNum(r.dayLow)}</td>
              <td className="r mono">{'₹'+fmtNum(r.weekHigh52)}</td>
              <td className="r mono">{'₹'+fmtNum(r.weekLow52)}</td>
              <td style={{fontSize:11,color:'var(--text-muted)'}}>{r.sector}</td>
              <td className="r">{isLoggedIn?<button className="abtn" onClick={function(){router.push('/app?stock='+r.symbol);}}>Analyse</button>:<button className="abtn" onClick={function(){router.push('/?next=app&stock='+r.symbol);}}>Login</button>}</td>
            </tr>);})}
        </tbody></table></div>
      )}

      {!tvLoading&&!tvError&&filtered.length===0&&tvData.length>0&&(
        <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)',fontSize:14}}>No stocks match the current filter</div>
      )}

      {/* Upgrade CTA */}
      {!isLoggedIn&&!tvLoading&&tvData.length>0&&(
        <div style={{marginTop:24,padding:'20px 28px',borderRadius:14,background:'linear-gradient(135deg,rgba(79,70,229,0.06),rgba(124,58,237,0.04))',border:'1px solid rgba(79,70,229,0.12)',textAlign:'center'}}>
          <p style={{fontSize:16,fontWeight:700,color:'var(--text-primary)',marginBottom:6}}>Want AI-powered stock analysis?</p>
          <p style={{fontSize:13,color:'var(--text-secondary)',marginBottom:14}}>Login for free to access Analyse and Screener tools — technical indicators, chart patterns, AI verdicts.</p>
          <button className="nav-btn" style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',color:'#fff',padding:'10px 28px',fontSize:14}} onClick={function(){router.push('/');}}>Get Free Access →</button>
        </div>
      )}
    </div>

    {/* Footer */}
    <footer className="foot"><div className="foot-inner">
      <div><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}><div style={{width:28,height:28,borderRadius:7,background:'linear-gradient(135deg,#4f46e5,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#fff'}}>₹</div><span style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>Equity Analysis Terminal</span></div><p style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,marginBottom:6}}>AI-powered stock analysis tool</p><p style={{fontSize:11,color:'var(--text-muted)'}}>Made with ❤ in India</p></div>
      <div><p className="foot-title">Product</p><span className="foot-link" onClick={function(){router.push('/stocks')}}>Stocks</span><span className="foot-link" onClick={function(){router.push('/')}}>Analyse</span><span className="foot-link" onClick={function(){router.push('/')}}>Screener</span></div>
      <div><p className="foot-title">Resources</p><a href="https://www.nseindia.com" target="_blank" rel="noopener noreferrer" className="foot-link">NSE India ↗</a><a href="https://www.bseindia.com" target="_blank" rel="noopener noreferrer" className="foot-link">BSE India ↗</a></div>
      <div><p className="foot-title">Data</p><p style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6}}>Market data via NSE/BSE. Analysis by Gemini AI.</p></div>
    </div><div className="foot-bottom"><p style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',lineHeight:1.65,maxWidth:700,margin:'0 auto'}}><strong style={{color:'var(--text-secondary)'}}>Disclaimer:</strong> For informational and educational purposes only. Not financial advice. Consult a SEBI-registered advisor.</p></div></footer>
  </>);
}
