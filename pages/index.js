// pages/index.js — Landing + Login Page
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function LoginPage() {
  var router = useRouter();
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [isRegister, setIsRegister] = useState(false);
  var [error, setError] = useState('');

  useEffect(function() {
    try {
      var auth = JSON.parse(localStorage.getItem('eat_auth') || '{}');
      if (auth.loggedIn) router.replace('/app');
    } catch (e) {}
  }, []);

  var handleSubmit = function(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (!password.trim() || password.length < 4) { setError('Password must be at least 4 characters'); return; }
    localStorage.setItem('eat_auth', JSON.stringify({ loggedIn: true, email: email.trim(), ts: Date.now() }));
    router.push('/app');
  };

  return (
    <>
      <Head><title>Equity Analysis Terminal — AI-Powered Stock Analysis</title></Head>
      <style jsx>{`
        .nav{display:flex;align-items:center;justify-content:space-between;padding:20px 40px;max-width:1200px;margin:0 auto}
        .nav-logo{display:flex;align-items:center;gap:10px;cursor:pointer}
        .nav-links{display:flex;align-items:center;gap:24px}
        .nav-link{font-size:14px;font-weight:500;color:var(--text-secondary);transition:color 0.15s;cursor:pointer}
        .nav-link:hover{color:var(--accent-blue)}
        .hero{display:grid;grid-template-columns:1fr 1fr;gap:60px;max-width:1100px;margin:0 auto;padding:48px 40px 80px;align-items:center;min-height:calc(100vh - 280px)}
        .hero-left h2{font-size:42px;font-weight:700;line-height:1.15;letter-spacing:-0.03em;color:var(--text-primary);margin-bottom:16px}
        .hero-left p.sub{font-size:16px;color:var(--text-secondary);line-height:1.7;margin-bottom:28px;max-width:440px}
        .feature-list{display:flex;flex-direction:column;gap:12px;margin-bottom:28px}
        .feature-item{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:var(--text-secondary);line-height:1.5}
        .feature-dot{width:6px;height:6px;border-radius:50%;background:var(--accent-blue);flex-shrink:0;margin-top:7px}
        .btn-stocks{padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;background:#ffffff;color:var(--accent-blue);border:1.5px solid rgba(79,70,229,0.25);cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif}
        .btn-stocks:hover{background:rgba(79,70,229,0.05);border-color:var(--accent-blue);transform:translateY(-1px)}
        .form-card{background:#ffffff;border-radius:20px;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04);position:relative;overflow:hidden}
        .form-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#4f46e5,#7c3aed)}
        .form-title{font-size:22px;font-weight:700;color:var(--text-primary);margin-bottom:4px}
        .form-subtitle{font-size:13px;color:var(--text-muted);margin-bottom:24px}
        .form-label{display:block;font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em}
        .form-input{width:100%;padding:12px 16px;font-size:14px;font-family:'DM Sans',sans-serif;border:1.5px solid rgba(0,0,0,0.1);border-radius:10px;outline:none;transition:all 0.2s;background:#fafbfc;color:var(--text-primary)}
        .form-input:focus{border-color:#4f46e5;box-shadow:0 0 0 4px rgba(79,70,229,0.08);background:#ffffff}
        .form-group{margin-bottom:18px}
        .form-btn{width:100%;padding:14px;border:none;border-radius:10px;font-size:15px;font-weight:700;color:#ffffff;background:linear-gradient(135deg,#4f46e5,#7c3aed);cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:0.06em}
        .form-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(79,70,229,0.3)}
        .form-switch{text-align:center;margin-top:16px;font-size:13px;color:var(--text-muted)}
        .form-switch span{color:#4f46e5;font-weight:600;cursor:pointer}
        .form-error{background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.15);color:#dc2626;font-size:13px;padding:10px 14px;border-radius:8px;margin-bottom:16px}
        .stats-row{display:flex;gap:32px;padding:32px 0;border-top:1px solid rgba(0,0,0,0.06);margin-top:32px}
        .stat{text-align:center;flex:1}
        .stat-num{font-size:28px;font-weight:700;color:#4f46e5;font-family:'JetBrains Mono',monospace;margin-bottom:4px}
        .stat-label{font-size:12px;color:var(--text-muted);font-weight:500}
        .footer{border-top:1px solid rgba(0,0,0,0.06);background:#ffffff;padding:40px}
        .footer-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:32px}
        .footer-col-title{font-size:12px;font-weight:700;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px}
        .footer-link{display:block;font-size:13px;color:var(--text-secondary);padding:3px 0;transition:color 0.15s;cursor:pointer}
        .footer-link:hover{color:#4f46e5}
        .footer-disc{border-top:1px solid rgba(0,0,0,0.04);padding:16px 40px;text-align:center;max-width:1100px;margin:0 auto}
        @media(max-width:768px){.hero{grid-template-columns:1fr;gap:32px;padding:28px 20px 50px}.hero-left h2{font-size:28px}.nav{padding:16px 20px}.footer-inner{grid-template-columns:1fr;gap:20px}.stats-row{gap:16px}.stat-num{font-size:22px}}
      `}</style>

      {/* Background accents */}
      <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:'-15%', right:'-5%', width:'45%', height:'45%', background:'radial-gradient(ellipse, rgba(79,70,229,0.04) 0%, transparent 65%)', filter:'blur(60px)' }} />
      </div>

      <div style={{ position:'relative', zIndex:1 }}>
        {/* Nav */}
        <nav className="nav">
          <div className="nav-logo" onClick={function() { router.push('/'); }}>
            <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg, #4f46e5, #7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#fff' }}>₹</div>
            <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>Equity Analysis Terminal</span>
          </div>
          <div className="nav-links">
            <span className="nav-link" onClick={function() { router.push('/stocks'); }}>Stocks</span>
            <span className="nav-link" onClick={function() { router.push('/about'); }}>About</span>
          </div>
        </nav>

        {/* Hero + Form */}
        <div className="hero">
          <div className="hero-left" style={{ animation:'fadeUp 0.5s ease both' }}>
            <div style={{ marginBottom:14 }}>
              <span style={{ display:'inline-block', padding:'5px 12px', borderRadius:6, background:'rgba(79,70,229,0.06)', border:'1px solid rgba(79,70,229,0.14)', fontSize:11, fontWeight:600, color:'#4f46e5', letterSpacing:'0.07em', textTransform:'uppercase' }}>
                Free · AI-Powered · NSE + BSE
              </span>
            </div>
            <h2>Comprehensive Stock Intelligence</h2>
            <p className="sub">
              25+ technical indicators, candlestick patterns, smart money signals, fundamentals, news, and AI-scored verdicts — all in one query.
            </p>
            <div className="feature-list">
              <div className="feature-item"><span className="feature-dot" />AI analysis with Technical (45%) + Fundamental (55%) composite scoring</div>
              <div className="feature-item"><span className="feature-dot" />18 pre-built screener strategies — breakouts, golden cross, RSI, MACD</div>
              <div className="feature-item"><span className="feature-dot" />Live NSE stock data — Nifty 50, Bank Nifty, Nifty IT</div>
              <div className="feature-item"><span className="feature-dot" />Watchlist, CSV export, live charts, risk:reward calculator</div>
            </div>
            <button className="btn-stocks" onClick={function() { router.push('/stocks'); }}>
              📋 Browse Stocks — Free, No Login
            </button>
          </div>

          <div style={{ animation:'fadeUp 0.6s ease 0.1s both' }}>
            <div className="form-card">
              <p className="form-title">{isRegister ? 'Get a free account' : 'Welcome back'}</p>
              <p className="form-subtitle">{isRegister ? 'Sign up to access AI analysis and screener' : 'Login to access full analysis tools'}</p>
              {error && <div className="form-error">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={function(e) { setEmail(e.target.value); }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={function(e) { setPassword(e.target.value); }} />
                </div>
                <button type="submit" className="form-btn">{isRegister ? 'Create Account' : 'Login'}</button>
              </form>
              <p className="form-switch">
                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                <span onClick={function() { setIsRegister(!isRegister); setError(''); }}>{isRegister ? 'Login here' : 'Register'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ maxWidth:700, margin:'0 auto', padding:'0 40px' }}>
          <div className="stats-row">
            <div className="stat"><div className="stat-num">25+</div><div className="stat-label">Technical Indicators</div></div>
            <div className="stat"><div className="stat-num">18</div><div className="stat-label">Screener Strategies</div></div>
            <div className="stat"><div className="stat-num">5000+</div><div className="stat-label">NSE / BSE Stocks</div></div>
            <div className="stat"><div className="stat-num">3</div><div className="stat-label">AI Models</div></div>
          </div>
        </div>

        {/* Footer */}
        <footer className="footer" style={{ marginTop:40 }}>
          <div className="footer-inner">
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:28, height:28, borderRadius:7, background:'linear-gradient(135deg, #4f46e5, #7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff' }}>₹</div>
                <span style={{ fontSize:14, fontWeight:700 }}>Equity Analysis Terminal</span>
              </div>
              <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:6, lineHeight:1.5 }}>AI-powered stock analysis and screening tool</p>
              <p style={{ fontSize:12, color:'var(--text-muted)' }}>Made with <span style={{ color:'#dc2626' }}>❤</span> in India</p>
              <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>© 2025 · Powered by Google Gemini</p>
            </div>
            <div>
              <p className="footer-col-title">Product</p>
              <span className="footer-link" onClick={function() { router.push('/stocks'); }}>Stocks</span>
              <span className="footer-link" onClick={function() { router.push('/app'); }}>Analyse</span>
              <span className="footer-link" onClick={function() { router.push('/app'); }}>Screener</span>
            </div>
            <div>
              <p className="footer-col-title">Resources</p>
              <a href="https://www.nseindia.com" target="_blank" rel="noopener noreferrer" className="footer-link">NSE India ↗</a>
              <a href="https://www.bseindia.com" target="_blank" rel="noopener noreferrer" className="footer-link">BSE India ↗</a>
            </div>
            <div>
              <p className="footer-col-title">Company</p>
              <span className="footer-link" onClick={function() { router.push('/about'); }}>About</span>
            </div>
          </div>
          <div className="footer-disc">
            <p style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.6 }}><strong style={{ color:'var(--text-secondary)' }}>Disclaimer:</strong> For informational and educational purposes only. Not financial advice. Always consult a SEBI-registered advisor.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
