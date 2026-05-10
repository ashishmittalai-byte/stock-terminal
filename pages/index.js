import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";

// ── Indicator computation helpers ──────────────────────────────────
function computeRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  gains /= period; losses /= period;
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function computeEMA(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [ema];
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function computeMACD(prices) {
  const ema12 = computeEMA(prices, 12);
  const ema26 = computeEMA(prices, 26);
  if (!ema12.length || !ema26.length) return { macd: null, signal: null, histogram: null };
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
  const signalLine = computeEMA(macdLine, 9);
  const macdVal = macdLine[macdLine.length - 1];
  const sigVal = signalLine.length > 0 ? signalLine[signalLine.length - 1] : null;
  return { macd: macdVal, signal: sigVal, histogram: sigVal != null ? macdVal - sigVal : null };
}

function computeBollingerBands(prices, period = 20) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period);
  return { upper: sma + 2 * std, middle: sma, lower: sma - 2 * std, width: (4 * std) / sma * 100 };
}

function computeATR(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return null;
  let atr = 0;
  for (let i = 1; i <= period; i++) {
    atr += Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  return atr / period;
}

function computeStochastic(highs, lows, closes, period = 14) {
  if (closes.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function getSignalColor(s) {
  if (["Bullish", "Buy", "Strong Buy", "Oversold"].includes(s)) return "#00e676";
  if (["Bearish", "Sell", "Strong Sell", "Overbought"].includes(s)) return "#ff1744";
  return "#ffc400";
}
function getSignalEmoji(s) {
  if (["Bullish", "Buy", "Strong Buy"].includes(s)) return "▲";
  if (["Bearish", "Sell", "Strong Sell"].includes(s)) return "▼";
  return "●";
}

// ── Sparkline ───────────────────────────────────────────────────
function Sparkline({ data, width = 260, height = 60, color = "#00e676" }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return <svg width={width} height={height} style={{ display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

// ── Gauge ───────────────────────────────────────────────────────
function Gauge({ value, max = 100, label, color }) {
  const pct = Math.min(Math.max(value / max, 0), 1);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="80" height="50" viewBox="0 0 80 50">
        <path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" />
        <path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${pct * 100} 200`} />
        <text x="40" y="40" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="monospace">{typeof value === "number" ? value.toFixed(1) : value}</text>
      </svg>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: -4 }}>{label}</div>
    </div>
  );
}

// ── ScoreBar ────────────────────────────────────────────────────
function ScoreBar({ score, label }) {
  const c = Math.min(Math.max(score, -100), 100);
  const col = c > 30 ? "#00e676" : c < -30 ? "#ff1744" : "#ffc400";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: "rgba(255,255,255,0.6)" }}>{label}</span>
        <span style={{ color: col, fontWeight: 700, fontFamily: "monospace" }}>{c > 0 ? "+" : ""}{c.toFixed(0)}</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: 4, background: "rgba(255,255,255,0.15)" }} />
        <div style={{
          position: "absolute", left: c >= 0 ? "50%" : `${(c + 100) / 2}%`,
          width: `${Math.abs(c) / 2}%`, height: 4, borderRadius: 2, background: col, transition: "all 0.6s"
        }} />
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);

  const msgs = ["Scanning market data...", "Pulling live quotes...", "Computing technicals...", "Analysing fundamentals...", "Running oscillators...", "Evaluating volume...", "Synthesising verdict..."];
  useEffect(() => {
    if (!loading) return;
    let i = 0; setLoadingMsg(msgs[0]);
    const iv = setInterval(() => { i = (i + 1) % msgs.length; setLoadingMsg(msgs[i]); }, 2200);
    return () => clearInterval(iv);
  }, [loading]);

  const analyse = useCallback(async (name) => {
    if (!name.trim()) return;
    setLoading(true); setError(null); setResult(null);
    const t = name.trim();
    setRecentSearches(p => [t, ...p.filter(s => s.toLowerCase() !== t.toLowerCase())].slice(0, 8));

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockQuery: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      const parsed = data;
      const prices = parsed.historicalPrices || [];
      const highs = parsed.historicalHighs || prices.map(p => p * 1.01);
      const lows = parsed.historicalLows || prices.map(p => p * 0.99);
      const volumes = parsed.historicalVolumes || [];

      const rsi = computeRSI(prices);
      const macd = computeMACD(prices);
      const bb = computeBollingerBands(prices);
      const atr = computeATR(highs, lows, prices);
      const stoch = computeStochastic(highs, lows, prices);
      const cp = parsed.currentPrice;
      const sma20 = parsed.sma20 || (prices.length >= 20 ? prices.slice(-20).reduce((a, b) => a + b, 0) / 20 : null);
      const sma50 = parsed.sma50 || (prices.length >= 50 ? prices.slice(-50).reduce((a, b) => a + b, 0) / 50 : null);
      const sma200 = parsed.sma200 || null;
      const recentVol = volumes.length >= 5 ? volumes.slice(-5).reduce((a, b) => a + b, 0) / 5 : null;
      const avgVol = parsed.avgVolume || (volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null);
      const volumeRatio = recentVol && avgVol ? recentVol / avgVol : null;

      const indicators = [];
      if (rsi != null) {
        let sig = "Neutral";
        if (rsi < 30) sig = "Oversold"; else if (rsi < 40) sig = "Bullish"; else if (rsi > 70) sig = "Overbought"; else if (rsi > 60) sig = "Bearish";
        indicators.push({ name: "RSI (14)", value: rsi.toFixed(2), signal: sig, detail: rsi < 30 ? "Potential reversal zone" : rsi > 70 ? "Potential correction zone" : "Within normal range" });
      }
      if (macd.macd != null && macd.signal != null) {
        const sig = macd.histogram > 0 ? "Bullish" : macd.histogram < 0 ? "Bearish" : "Neutral";
        indicators.push({ name: "MACD", value: macd.macd.toFixed(2), signal: sig, detail: `Signal: ${macd.signal.toFixed(2)} | Hist: ${macd.histogram.toFixed(2)}` });
      }
      if (bb && cp) {
        const pos = ((cp - bb.lower) / (bb.upper - bb.lower) * 100);
        let sig = "Neutral";
        if (cp < bb.lower) sig = "Oversold"; else if (cp > bb.upper) sig = "Overbought"; else if (pos < 30) sig = "Bullish"; else if (pos > 70) sig = "Bearish";
        indicators.push({ name: "Bollinger Bands", value: `${pos.toFixed(0)}%`, signal: sig, detail: `U: ₹${bb.upper.toFixed(0)} | M: ₹${bb.middle.toFixed(0)} | L: ₹${bb.lower.toFixed(0)}` });
      }
      if (stoch != null) {
        let sig = "Neutral";
        if (stoch < 20) sig = "Oversold"; else if (stoch > 80) sig = "Overbought"; else if (stoch < 40) sig = "Bullish"; else if (stoch > 60) sig = "Bearish";
        indicators.push({ name: "Stochastic %K", value: stoch.toFixed(2), signal: sig, detail: stoch < 20 ? "Deep oversold" : stoch > 80 ? "Deep overbought" : "Mid-range" });
      }
      if (atr != null && cp) {
        const pct = (atr / cp) * 100;
        indicators.push({ name: "ATR (14)", value: `₹${atr.toFixed(2)}`, signal: pct > 3 ? "High Volatility" : pct < 1.5 ? "Low Volatility" : "Neutral", detail: `${pct.toFixed(2)}% of price` });
      }
      if (sma20 && cp) indicators.push({ name: "SMA 20", value: `₹${sma20.toFixed(2)}`, signal: cp > sma20 ? "Bullish" : "Bearish", detail: `Price ${cp > sma20 ? "above" : "below"} by ${((cp / sma20 - 1) * 100).toFixed(1)}%` });
      if (sma50 && cp) indicators.push({ name: "SMA 50", value: `₹${sma50.toFixed(2)}`, signal: cp > sma50 ? "Bullish" : "Bearish", detail: `Price ${cp > sma50 ? "above" : "below"} by ${((cp / sma50 - 1) * 100).toFixed(1)}%` });
      if (sma200 && cp) indicators.push({ name: "SMA 200", value: `₹${sma200.toFixed(2)}`, signal: cp > sma200 ? "Bullish" : "Bearish", detail: `Price ${cp > sma200 ? "above" : "below"} by ${((cp / sma200 - 1) * 100).toFixed(1)}%` });
      if (volumeRatio) indicators.push({ name: "Volume Ratio", value: `${volumeRatio.toFixed(2)}x`, signal: volumeRatio > 1.5 ? "Bullish" : volumeRatio < 0.7 ? "Bearish" : "Neutral", detail: volumeRatio > 1.5 ? "Above-avg participation" : volumeRatio < 0.7 ? "Low participation" : "Normal" });
      if (parsed.fiftyTwoWeekHigh && parsed.fiftyTwoWeekLow && cp) {
        const pos = ((cp - parsed.fiftyTwoWeekLow) / (parsed.fiftyTwoWeekHigh - parsed.fiftyTwoWeekLow)) * 100;
        indicators.push({ name: "52W Range", value: `${pos.toFixed(0)}%`, signal: pos > 80 ? "Overbought" : pos < 20 ? "Oversold" : pos > 50 ? "Bullish" : "Bearish", detail: `L: ₹${parsed.fiftyTwoWeekLow.toFixed(0)} → H: ₹${parsed.fiftyTwoWeekHigh.toFixed(0)}` });
      }

      // Scores
      let ts = 0, tc = 0;
      indicators.forEach(ind => { tc++; if (["Bullish", "Buy", "Strong Buy", "Oversold"].includes(ind.signal)) ts += 1; else if (["Bearish", "Sell", "Strong Sell", "Overbought"].includes(ind.signal)) ts -= 1; });
      const techPct = tc > 0 ? (ts / tc) * 100 : 0;

      let fs = 0, fc = 0;
      if (parsed.pe != null) { fs += parsed.pe < 15 ? 1 : parsed.pe < 25 ? 0.3 : parsed.pe > 40 ? -1 : -0.3; fc++; }
      if (parsed.roe != null) { fs += parsed.roe > 20 ? 1 : parsed.roe > 12 ? 0.5 : -0.5; fc++; }
      if (parsed.debtToEquity != null) { fs += parsed.debtToEquity < 0.5 ? 1 : parsed.debtToEquity < 1 ? 0.3 : -0.8; fc++; }
      if (parsed.profitGrowthYoY != null) { fs += parsed.profitGrowthYoY > 20 ? 1 : parsed.profitGrowthYoY > 0 ? 0.3 : -0.8; fc++; }
      if (parsed.revenueGrowthYoY != null) { fs += parsed.revenueGrowthYoY > 15 ? 1 : parsed.revenueGrowthYoY > 5 ? 0.3 : -0.5; fc++; }
      if (parsed.operatingMargin != null) { fs += parsed.operatingMargin > 20 ? 1 : parsed.operatingMargin > 10 ? 0.3 : -0.5; fc++; }
      if (parsed.promoterHolding != null) { fs += parsed.promoterHolding > 60 ? 1 : parsed.promoterHolding > 40 ? 0.3 : -0.3; fc++; }
      const fundPct = fc > 0 ? (fs / fc) * 100 : 0;
      const comp = techPct * 0.45 + fundPct * 0.55;

      let verdict, verdictColor;
      if (comp > 40) { verdict = "STRONG BUY"; verdictColor = "#00e676"; }
      else if (comp > 15) { verdict = "BUY"; verdictColor = "#69f0ae"; }
      else if (comp > -15) { verdict = "HOLD"; verdictColor = "#ffc400"; }
      else if (comp > -40) { verdict = "SELL"; verdictColor = "#ff6e40"; }
      else { verdict = "STRONG SELL"; verdictColor = "#ff1744"; }

      setResult({ ...parsed, indicators, techScore: techPct, fundScore: fundPct, compositeScore: comp, verdict, verdictColor });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => { e.preventDefault(); analyse(query); };
  const fmt = (v, d = 2) => v != null ? Number(v).toFixed(d) : "—";
  const fmtPct = (v) => v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "—";

  const cardStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 24px" };
  const labelStyle = { fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12, fontFamily: "monospace", letterSpacing: "0.05em" };
  const rowStyle = { display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" };
  const rkStyle = { fontSize: 12, color: "rgba(255,255,255,0.45)" };
  const rvStyle = { fontSize: 12, color: "#fff", fontFamily: "monospace", fontWeight: 600 };

  return (
    <>
      <Head>
        <title>Equity Analysis Terminal — BSE · NSE</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI-powered comprehensive stock analysis for all BSE and NSE listed equities. Technical indicators, fundamental metrics, shareholding, and verdicts." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0a0e17; color: #e0e6f0; font-family: 'DM Sans', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        ::selection { background: #00e67640; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease-out both; }
      `}</style>

      <div style={{ minHeight: "100vh" }}>
        {/* ── Header ──────────────────────────── */}
        <div style={{ background: "linear-gradient(135deg, #0d1321, #111827, #0f1729)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "24px 32px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #00e676, #00bfa5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#0a0e17" }}>₹</div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>Equity Analysis Terminal</h1>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>BSE · NSE · LIVE DATA · AI-POWERED</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Enter stock name or ticker — e.g. Reliance, TCS, INFY, HDFCBANK..."
                style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 14, outline: "none", fontFamily: "'JetBrains Mono', monospace", transition: "border-color 0.2s" }}
                onFocus={e => e.target.style.borderColor = "#00e676"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
              <button type="submit" disabled={loading || !query.trim()}
                style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: loading ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #00e676, #00bfa5)", color: loading ? "rgba(255,255,255,0.4)" : "#0a0e17", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                {loading ? "Analysing..." : "Analyse →"}
              </button>
            </form>
            {recentSearches.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {recentSearches.map((s, i) => (
                  <button key={i} onClick={() => { setQuery(s); analyse(s); }}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>{s}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Loading ─────────────────────────── */}
        {loading && (
          <div style={{ maxWidth: 1200, margin: "60px auto", textAlign: "center", padding: "0 32px" }}>
            <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.06)", borderTopColor: "#00e676", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
            <p style={{ color: "#00e676", fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}>{loadingMsg}</p>
          </div>
        )}

        {/* ── Error ──────────────────────────── */}
        {error && (
          <div style={{ maxWidth: 1200, margin: "40px auto", padding: "0 32px" }}>
            <div style={{ background: "rgba(255,23,68,0.08)", border: "1px solid rgba(255,23,68,0.2)", borderRadius: 12, padding: "20px 24px" }}>
              <p style={{ color: "#ff1744", fontSize: 14 }}>⚠ {error}</p>
            </div>
          </div>
        )}

        {/* ── Results ────────────────────────── */}
        {result && (
          <div className="fade-in" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>

            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>{result.stockName || result.ticker}</h2>
                <p style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>{result.ticker} · {result.exchange} · {result.sector} · {result.industry}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>₹{fmt(result.currentPrice)}</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: result.dayChange >= 0 ? "#00e676" : "#ff1744" }}>{fmtPct(result.dayChange)} today</div>
              </div>
            </div>

            {/* Verdict */}
            <div style={{ background: `linear-gradient(135deg, ${result.verdictColor}15, ${result.verdictColor}08)`, border: `1px solid ${result.verdictColor}30`, borderRadius: 14, padding: "20px 28px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>AI COMPOSITE VERDICT</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: result.verdictColor }}>{result.verdict}</div>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                <Gauge value={result.techScore} label="Technical" color={result.techScore > 20 ? "#00e676" : result.techScore < -20 ? "#ff1744" : "#ffc400"} />
                <Gauge value={result.fundScore} label="Fundamental" color={result.fundScore > 20 ? "#00e676" : result.fundScore < -20 ? "#ff1744" : "#ffc400"} />
                <Gauge value={result.compositeScore} label="Composite" color={result.verdictColor} />
              </div>
            </div>

            {/* Score bars */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <ScoreBar score={result.techScore} label="Technical Score" />
              <ScoreBar score={result.fundScore} label="Fundamental Score" />
              <ScoreBar score={result.compositeScore} label="Composite Score" />
            </div>

            {/* Sparkline + Market data */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
              <div style={cardStyle}>
                <div style={labelStyle}>PRICE TREND (30D)</div>
                <Sparkline data={result.historicalPrices} color={result.dayChange >= 0 ? "#00e676" : "#ff1744"} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                  <span>O: ₹{fmt(result.open)}</span><span>H: ₹{fmt(result.dayHigh)}</span><span>L: ₹{fmt(result.dayLow)}</span><span>PC: ₹{fmt(result.prevClose)}</span>
                </div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>MARKET DATA</div>
                {[["Market Cap", result.marketCapLabel || `₹${fmt(result.marketCap, 0)} Cr`], ["Volume", result.volume ? Number(result.volume).toLocaleString("en-IN") : "—"], ["52W High", `₹${fmt(result.fiftyTwoWeekHigh)}`], ["52W Low", `₹${fmt(result.fiftyTwoWeekLow)}`], ["Beta", fmt(result.beta)], ["Face Value", `₹${fmt(result.faceValue)}`]].map(([k, v], i) => (
                  <div key={i} style={rowStyle}><span style={rkStyle}>{k}</span><span style={rvStyle}>{v}</span></div>
                ))}
              </div>
            </div>

            {/* Technical Indicators */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <div style={labelStyle}>TECHNICAL INDICATORS ({result.indicators.length})</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {result.indicators.map((ind, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${getSignalColor(ind.signal)}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{ind.name}</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${getSignalColor(ind.signal)}18`, color: getSignalColor(ind.signal), fontWeight: 700, fontFamily: "monospace" }}>{getSignalEmoji(ind.signal)} {ind.signal}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>{ind.value}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{ind.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fundamentals */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
              <div style={cardStyle}>
                <div style={labelStyle}>VALUATION</div>
                {[["P/E", fmt(result.pe), result.pe != null ? (result.pe < 15 ? "#00e676" : result.pe > 40 ? "#ff1744" : "#ffc400") : null], ["P/B", fmt(result.pb)], ["EPS", `₹${fmt(result.eps)}`], ["PEG", fmt(result.peg)], ["Book Value", `₹${fmt(result.bookValue)}`], ["Div Yield", fmtPct(result.dividendYield)], ["Intrinsic Val", result.intrinsicValueEstimate ? `₹${fmt(result.intrinsicValueEstimate)}` : "—"], ["Target", result.analystTargetPrice ? `₹${fmt(result.analystTargetPrice)}` : "—"]].map(([k, v, c], i) => (
                  <div key={i} style={rowStyle}><span style={rkStyle}>{k}</span><span style={{ ...rvStyle, color: c || "#fff" }}>{v}</span></div>
                ))}
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>PROFITABILITY & GROWTH</div>
                {[["ROE", fmtPct(result.roe), result.roe != null ? (result.roe > 20 ? "#00e676" : result.roe < 10 ? "#ff1744" : "#ffc400") : null], ["ROCE", fmtPct(result.roce)], ["Debt/Equity", fmt(result.debtToEquity), result.debtToEquity != null ? (result.debtToEquity < 0.5 ? "#00e676" : result.debtToEquity > 1 ? "#ff1744" : "#ffc400") : null], ["Op Margin", fmtPct(result.operatingMargin)], ["Net Margin", fmtPct(result.netMargin)], ["Rev Growth", fmtPct(result.revenueGrowthYoY)], ["Profit Growth", fmtPct(result.profitGrowthYoY)], ["FCF Yield", fmtPct(result.freeCashFlowYield)]].map(([k, v, c], i) => (
                  <div key={i} style={rowStyle}><span style={rkStyle}>{k}</span><span style={{ ...rvStyle, color: c || "#fff" }}>{v}</span></div>
                ))}
              </div>
            </div>

            {/* Shareholding */}
            {(result.promoterHolding != null || result.fiiHolding != null) && (
              <div style={{ ...cardStyle, marginBottom: 24 }}>
                <div style={labelStyle}>SHAREHOLDING PATTERN</div>
                <div style={{ display: "flex", gap: 0, height: 24, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                  {[{ l: "Promoter", v: result.promoterHolding, c: "#00e676" }, { l: "FII", v: result.fiiHolding, c: "#448aff" }, { l: "DII", v: result.diiHolding, c: "#ffc400" }, { l: "Public", v: result.publicHolding, c: "#ff6e40" }].filter(x => x.v != null).map((x, i) => (
                    <div key={i} style={{ width: `${x.v}%`, background: x.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#0a0e17", fontFamily: "monospace" }}>{x.v > 8 ? `${x.v.toFixed(1)}%` : ""}</div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {[{ l: "Promoter", v: result.promoterHolding, c: "#00e676" }, { l: "FII", v: result.fiiHolding, c: "#448aff" }, { l: "DII", v: result.diiHolding, c: "#ffc400" }, { l: "Public", v: result.publicHolding, c: "#ff6e40" }].filter(x => x.v != null).map((x, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} /><span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{x.l}: {x.v.toFixed(1)}%</span></div>
                  ))}
                </div>
              </div>
            )}

            {/* Smart Money + News */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
              {result.smartMoneySignals && (
                <div style={{ ...cardStyle, background: "rgba(68,138,255,0.04)", borderColor: "rgba(68,138,255,0.15)" }}>
                  <div style={{ ...labelStyle, color: "#448aff" }}>SMART MONEY SIGNALS</div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{result.smartMoneySignals}</p>
                </div>
              )}
              {result.recentNews?.length > 0 && (
                <div style={cardStyle}>
                  <div style={labelStyle}>RECENT NEWS</div>
                  {result.recentNews.map((n, i) => (
                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}><span style={{ color: "#00e676", marginRight: 6 }}>›</span>{n}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Risks & Catalysts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {result.keyRisks?.length > 0 && (
                <div style={{ ...cardStyle, background: "rgba(255,23,68,0.04)", borderColor: "rgba(255,23,68,0.12)" }}>
                  <div style={{ ...labelStyle, color: "#ff1744" }}>KEY RISKS</div>
                  {result.keyRisks.map((r, i) => <div key={i} style={{ padding: "5px 0", fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}><span style={{ color: "#ff1744", marginRight: 6 }}>✕</span>{r}</div>)}
                </div>
              )}
              {result.keyCatalysts?.length > 0 && (
                <div style={{ ...cardStyle, background: "rgba(0,230,118,0.04)", borderColor: "rgba(0,230,118,0.12)" }}>
                  <div style={{ ...labelStyle, color: "#00e676" }}>KEY CATALYSTS</div>
                  {result.keyCatalysts.map((c, i) => <div key={i} style={{ padding: "5px 0", fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}><span style={{ color: "#00e676", marginRight: 6 }}>✦</span>{c}</div>)}
                </div>
              )}
            </div>

            {/* Analyst Consensus */}
            {result.analystConsensus && (
              <div style={{ ...cardStyle, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>ANALYST CONSENSUS </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: getSignalColor(["Strong Buy", "Buy"].includes(result.analystConsensus) ? "Bullish" : ["Sell", "Strong Sell"].includes(result.analystConsensus) ? "Bearish" : "Neutral") }}>{result.analystConsensus}</span>
                </div>
                {result.analystTargetPrice && result.currentPrice && (
                  <div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>TARGET </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>₹{fmt(result.analystTargetPrice)}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: result.analystTargetPrice > result.currentPrice ? "#00e676" : "#ff1744" }}>({((result.analystTargetPrice / result.currentPrice - 1) * 100).toFixed(1)}%)</span>
                  </div>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <div style={{ background: "rgba(255,196,0,0.04)", border: "1px solid rgba(255,196,0,0.1)", borderRadius: 10, padding: "12px 16px", marginBottom: 32 }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>⚠ <strong>Disclaimer:</strong> This analysis is AI-generated using publicly available data for informational purposes only. It does NOT constitute financial or investment advice. Always consult a SEBI-registered financial advisor before making investment decisions.</p>
            </div>
          </div>
        )}

        {/* ── Empty state ────────────────────── */}
        {!loading && !result && !error && (
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.15 }}>📊</div>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, maxWidth: 420, margin: "0 auto", lineHeight: 1.7 }}>Enter any BSE or NSE listed stock name or ticker to get comprehensive analysis with technical indicators, fundamentals, shareholding, and an AI-powered verdict.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
              {["Reliance", "TCS", "HDFC Bank", "Infosys", "ITC", "Bajaj Finance", "SBI", "Tata Motors"].map(s => (
                <button key={s} onClick={() => { setQuery(s); analyse(s); }}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.target.style.borderColor = "#00e676"; e.target.style.color = "#00e676"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.color = "rgba(255,255,255,0.5)"; }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
