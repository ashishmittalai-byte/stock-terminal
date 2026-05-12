// pages/about.js — About Page
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function AboutPage() {
  var router = useRouter();

  return (
    <>
      <Head><title>About — Equity Analysis Terminal</title></Head>
      <style jsx>{`
        .nav{display:flex;align-items:center;justify-content:space-between;padding:20px 40px;max-width:1200px;margin:0 auto}
        .nav-logo{display:flex;align-items:center;gap:10px;cursor:pointer}
        .nav-links{display:flex;align-items:center;gap:24px}
        .nav-link{font-size:14px;font-weight:500;color:var(--text-secondary);transition:color 0.15s;cursor:pointer}
        .nav-link:hover{color:#4f46e5}
        .content{max-width:740px;margin:0 auto;padding:40px 40px 80px}
        .page-title{font-size:36px;font-weight:700;letter-spacing:-0.02em;color:var(--text-primary);margin-bottom:16px;line-height:1.2}
        .section{margin-bottom:36px}
        .section h3{font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:10px}
        .section p{font-size:15px;color:var(--text-secondary);line-height:1.75;margin-bottom:10px}
        .tech-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:12px}
        .tech-item{padding:14px 16px;border-radius:10px;background:#ffffff;border:1px solid rgba(0,0,0,0.06);font-size:13px}
        .tech-item strong{display:block;color:var(--text-primary);margin-bottom:2px;font-size:13px}
        .tech-item span{color:var(--text-muted);font-size:12px}
        .feature-card{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
        .f-card{padding:18px;border-radius:12px;background:#ffffff;border:1px solid rgba(0,0,0,0.06)}
        .f-card h4{font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:6px}
        .f-card p{font-size:13px;color:var(--text-muted);line-height:1.55;margin:0}
        .back-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-muted);cursor:pointer;transition:color 0.15s;margin-top:24px}
        .back-link:hover{color:#4f46e5}
        .footer{border-top:1px solid rgba(0,0,0,0.06);background:#ffffff;padding:32px 40px;margin-top:40px}
        .footer-inner{max-width:740px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
        .footer-links{display:flex;gap:20px}
        .footer-link{font-size:13px;color:var(--text-secondary);cursor:pointer;transition:color 0.15s}
        .footer-link:hover{color:#4f46e5}
        @media(max-width:768px){.content{padding:24px 20px 60px}.page-title{font-size:28px}.feature-card{grid-template-columns:1fr}.nav{padding:16px 20px}}
      `}</style>

      <div style={{ position:'relative', zIndex:1 }}>
        {/* Nav */}
        <nav className="nav">
          <div className="nav-logo" onClick={function() { router.push('/'); }}>
            <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg, #4f46e5, #7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#fff' }}>₹</div>
            <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>Equity Analysis Terminal</span>
          </div>
          <div className="nav-links">
            <span className="nav-link" onClick={function() { router.push('/stocks'); }}>Stocks</span>
            <span className="nav-link" onClick={function() { router.push('/'); }}>Login</span>
          </div>
        </nav>

        {/* Content */}
        <div className="content">
          <h1 className="page-title" style={{ animation:'fadeUp 0.5s ease both' }}>About Us</h1>

          <div className="section" style={{ animation:'fadeUp 0.5s ease 0.05s both' }}>
            <p>
              Equity Analysis Terminal was born out of a simple need — to have a single, comprehensive tool that brings together everything a retail investor needs to make informed decisions about Indian equities.
            </p>
            <p>
              As someone who has been following the Indian stock market and studying both technical analysis frameworks like Smart Money Concepts and fundamental analysis, I wanted a tool that combines live market data, AI-powered analysis, and professional-grade screening — without paying for expensive terminals or juggling multiple platforms.
            </p>
          </div>

          <div className="section" style={{ animation:'fadeUp 0.5s ease 0.1s both' }}>
            <h3>What We Do</h3>
            <p>
              We provide AI-powered stock analysis that covers over 5,000 NSE and BSE listed companies. Our analysis engine evaluates each stock across 25+ technical indicators, candlestick patterns, support/resistance levels, chart patterns, and fundamental metrics — then synthesizes everything into a weighted composite score with a clear verdict.
            </p>
          </div>

          <div className="section" style={{ animation:'fadeUp 0.5s ease 0.15s both' }}>
            <h3>Features</h3>
            <div className="feature-card">
              <div className="f-card">
                <h4>📊 AI Analysis</h4>
                <p>Comprehensive analysis with 8 moving averages, 18 technical indicators, candlestick patterns, smart money signals, and AI-scored verdict</p>
              </div>
              <div className="f-card">
                <h4>🔍 Strategy Screener</h4>
                <p>18 pre-built strategies including breakouts, golden cross, RSI oversold, MACD crossover, cup &amp; handle, and more</p>
              </div>
              <div className="f-card">
                <h4>📋 Live Stocks</h4>
                <p>Real-time NSE data for Nifty 50, Bank Nifty, and Nifty IT stocks with sortable table, price data, and day ranges</p>
              </div>
              <div className="f-card">
                <h4>🎯 Risk Management</h4>
                <p>Automatic risk:reward calculator, support/resistance levels, stop loss targets, and breakout levels for every scan</p>
              </div>
            </div>
          </div>

          <div className="section" style={{ animation:'fadeUp 0.5s ease 0.2s both' }}>
            <h3>Technology</h3>
            <p>Built with modern web technology and AI, designed to be fast and accessible.</p>
            <div className="tech-grid">
              <div className="tech-item"><strong>Frontend</strong><span>Next.js 14, React, Vercel</span></div>
              <div className="tech-item"><strong>AI Engine</strong><span>Google Gemini (multi-model waterfall)</span></div>
              <div className="tech-item"><strong>Market Data</strong><span>NSE India, Yahoo Finance</span></div>
              <div className="tech-item"><strong>Stock Search</strong><span>Yahoo Finance (5000+ stocks)</span></div>
              <div className="tech-item"><strong>Hosting</strong><span>Vercel (free tier)</span></div>
              <div className="tech-item"><strong>Cost</strong><span>₹0 — completely free</span></div>
            </div>
          </div>

          <div className="section" style={{ animation:'fadeUp 0.5s ease 0.25s both' }}>
            <h3>Philosophy</h3>
            <p>
              We believe that quality financial analysis tools should be accessible to everyone, not just institutional investors with Bloomberg terminals. Every retail investor deserves the same depth of analysis that professionals get — presented in a clear, actionable format.
            </p>
            <p>
              This tool is built on the principle that combining technical analysis (price action, momentum, trends) with fundamental analysis (valuations, earnings, shareholding) gives a more complete picture than either approach alone. Our composite scoring — Technical 45% + Fundamental 55% — reflects a balanced, slightly value-oriented investment philosophy.
            </p>
          </div>

          <div className="section" style={{ animation:'fadeUp 0.5s ease 0.3s both', padding:'20px 24px', background:'#ffffff', border:'1px solid rgba(0,0,0,0.06)', borderRadius:12 }}>
            <h3 style={{ marginBottom:6 }}>Disclaimer</h3>
            <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.7, margin:0 }}>
              Equity Analysis Terminal is for informational and educational purposes only. It does not constitute financial or investment advice. AI-generated analysis may contain inaccuracies. Stock market investments are subject to market risks. Always do your own research and consult a SEBI-registered financial advisor before making any investment decisions.
            </p>
          </div>

          <div className="back-link" onClick={function() { router.push('/'); }}>
            ← Go Back
          </div>
        </div>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-inner">
            <div>
              <p style={{ fontSize:12, color:'var(--text-muted)' }}>© 2025 Equity Analysis Terminal · Made with <span style={{ color:'#dc2626' }}>❤</span> in India</p>
            </div>
            <div className="footer-links">
              <span className="footer-link" onClick={function() { router.push('/'); }}>Home</span>
              <span className="footer-link" onClick={function() { router.push('/stocks'); }}>Stocks</span>
              <a href="https://www.nseindia.com" target="_blank" rel="noopener noreferrer" className="footer-link">NSE India ↗</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
