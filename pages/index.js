import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

// ════════════════════════════════════════════════════════
// SECTION 1: TECHNICAL INDICATOR COMPUTATIONS
// ════════════════════════════════════════════════════════

function sma(arr, p) { if (arr.length < p) return null; return arr.slice(-p).reduce((a, b) => a + b, 0) / p; }
function emaCalc(arr, p) {
  if (arr.length < p) return []; const k = 2 / (p + 1);
  let e = arr.slice(0, p).reduce((a, b) => a + b, 0) / p; const r = [e];
  for (let i = p; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); r.push(e); } return r;
}
function lastEma(arr, p) { const e = emaCalc(arr, p); return e.length ? e[e.length - 1] : null; }

function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) { const d = prices[i] - prices[i - 1]; d > 0 ? g += d : l -= d; }
  g /= period; l /= period; if (l === 0) return 100; return 100 - 100 / (1 + g / l);
}
function calcMACD(prices) {
  const e12 = emaCalc(prices, 12), e26 = emaCalc(prices, 26);
  if (!e12.length || !e26.length) return { macd: null, signal: null, histogram: null };
  const off = e12.length - e26.length;
  const ml = e26.map((v, i) => e12[i + off] - v);
  const sl = emaCalc(ml, 9);
  const m = ml[ml.length - 1], s = sl.length ? sl[sl.length - 1] : null;
  return { macd: m, signal: s, histogram: s != null ? m - s : null };
}
function calcBB(prices, p = 20) {
  if (prices.length < p) return null;
  const sl = prices.slice(-p), m = sl.reduce((a, b) => a + b, 0) / p;
  const std = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / p);
  return { upper: m + 2 * std, middle: m, lower: m - 2 * std, width: (4 * std) / m * 100 };
}
function calcATR(h, l, c, p = 14) {
  if (c.length < p + 1) return null; let atr = 0;
  for (let i = 1; i <= p; i++) atr += Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
  return atr / p;
}
function calcStoch(h, l, c, p = 14) {
  if (c.length < p) return null;
  const hh = Math.max(...h.slice(-p)), ll = Math.min(...l.slice(-p));
  return hh === ll ? 50 : ((c[c.length - 1] - ll) / (hh - ll)) * 100;
}
function calcWilliamsR(h, l, c, p = 14) {
  if (c.length < p) return null;
  const hh = Math.max(...h.slice(-p)), ll = Math.min(...l.slice(-p));
  return hh === ll ? -50 : ((hh - c[c.length - 1]) / (hh - ll)) * -100;
}
function calcCCI(h, l, c, p = 20) {
  if (c.length < p) return null;
  const tp = c.slice(-p).map((v, i) => (h[h.length - p + i] + l[l.length - p + i] + v) / 3);
  const mean = tp.reduce((a, b) => a + b, 0) / p;
  const md = tp.reduce((a, b) => a + Math.abs(b - mean), 0) / p;
  return md === 0 ? 0 : (tp[tp.length - 1] - mean) / (0.015 * md);
}
function calcOBV(c, v) {
  if (c.length < 2) return null;
  let obv = 0;
  for (let i = 1; i < c.length; i++) obv += c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0;
  return obv;
}
function calcMFI(h, l, c, v, p = 14) {
  if (c.length < p + 1) return null;
  let posF = 0, negF = 0;
  for (let i = c.length - p; i < c.length; i++) {
    const tp = (h[i] + l[i] + c[i]) / 3, prevTp = (h[i - 1] + l[i - 1] + c[i - 1]) / 3;
    const mf = tp * v[i]; tp > prevTp ? posF += mf : negF += mf;
  }
  return negF === 0 ? 100 : 100 - 100 / (1 + posF / negF);
}
function calcADX(h, l, c, p = 14) {
  if (c.length < p * 2) return null;
  let pDM = 0, nDM = 0, tr = 0;
  for (let i = 1; i <= p; i++) {
    const up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
    pDM += up > dn && up > 0 ? up : 0; nDM += dn > up && dn > 0 ? dn : 0;
    tr += Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
  }
  const pDI = (pDM / tr) * 100, nDI = (nDM / tr) * 100;
  const dx = Math.abs(pDI - nDI) / (pDI + nDI) * 100;
  return { adx: dx, plusDI: pDI, minusDI: nDI };
}
function calcSuperTrend(h, l, c, p = 10, m = 3) {
  const atr = calcATR(h, l, c, p); if (!atr) return null;
  const last = c[c.length - 1];
  const basicUpper = (h[h.length - 1] + l[l.length - 1]) / 2 + m * atr;
  const basicLower = (h[h.length - 1] + l[l.length - 1]) / 2 - m * atr;
  return { trend: last > basicUpper ? "Bearish" : "Bullish", upper: basicUpper, lower: basicLower };
}
function calcParabolicSAR(h, l, c) {
  if (c.length < 5) return null;
  let af = 0.02, ep, sar, bull = true;
  sar = l[0]; ep = h[0];
  for (let i = 1; i < c.length; i++) {
    sar = sar + af * (ep - sar);
    if (bull) { if (h[i] > ep) { ep = h[i]; af = Math.min(af + 0.02, 0.2); } if (l[i] < sar) { bull = false; sar = ep; ep = l[i]; af = 0.02; } }
    else { if (l[i] < ep) { ep = l[i]; af = Math.min(af + 0.02, 0.2); } if (h[i] > sar) { bull = true; sar = ep; ep = h[i]; af = 0.02; } }
  }
  return { sar, trend: bull ? "Bullish" : "Bearish" };
}
function calcVWAP(h, l, c, v) {
  if (c.length < 5) return null;
  let cumTPV = 0, cumV = 0;
  for (let i = 0; i < c.length; i++) { cumTPV += ((h[i] + l[i] + c[i]) / 3) * v[i]; cumV += v[i]; }
  return cumV === 0 ? null : cumTPV / cumV;
}
function calcFibonacci(high, low) {
  const diff = high - low;
  return { level0: high, level236: high - 0.236 * diff, level382: high - 0.382 * diff, level500: high - 0.5 * diff, level618: high - 0.618 * diff, level786: high - 0.786 * diff, level100: low };
}
function calcPivotPoints(h, l, c) {
  const pp = (h + l + c) / 3;
  return { pp, r1: 2 * pp - l, r2: pp + (h - l), r3: h + 2 * (pp - l), s1: 2 * pp - h, s2: pp - (h - l), s3: l - 2 * (h - pp) };
}
function calcCamarilla(h, l, c) {
  const r = h - l;
  return { r4: c + r * 1.1 / 2, r3: c + r * 1.1 / 4, r2: c + r * 1.1 / 6, r1: c + r * 1.1 / 12, s1: c - r * 1.1 / 12, s2: c - r * 1.1 / 6, s3: c - r * 1.1 / 4, s4: c - r * 1.1 / 2 };
}

// ════════════════════════════════════════════════════════
// SECTION 2: CANDLESTICK PATTERN DETECTION
// ════════════════════════════════════════════════════════
function detectCandlesticks(o, h, l, c) {
  const n = c.length; if (n < 3) return [];
  const patterns = []; const i = n - 1;
  const body = Math.abs(c[i] - o[i]), range = h[i] - l[i], upperW = h[i] - Math.max(o[i], c[i]), lowerW = Math.min(o[i], c[i]) - l[i];
  const prevBody = n > 1 ? Math.abs(c[i - 1] - o[i - 1]) : 0, prevRange = n > 1 ? h[i - 1] - l[i - 1] : 1;
  const bull = c[i] > o[i], prevBull = n > 1 ? c[i - 1] > o[i - 1] : false;
  const avgRange = c.slice(-10).reduce((a, _, j) => a + (h[n - 10 + j] - l[n - 10 + j]), 0) / Math.min(10, n);

  // Doji
  if (body < range * 0.1 && range > 0) patterns.push({ name: "Doji", signal: "Neutral", detail: "Indecision — trend reversal possible" });
  // Hammer
  if (lowerW > body * 2 && upperW < body * 0.5 && !prevBull && body > 0) patterns.push({ name: "Hammer", signal: "Bullish", detail: "Potential bottom reversal" });
  // Inverted Hammer
  if (upperW > body * 2 && lowerW < body * 0.5 && !prevBull && body > 0) patterns.push({ name: "Inverted Hammer", signal: "Bullish", detail: "Possible bullish reversal" });
  // Shooting Star
  if (upperW > body * 2 && lowerW < body * 0.5 && prevBull && body > 0) patterns.push({ name: "Shooting Star", signal: "Bearish", detail: "Potential top reversal" });
  // Hanging Man
  if (lowerW > body * 2 && upperW < body * 0.5 && prevBull && body > 0) patterns.push({ name: "Hanging Man", signal: "Bearish", detail: "Possible bearish reversal" });
  // Bullish Engulfing
  if (n > 1 && bull && !prevBull && o[i] <= c[i - 1] && c[i] >= o[i - 1] && body > prevBody) patterns.push({ name: "Bullish Engulfing", signal: "Bullish", detail: "Strong reversal — buyers dominating" });
  // Bearish Engulfing
  if (n > 1 && !bull && prevBull && o[i] >= c[i - 1] && c[i] <= o[i - 1] && body > prevBody) patterns.push({ name: "Bearish Engulfing", signal: "Bearish", detail: "Strong reversal — sellers dominating" });
  // Marubozu
  if (body > range * 0.9 && range > avgRange * 0.8) patterns.push({ name: bull ? "Bullish Marubozu" : "Bearish Marubozu", signal: bull ? "Bullish" : "Bearish", detail: bull ? "Strong buying pressure" : "Strong selling pressure" });
  // Spinning Top
  if (body < range * 0.3 && upperW > body && lowerW > body && body > 0) patterns.push({ name: "Spinning Top", signal: "Neutral", detail: "Indecision between bulls and bears" });
  // Morning Star (3-candle)
  if (n > 2 && !prevBull && c[i - 2] > o[i - 2] === false && Math.abs(c[i - 1] - o[i - 1]) < prevRange * 0.3 && bull && c[i] > (o[i - 2] + c[i - 2]) / 2)
    patterns.push({ name: "Morning Star", signal: "Bullish", detail: "Three-candle bottom reversal" });
  // Evening Star (3-candle)
  if (n > 2 && c[i - 2] > o[i - 2] && Math.abs(c[i - 1] - o[i - 1]) < prevRange * 0.3 && !bull && c[i] < (o[i - 2] + c[i - 2]) / 2)
    patterns.push({ name: "Evening Star", signal: "Bearish", detail: "Three-candle top reversal" });
  // Three White Soldiers
  if (n > 2 && c[i] > o[i] && c[i - 1] > o[i - 1] && c[i - 2] > o[i - 2] && c[i] > c[i - 1] && c[i - 1] > c[i - 2])
    patterns.push({ name: "Three White Soldiers", signal: "Bullish", detail: "Strong bullish continuation" });
  // Three Black Crows
  if (n > 2 && c[i] < o[i] && c[i - 1] < o[i - 1] && c[i - 2] < o[i - 2] && c[i] < c[i - 1] && c[i - 1] < c[i - 2])
    patterns.push({ name: "Three Black Crows", signal: "Bearish", detail: "Strong bearish continuation" });
  // Harami
  if (n > 1 && !prevBull && bull && o[i] > c[i - 1] && c[i] < o[i - 1] && body < prevBody * 0.5)
    patterns.push({ name: "Bullish Harami", signal: "Bullish", detail: "Possible trend reversal" });
  if (n > 1 && prevBull && !bull && o[i] < c[i - 1] && c[i] > o[i - 1] && body < prevBody * 0.5)
    patterns.push({ name: "Bearish Harami", signal: "Bearish", detail: "Possible trend reversal" });
  return patterns;
}

// ════════════════════════════════════════════════════════
// SECTION 3: CHART PATTERN DETECTION (Simplified)
// ════════════════════════════════════════════════════════
function detectChartPatterns(prices, h, l) {
  const n = prices.length; if (n < 20) return [];
  const patterns = [];
  // Double Top
  const maxIdx = prices.reduce((mi, v, i) => v > prices[mi] ? i : mi, 0);
  const half1 = prices.slice(0, maxIdx), half2 = prices.slice(maxIdx);
  if (half1.length > 3 && half2.length > 3) {
    const peak1 = Math.max(...half1), peak2 = Math.max(...half2);
    if (Math.abs(peak1 - peak2) / peak1 < 0.03 && prices[n - 1] < Math.min(peak1, peak2) * 0.97)
      patterns.push({ name: "Double Top", signal: "Bearish", detail: "Two peaks at similar levels — bearish reversal" });
  }
  // Double Bottom
  const minIdx = prices.reduce((mi, v, i) => v < prices[mi] ? i : mi, 0);
  const bh1 = prices.slice(0, minIdx), bh2 = prices.slice(minIdx);
  if (bh1.length > 3 && bh2.length > 3) {
    const tr1 = Math.min(...bh1), tr2 = Math.min(...bh2);
    if (Math.abs(tr1 - tr2) / tr1 < 0.03 && prices[n - 1] > Math.max(tr1, tr2) * 1.03)
      patterns.push({ name: "Double Bottom", signal: "Bullish", detail: "Two troughs at similar levels — bullish reversal" });
  }
  // Rising Wedge
  const recentH = h.slice(-15), recentL = l.slice(-15);
  if (recentH.length >= 10) {
    const hSlope = (recentH[recentH.length - 1] - recentH[0]) / recentH.length;
    const lSlope = (recentL[recentL.length - 1] - recentL[0]) / recentL.length;
    if (hSlope > 0 && lSlope > 0 && lSlope > hSlope) patterns.push({ name: "Rising Wedge", signal: "Bearish", detail: "Converging highs and lows with upward bias" });
    if (hSlope < 0 && lSlope < 0 && hSlope > lSlope) patterns.push({ name: "Falling Wedge", signal: "Bullish", detail: "Converging highs and lows with downward bias" });
  }
  // Flag
  const trend10 = prices[n - 1] - prices[Math.max(0, n - 11)];
  const last5Range = Math.max(...prices.slice(-5)) - Math.min(...prices.slice(-5));
  const prev10Range = Math.max(...prices.slice(-15, -5)) - Math.min(...prices.slice(-15, -5));
  if (prev10Range > 0 && last5Range < prev10Range * 0.4 && trend10 > 0)
    patterns.push({ name: "Bull Flag", signal: "Bullish", detail: "Consolidation after upward move" });
  if (prev10Range > 0 && last5Range < prev10Range * 0.4 && trend10 < 0)
    patterns.push({ name: "Bear Flag", signal: "Bearish", detail: "Consolidation after downward move" });
  // Ascending Triangle
  const recent = prices.slice(-15);
  const rMax = Math.max(...recent), rMin = Math.min(...recent);
  const topFlat = recent.filter(p => p > rMax * 0.98).length;
  const risingBottoms = recent[recent.length - 1] > recent[0] && recent[Math.floor(recent.length / 2)] > recent[0];
  if (topFlat >= 3 && risingBottoms) patterns.push({ name: "Ascending Triangle", signal: "Bullish", detail: "Flat resistance with rising support" });
  return patterns;
}

// ════════════════════════════════════════════════════════
// SECTION 4: SMART MONEY CONCEPTS
// ════════════════════════════════════════════════════════
function detectSMC(o, h, l, c) {
  const n = c.length; if (n < 10) return [];
  const signals = [];
  // Break of Structure
  const recentHighs = h.slice(-10), recentLows = l.slice(-10);
  const prevHH = Math.max(...recentHighs.slice(0, -2)), prevLL = Math.min(...recentLows.slice(0, -2));
  if (c[n - 1] > prevHH) signals.push({ name: "Break of Structure (BOS)", signal: "Bullish", detail: `Price broke above recent high ₹${prevHH.toFixed(0)} — bullish BOS` });
  if (c[n - 1] < prevLL) signals.push({ name: "Break of Structure (BOS)", signal: "Bearish", detail: `Price broke below recent low ₹${prevLL.toFixed(0)} — bearish BOS` });
  // Fair Value Gap
  if (n > 2) {
    const gap = l[n - 1] - h[n - 3];
    if (gap > 0) signals.push({ name: "Fair Value Gap (FVG)", signal: "Bullish", detail: `Unfilled gap of ₹${gap.toFixed(1)} — potential support zone` });
    const gapD = l[n - 3] - h[n - 1];
    if (gapD > 0) signals.push({ name: "Fair Value Gap (FVG)", signal: "Bearish", detail: `Unfilled gap of ₹${gapD.toFixed(1)} — potential resistance zone` });
  }
  // Order Block detection
  for (let i = n - 5; i < n - 1; i++) {
    if (i < 1) continue;
    if (c[i] < o[i] && c[i + 1] > o[i + 1] && c[i + 1] > h[i]) signals.push({ name: "Bullish Order Block", signal: "Bullish", detail: `Last bearish candle before impulse up at ₹${l[i].toFixed(0)}` });
    if (c[i] > o[i] && c[i + 1] < o[i + 1] && c[i + 1] < l[i]) signals.push({ name: "Bearish Order Block", signal: "Bearish", detail: `Last bullish candle before impulse down at ₹${h[i].toFixed(0)}` });
  }
  // Liquidity Sweep
  const prev5H = Math.max(...h.slice(-7, -2)), prev5L = Math.min(...l.slice(-7, -2));
  if (h[n - 1] > prev5H && c[n - 1] < prev5H) signals.push({ name: "Liquidity Sweep (High)", signal: "Bearish", detail: "Wick above recent highs then closed below — stop hunt" });
  if (l[n - 1] < prev5L && c[n - 1] > prev5L) signals.push({ name: "Liquidity Sweep (Low)", signal: "Bullish", detail: "Wick below recent lows then closed above — stop hunt" });
  return signals.slice(0, 5);
}

// ════════════════════════════════════════════════════════
// SECTION 5: STRATEGY SIGNALS
// ════════════════════════════════════════════════════════
function generateStrategies(data, indicators) {
  const strats = [];
  const { rsi, macdData, stoch, adx, superTrend, bb, cp } = data;
  // Momentum
  const momBull = (rsi > 50 && rsi < 70) && macdData?.histogram > 0;
  const momBear = (rsi < 50 && rsi > 30) && macdData?.histogram < 0;
  strats.push({ name: "Momentum", signal: momBull ? "Buy" : momBear ? "Sell" : "Neutral", detail: momBull ? "RSI & MACD aligned bullish" : momBear ? "RSI & MACD aligned bearish" : "No clear momentum signal" });
  // Trend Following
  const sma20 = data.sma20, sma50 = data.sma50;
  const trendBull = cp > sma20 && sma20 > sma50 && adx?.adx > 25;
  const trendBear = cp < sma20 && sma20 < sma50 && adx?.adx > 25;
  strats.push({ name: "Trend Following", signal: trendBull ? "Buy" : trendBear ? "Sell" : "Neutral", detail: trendBull ? "Price above rising MAs with strong trend" : trendBear ? "Price below falling MAs with strong trend" : "Weak or no trend" });
  // Mean Reversion
  if (bb && cp) {
    const mrBuy = cp < bb.lower; const mrSell = cp > bb.upper;
    strats.push({ name: "Mean Reversion", signal: mrBuy ? "Buy" : mrSell ? "Sell" : "Neutral", detail: mrBuy ? "Below lower BB — oversold snap-back likely" : mrSell ? "Above upper BB — overbought pullback likely" : "Within bands" });
  }
  // Breakout
  const vol = data.volumeRatio;
  const breakBull = cp > data.fiftyTwoWeekHigh * 0.97 && vol > 1.3;
  const breakBear = cp < data.fiftyTwoWeekLow * 1.03 && vol > 1.3;
  strats.push({ name: "Breakout", signal: breakBull ? "Buy" : breakBear ? "Sell" : "Neutral", detail: breakBull ? "Near 52W high with volume surge" : breakBear ? "Near 52W low with volume surge" : "No breakout setup" });
  // Swing Trading
  const swingBuy = rsi < 35 && stoch < 25 && superTrend?.trend === "Bullish";
  const swingSell = rsi > 65 && stoch > 75 && superTrend?.trend === "Bearish";
  strats.push({ name: "Swing Trading", signal: swingBuy ? "Buy" : swingSell ? "Sell" : "Neutral", detail: swingBuy ? "Oversold oscillators + bullish SuperTrend" : swingSell ? "Overbought oscillators + bearish SuperTrend" : "No swing setup" });
  return strats;
}

// ════════════════════════════════════════════════════════
// SECTION 6: FUNDAMENTAL SCORING (Enhanced)
// ════════════════════════════════════════════════════════
function calcPiotroski(d) {
  let score = 0;
  if (d.netMargin > 0) score++; if (d.roa > 0) score++; if (d.freeCashFlow > 0) score++;
  if (d.profitGrowthYoY > 0) score++; if (d.currentRatio > 1) score++; if (d.debtToEquity < 1) score++;
  if (d.operatingMargin > d.netMargin) score++; if (d.revenueGrowthYoY > 0) score++;
  if (d.roe > 10) score++; return score;
}
function calcAltmanZ(d) {
  if (!d.marketCap || !d.debtToEquity || !d.eps) return null;
  return (1.2 * 0.3 + 1.4 * (d.roe || 10) / 100 + 3.3 * (d.operatingMargin || 10) / 100 + 0.6 / (d.debtToEquity || 1) + 1.0 * (d.revenueGrowthYoY || 5) / 100);
}
function calcGrahamNumber(eps, bv) {
  if (!eps || !bv || eps < 0 || bv < 0) return null;
  return Math.sqrt(22.5 * eps * bv);
}

// ════════════════════════════════════════════════════════
// SECTION 7: UI COMPONENTS
// ════════════════════════════════════════════════════════
const CS = { card: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 24px" }, label: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12, fontFamily: "monospace", letterSpacing: "0.05em" }, row: { display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }, rk: { fontSize: 12, color: "rgba(255,255,255,0.45)" }, rv: { fontSize: 12, color: "#fff", fontFamily: "monospace", fontWeight: 600 } };
function sigCol(s) { return ["Bullish", "Buy", "Strong Buy", "Oversold"].includes(s) ? "#00e676" : ["Bearish", "Sell", "Strong Sell", "Overbought"].includes(s) ? "#ff1744" : "#ffc400"; }
function sigEmo(s) { return ["Bullish", "Buy", "Strong Buy"].includes(s) ? "▲" : ["Bearish", "Sell", "Strong Sell"].includes(s) ? "▼" : "●"; }
function Spark({ data, w = 260, ht = 60, color = "#00e676" }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), r = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${ht - ((v - mn) / r) * ht}`).join(" ");
  return <svg width={w} height={ht} style={{ display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
function Gauge({ value, label, color }) {
  const p = Math.min(Math.max((value + 100) / 200, 0), 1);
  return (<div style={{ textAlign: "center" }}><svg width="80" height="50" viewBox="0 0 80 50"><path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" /><path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${p * 100} 200`} /><text x="40" y="40" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="monospace">{typeof value === "number" ? value.toFixed(0) : value}</text></svg><div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: -4 }}>{label}</div></div>);
}
function ScoreBar({ score, label }) {
  const c = Math.min(Math.max(score, -100), 100), col = c > 30 ? "#00e676" : c < -30 ? "#ff1744" : "#ffc400";
  return (<div style={{ marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}><span style={{ color: "rgba(255,255,255,0.6)" }}>{label}</span><span style={{ color: col, fontWeight: 700, fontFamily: "monospace" }}>{c > 0 ? "+" : ""}{c.toFixed(0)}</span></div><div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, position: "relative" }}><div style={{ position: "absolute", left: "50%", width: 1, height: 4, background: "rgba(255,255,255,0.15)" }} /><div style={{ position: "absolute", left: c >= 0 ? "50%" : `${(c + 100) / 2}%`, width: `${Math.abs(c) / 2}%`, height: 4, borderRadius: 2, background: col, transition: "all 0.6s" }} /></div></div>);
}
function IndCard({ ind }) {
  return (<div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${sigCol(ind.signal)}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{ind.name}</span><span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${sigCol(ind.signal)}18`, color: sigCol(ind.signal), fontWeight: 700, fontFamily: "monospace" }}>{sigEmo(ind.signal)} {ind.signal}</span></div><div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>{ind.value}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{ind.detail}</div></div>);
}
function SectionTitle({ children, color = "rgba(255,255,255,0.4)", count }) {
  return <div style={{ ...CS.label, display: "flex", justifyContent: "space-between", color }}><span>{children}</span>{count != null && <span style={{ color: "rgba(255,255,255,0.25)" }}>{count} found</span>}</div>;
}

// ════════════════════════════════════════════════════════
// SECTION 8: MAIN PAGE
// ════════════════════════════════════════════════════════
export default function Home() {
  const [query, setQuery] = useState(""); const [loading, setLoading] = useState(false); const [loadingMsg, setLoadingMsg] = useState(""); const [result, setResult] = useState(null); const [error, setError] = useState(null); const [recent, setRecent] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const msgs = ["Scanning exchanges...", "Pulling market data...", "Computing indicators...", "Detecting patterns...", "Running strategies...", "Analysing fundamentals...", "Synthesising verdict..."];
  useEffect(() => { if (!loading) return; let i = 0; setLoadingMsg(msgs[0]); const iv = setInterval(() => { i = (i + 1) % msgs.length; setLoadingMsg(msgs[i]); }, 1800); return () => clearInterval(iv); }, [loading]);

  const analyse = useCallback(async (name) => {
    if (!name.trim()) return; setLoading(true); setError(null); setResult(null);
    const t = name.trim(); setRecent(p => [t, ...p.filter(s => s.toLowerCase() !== t.toLowerCase())].slice(0, 8));
    try {
      const res = await fetch("/api/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stockQuery: t }) });
      const d = await res.json(); if (!res.ok) throw new Error(d.error || "Failed");
      const prices = d.historicalPrices || [], highs = d.historicalHighs || prices.map(p => p * 1.01), lows = d.historicalLows || prices.map(p => p * 0.99), vols = d.historicalVolumes || [], opens = d.historicalOpens || prices.map((p, i) => i > 0 ? prices[i - 1] : p);
      const cp = d.currentPrice;

      // Compute all indicators
      const rsi = calcRSI(prices); const macdData = calcMACD(prices); const bb = calcBB(prices); const atr = calcATR(highs, lows, prices); const stoch = calcStoch(highs, lows, prices); const willR = calcWilliamsR(highs, lows, prices); const cci = calcCCI(highs, lows, prices); const obv = calcOBV(prices, vols); const mfi = calcMFI(highs, lows, prices, vols); const adx = calcADX(highs, lows, prices); const superTrend = calcSuperTrend(highs, lows, prices); const psar = calcParabolicSAR(highs, lows, prices); const vwap = calcVWAP(highs, lows, prices, vols);
      const sma20v = d.sma20 || sma(prices, 20), sma50v = d.sma50 || sma(prices, 50), sma100v = d.sma100 || sma(prices, 100), sma200v = d.sma200 || null;
      const ema9 = lastEma(prices, 9), ema12 = lastEma(prices, 12), ema21 = lastEma(prices, 21), ema26 = lastEma(prices, 26), ema50 = lastEma(prices, 50);
      const recentVol = vols.length >= 5 ? vols.slice(-5).reduce((a, b) => a + b, 0) / 5 : null;
      const avgVol = d.avgVolume || (vols.length >= 20 ? vols.slice(-20).reduce((a, b) => a + b, 0) / 20 : null);
      const volumeRatio = recentVol && avgVol ? recentVol / avgVol : null;
      const fib = d.fiftyTwoWeekHigh && d.fiftyTwoWeekLow ? calcFibonacci(d.fiftyTwoWeekHigh, d.fiftyTwoWeekLow) : null;
      const pivot = d.dayHigh && d.dayLow && d.prevClose ? calcPivotPoints(d.dayHigh, d.dayLow, d.prevClose) : null;
      const cam = d.dayHigh && d.dayLow && d.prevClose ? calcCamarilla(d.dayHigh, d.dayLow, d.prevClose) : null;

      // Build indicators
      const inds = [];
      if (rsi != null) inds.push({ name: "RSI (14)", value: rsi.toFixed(2), signal: rsi < 30 ? "Oversold" : rsi < 40 ? "Bullish" : rsi > 70 ? "Overbought" : rsi > 60 ? "Bearish" : "Neutral", detail: rsi < 30 ? "Reversal zone" : rsi > 70 ? "Correction zone" : `${rsi.toFixed(0)} — normal range`, cat: "oscillator" });
      if (macdData.macd != null) inds.push({ name: "MACD", value: macdData.macd.toFixed(2), signal: macdData.histogram > 0 ? "Bullish" : "Bearish", detail: `Signal: ${macdData.signal?.toFixed(2)} | Hist: ${macdData.histogram?.toFixed(2)}`, cat: "oscillator" });
      if (bb && cp) { const pos = ((cp - bb.lower) / (bb.upper - bb.lower) * 100); inds.push({ name: "Bollinger Bands", value: `${pos.toFixed(0)}%`, signal: cp < bb.lower ? "Oversold" : cp > bb.upper ? "Overbought" : pos < 30 ? "Bullish" : pos > 70 ? "Bearish" : "Neutral", detail: `U:₹${bb.upper.toFixed(0)} M:₹${bb.middle.toFixed(0)} L:₹${bb.lower.toFixed(0)}`, cat: "volatility" }); }
      if (stoch != null) inds.push({ name: "Stochastic %K", value: stoch.toFixed(2), signal: stoch < 20 ? "Oversold" : stoch > 80 ? "Overbought" : stoch < 40 ? "Bullish" : stoch > 60 ? "Bearish" : "Neutral", detail: stoch < 20 ? "Deep oversold" : stoch > 80 ? "Deep overbought" : "Mid-range", cat: "oscillator" });
      if (willR != null) inds.push({ name: "Williams %R", value: willR.toFixed(2), signal: willR < -80 ? "Oversold" : willR > -20 ? "Overbought" : "Neutral", detail: `${willR.toFixed(0)} (OS: <-80, OB: >-20)`, cat: "oscillator" });
      if (cci != null) inds.push({ name: "CCI (20)", value: cci.toFixed(2), signal: cci < -100 ? "Oversold" : cci > 100 ? "Overbought" : cci > 0 ? "Bullish" : "Bearish", detail: cci > 200 ? "Extremely overbought" : cci < -200 ? "Extremely oversold" : "Within range", cat: "oscillator" });
      if (mfi != null) inds.push({ name: "MFI (14)", value: mfi.toFixed(2), signal: mfi < 20 ? "Oversold" : mfi > 80 ? "Overbought" : mfi > 50 ? "Bullish" : "Bearish", detail: "Money Flow Index — volume-weighted RSI", cat: "volume" });
      if (atr != null && cp) { const ap = (atr / cp) * 100; inds.push({ name: "ATR (14)", value: `₹${atr.toFixed(2)}`, signal: ap > 3 ? "High Volatility" : ap < 1.5 ? "Low Volatility" : "Neutral", detail: `${ap.toFixed(2)}% of price`, cat: "volatility" }); }
      if (adx) inds.push({ name: "ADX (14)", value: adx.adx.toFixed(2), signal: adx.plusDI > adx.minusDI ? "Bullish" : "Bearish", detail: `+DI:${adx.plusDI.toFixed(1)} -DI:${adx.minusDI.toFixed(1)} | ${adx.adx > 25 ? "Strong" : "Weak"} trend`, cat: "trend" });
      if (superTrend) inds.push({ name: "SuperTrend", value: superTrend.trend, signal: superTrend.trend, detail: `Upper: ₹${superTrend.upper.toFixed(0)} | Lower: ₹${superTrend.lower.toFixed(0)}`, cat: "trend" });
      if (psar) inds.push({ name: "Parabolic SAR", value: `₹${psar.sar.toFixed(2)}`, signal: psar.trend, detail: `SAR ${psar.trend === "Bullish" ? "below" : "above"} price`, cat: "trend" });
      if (vwap && cp) inds.push({ name: "VWAP", value: `₹${vwap.toFixed(2)}`, signal: cp > vwap ? "Bullish" : "Bearish", detail: `Price ${cp > vwap ? "above" : "below"} VWAP`, cat: "volume" });
      if (obv != null) inds.push({ name: "OBV", value: obv > 1e6 ? `${(obv / 1e6).toFixed(1)}M` : obv > 1e3 ? `${(obv / 1e3).toFixed(0)}K` : obv.toFixed(0), signal: obv > 0 ? "Bullish" : "Bearish", detail: "On Balance Volume — cumulative volume flow", cat: "volume" });
      // Moving Averages
      [[sma20v, "SMA 20"], [sma50v, "SMA 50"], [sma100v, "SMA 100"], [sma200v, "SMA 200"]].forEach(([v, n]) => { if (v && cp) inds.push({ name: n, value: `₹${v.toFixed(2)}`, signal: cp > v ? "Bullish" : "Bearish", detail: `${((cp / v - 1) * 100).toFixed(1)}% ${cp > v ? "above" : "below"}`, cat: "ma" }); });
      [[ema9, "EMA 9"], [ema12, "EMA 12"], [ema21, "EMA 21"], [ema26, "EMA 26"], [ema50, "EMA 50"]].forEach(([v, n]) => { if (v && cp) inds.push({ name: n, value: `₹${v.toFixed(2)}`, signal: cp > v ? "Bullish" : "Bearish", detail: `${((cp / v - 1) * 100).toFixed(1)}% ${cp > v ? "above" : "below"}`, cat: "ma" }); });
      // Golden/Death Cross
      if (sma50v && sma200v) inds.push({ name: sma50v > sma200v ? "Golden Cross" : "Death Cross", value: sma50v > sma200v ? "Active" : "Active", signal: sma50v > sma200v ? "Bullish" : "Bearish", detail: `SMA50 ${sma50v > sma200v ? "above" : "below"} SMA200`, cat: "ma" });
      if (volumeRatio) inds.push({ name: "Volume Ratio", value: `${volumeRatio.toFixed(2)}x`, signal: volumeRatio > 1.5 ? "Bullish" : volumeRatio < 0.7 ? "Bearish" : "Neutral", detail: volumeRatio > 1.5 ? "Above-avg participation" : "Normal", cat: "volume" });
      if (d.fiftyTwoWeekHigh && d.fiftyTwoWeekLow && cp) { const pos = ((cp - d.fiftyTwoWeekLow) / (d.fiftyTwoWeekHigh - d.fiftyTwoWeekLow)) * 100; inds.push({ name: "52W Range", value: `${pos.toFixed(0)}%`, signal: pos > 80 ? "Overbought" : pos < 20 ? "Oversold" : pos > 50 ? "Bullish" : "Bearish", detail: `L:₹${d.fiftyTwoWeekLow?.toFixed(0)} → H:₹${d.fiftyTwoWeekHigh?.toFixed(0)}`, cat: "trend" }); }

      // Candlestick patterns
      const candles = detectCandlesticks(opens, highs, lows, prices);
      // Chart patterns
      const charts = detectChartPatterns(prices, highs, lows);
      // SMC
      const smcSignals = detectSMC(opens, highs, lows, prices);
      // Strategies
      const strategies = generateStrategies({ rsi, macdData, stoch, adx, superTrend, bb, cp, sma20: sma20v, sma50: sma50v, volumeRatio, fiftyTwoWeekHigh: d.fiftyTwoWeekHigh, fiftyTwoWeekLow: d.fiftyTwoWeekLow }, inds);

      // Scores
      let ts = 0, tc = 0; inds.forEach(ind => { tc++; if (["Bullish", "Buy", "Strong Buy", "Oversold"].includes(ind.signal)) ts++; else if (["Bearish", "Sell", "Strong Sell", "Overbought"].includes(ind.signal)) ts--; });
      const techPct = tc > 0 ? (ts / tc) * 100 : 0;
      let fs = 0, fc = 0;
      if (d.pe != null) { fs += d.pe < 15 ? 1 : d.pe < 25 ? 0.3 : d.pe > 40 ? -1 : -0.3; fc++; }
      if (d.roe != null) { fs += d.roe > 20 ? 1 : d.roe > 12 ? 0.5 : -0.5; fc++; }
      if (d.debtToEquity != null) { fs += d.debtToEquity < 0.5 ? 1 : d.debtToEquity < 1 ? 0.3 : -0.8; fc++; }
      if (d.profitGrowthYoY != null) { fs += d.profitGrowthYoY > 20 ? 1 : d.profitGrowthYoY > 0 ? 0.3 : -0.8; fc++; }
      if (d.revenueGrowthYoY != null) { fs += d.revenueGrowthYoY > 15 ? 1 : d.revenueGrowthYoY > 5 ? 0.3 : -0.5; fc++; }
      if (d.operatingMargin != null) { fs += d.operatingMargin > 20 ? 1 : d.operatingMargin > 10 ? 0.3 : -0.5; fc++; }
      if (d.promoterHolding != null) { fs += d.promoterHolding > 60 ? 1 : d.promoterHolding > 40 ? 0.3 : -0.3; fc++; }
      if (d.currentRatio != null) { fs += d.currentRatio > 1.5 ? 0.5 : d.currentRatio < 1 ? -0.5 : 0; fc++; }
      if (d.freeCashFlowYield != null) { fs += d.freeCashFlowYield > 5 ? 1 : d.freeCashFlowYield > 0 ? 0.3 : -0.5; fc++; }
      const fundPct = fc > 0 ? (fs / fc) * 100 : 0;
      const comp = techPct * 0.4 + fundPct * 0.6;
      let verdict, vCol; if (comp > 40) { verdict = "STRONG BUY"; vCol = "#00e676"; } else if (comp > 15) { verdict = "BUY"; vCol = "#69f0ae"; } else if (comp > -15) { verdict = "HOLD"; vCol = "#ffc400"; } else if (comp > -40) { verdict = "SELL"; vCol = "#ff6e40"; } else { verdict = "STRONG SELL"; vCol = "#ff1744"; }

      const piotroski = calcPiotroski(d); const altmanZ = calcAltmanZ(d); const graham = d.grahamNumber || calcGrahamNumber(d.eps, d.bookValue);

      setResult({ ...d, indicators: inds, candles, charts, smcSignals, strategies, techScore: techPct, fundScore: fundPct, compositeScore: comp, verdict, verdictColor: vCol, rsi, macdData, bb, stoch, adx, superTrend, psar, vwap, fib, pivot, cam, piotroski, altmanZ, graham, sma20: sma20v, sma50: sma50v, volumeRatio });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  const handleSubmit = e => { e.preventDefault(); analyse(query); };
  const fm = (v, d = 2) => v != null ? Number(v).toFixed(d) : "—";
  const fp = v => v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "—";

  const tabs = [
    { id: "overview", label: "Overview" }, { id: "technical", label: "Technical" }, { id: "patterns", label: "Patterns" },
    { id: "smc", label: "SMC" }, { id: "strategies", label: "Strategies" }, { id: "fundamentals", label: "Fundamentals" },
    { id: "levels", label: "Levels" }, { id: "news", label: "News" },
  ];

  const r = result;

  return (<>
    <Head><title>Equity Analysis Terminal V2</title><meta name="viewport" content="width=device-width, initial-scale=1" /><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" /></Head>
    <style jsx global>{`*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0e17;color:#e0e6f0;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}::selection{background:#00e67640}input::placeholder{color:rgba(255,255,255,0.25)}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.fade-in{animation:fadeIn 0.4s ease-out both}`}</style>

    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d1321, #111827, #0f1729)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, background: "linear-gradient(135deg, #00e676, #00bfa5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#0a0e17" }}>₹</div>
            <div><h1 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Equity Analysis Terminal <span style={{ fontSize: 10, color: "#00e676", fontFamily: "monospace" }}>V2</span></h1><p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>BSE · NSE · 25+ INDICATORS · PATTERNS · SMC · STRATEGIES</p></div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Stock name or ticker — Reliance, TCS, INFY..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, outline: "none", fontFamily: "monospace" }} onFocus={e => e.target.style.borderColor = "#00e676"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
            <button type="submit" disabled={loading || !query.trim()} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: loading ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #00e676, #00bfa5)", color: loading ? "rgba(255,255,255,0.4)" : "#0a0e17", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>{loading ? "Analysing..." : "Analyse →"}</button>
          </form>
          {recent.length > 0 && <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>{recent.map((s, i) => <button key={i} onClick={() => { setQuery(s); analyse(s); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>{s}</button>)}</div>}
        </div>
      </div>

      {loading && <div style={{ maxWidth: 1280, margin: "50px auto", textAlign: "center", padding: "0 24px" }}><div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.06)", borderTopColor: "#00e676", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} /><p style={{ color: "#00e676", fontSize: 13, fontFamily: "monospace" }}>{loadingMsg}</p></div>}
      {error && <div style={{ maxWidth: 1280, margin: "30px auto", padding: "0 24px" }}><div style={{ background: "rgba(255,23,68,0.08)", border: "1px solid rgba(255,23,68,0.2)", borderRadius: 10, padding: "16px 20px" }}><p style={{ color: "#ff1744", fontSize: 13 }}>⚠ {error}</p></div></div>}

      {r && <div className="fade-in" style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 24px" }}>
        {/* Stock header */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div><h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{r.stockName || r.ticker}</h2><p style={{ marginTop: 3, fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{r.ticker} · {r.exchange} · {r.sector}</p>{r.businessDescription && <p style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, maxWidth: 600 }}>{r.businessDescription}</p>}</div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>₹{fm(r.currentPrice)}</div><div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: r.dayChange >= 0 ? "#00e676" : "#ff1744" }}>{fp(r.dayChange)} today</div></div>
        </div>
        {/* Verdict */}
        <div style={{ background: `linear-gradient(135deg, ${r.verdictColor}15, ${r.verdictColor}08)`, border: `1px solid ${r.verdictColor}30`, borderRadius: 12, padding: "16px 24px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", fontFamily: "monospace" }}>AI COMPOSITE VERDICT</div><div style={{ fontSize: 24, fontWeight: 900, color: r.verdictColor }}>{r.verdict}</div></div>
          <div style={{ display: "flex", gap: 20 }}><Gauge value={r.techScore} label="Technical" color={r.techScore > 20 ? "#00e676" : r.techScore < -20 ? "#ff1744" : "#ffc400"} /><Gauge value={r.fundScore} label="Fundamental" color={r.fundScore > 20 ? "#00e676" : r.fundScore < -20 ? "#ff1744" : "#ffc400"} /><Gauge value={r.compositeScore} label="Composite" color={r.verdictColor} /></div>
        </div>
        <div style={{ ...CS.card, marginBottom: 16 }}><ScoreBar score={r.techScore} label="Technical" /><ScoreBar score={r.fundScore} label="Fundamental" /><ScoreBar score={r.compositeScore} label="Composite" /></div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>{tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid " + (activeTab === t.id ? "#00e676" : "rgba(255,255,255,0.08)"), background: activeTab === t.id ? "rgba(0,230,118,0.1)" : "rgba(255,255,255,0.02)", color: activeTab === t.id ? "#00e676" : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{t.label}</button>)}</div>

        {/* === OVERVIEW === */}
        {activeTab === "overview" && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div style={CS.card}><SectionTitle>PRICE TREND</SectionTitle><Spark data={r.historicalPrices} color={r.dayChange >= 0 ? "#00e676" : "#ff1744"} /><div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}><span>O:₹{fm(r.open)}</span><span>H:₹{fm(r.dayHigh)}</span><span>L:₹{fm(r.dayLow)}</span><span>PC:₹{fm(r.prevClose)}</span></div></div>
            <div style={CS.card}><SectionTitle>MARKET DATA</SectionTitle>{[["Mkt Cap", r.marketCapLabel], ["Volume", r.volume ? Number(r.volume).toLocaleString("en-IN") : "—"], ["52W H", `₹${fm(r.fiftyTwoWeekHigh)}`], ["52W L", `₹${fm(r.fiftyTwoWeekLow)}`], ["Beta", fm(r.beta)], ["Avg Vol", r.avgVolume ? Number(r.avgVolume).toLocaleString("en-IN") : "—"]].map(([k, v], i) => <div key={i} style={CS.row}><span style={CS.rk}>{k}</span><span style={CS.rv}>{v}</span></div>)}</div>
          </div>
          {(r.promoterHolding != null || r.fiiHolding != null) && <div style={{ ...CS.card, marginBottom: 16 }}><SectionTitle>SHAREHOLDING</SectionTitle><div style={{ display: "flex", gap: 0, height: 22, borderRadius: 5, overflow: "hidden", marginBottom: 10 }}>{[{ l: "Promoter", v: r.promoterHolding, c: "#00e676", ch: r.promoterHoldingChange }, { l: "FII", v: r.fiiHolding, c: "#448aff", ch: r.fiiHoldingChange }, { l: "DII", v: r.diiHolding, c: "#ffc400", ch: r.diiHoldingChange }, { l: "Public", v: r.publicHolding, c: "#ff6e40" }].filter(x => x.v != null).map((x, i) => <div key={i} style={{ width: `${x.v}%`, background: x.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#0a0e17", fontFamily: "monospace" }}>{x.v > 8 ? `${x.v.toFixed(1)}%` : ""}</div>)}</div><div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{[{ l: "Promoter", v: r.promoterHolding, c: "#00e676", ch: r.promoterHoldingChange }, { l: "FII", v: r.fiiHolding, c: "#448aff", ch: r.fiiHoldingChange }, { l: "DII", v: r.diiHolding, c: "#ffc400", ch: r.diiHoldingChange }, { l: "Public", v: r.publicHolding, c: "#ff6e40" }].filter(x => x.v != null).map((x, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 7, height: 7, borderRadius: 2, background: x.c }} /><span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{x.l}: {x.v.toFixed(1)}%{x.ch != null ? ` (${x.ch > 0 ? "+" : ""}${x.ch.toFixed(1)}%)` : ""}</span></div>)}</div>{r.pledgedShares != null && <div style={{ marginTop: 8, fontSize: 10, color: r.pledgedShares > 20 ? "#ff1744" : "rgba(255,255,255,0.4)" }}>Pledged: {r.pledgedShares.toFixed(1)}%{r.pledgedShares > 20 ? " ⚠ High" : ""}</div>}</div>}
        </>}

        {/* === TECHNICAL === */}
        {activeTab === "technical" && <div style={{ ...CS.card, marginBottom: 16 }}><SectionTitle count={r.indicators.length}>ALL TECHNICAL INDICATORS</SectionTitle><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>{r.indicators.map((ind, i) => <IndCard key={i} ind={ind} />)}</div></div>}

        {/* === PATTERNS === */}
        {activeTab === "patterns" && <>
          <div style={{ ...CS.card, marginBottom: 16 }}><SectionTitle color="#ffc400" count={r.candles.length}>CANDLESTICK PATTERNS</SectionTitle>{r.candles.length === 0 ? <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>No significant candlestick patterns detected on latest candles.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>{r.candles.map((p, i) => <IndCard key={i} ind={p} />)}</div>}</div>
          <div style={{ ...CS.card, marginBottom: 16 }}><SectionTitle color="#448aff" count={r.charts.length}>CHART PATTERNS</SectionTitle>{r.charts.length === 0 ? <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>No significant chart patterns detected in recent price action.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>{r.charts.map((p, i) => <IndCard key={i} ind={p} />)}</div>}</div>
        </>}

        {/* === SMC === */}
        {activeTab === "smc" && <div style={{ ...CS.card, marginBottom: 16 }}><SectionTitle color="#e040fb" count={r.smcSignals.length}>SMART MONEY CONCEPTS</SectionTitle>{r.smcSignals.length === 0 ? <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>No SMC signals detected.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>{r.smcSignals.map((s, i) => <IndCard key={i} ind={s} />)}</div>}</div>}

        {/* === STRATEGIES === */}
        {activeTab === "strategies" && <div style={{ ...CS.card, marginBottom: 16 }}><SectionTitle color="#00bcd4">TRADING STRATEGIES</SectionTitle><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>{r.strategies.map((s, i) => <IndCard key={i} ind={s} />)}</div></div>}

        {/* === FUNDAMENTALS === */}
        {activeTab === "fundamentals" && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div style={CS.card}><SectionTitle>VALUATION</SectionTitle>{[["P/E", fm(r.pe), r.pe ? (r.pe < 15 ? "#00e676" : r.pe > 40 ? "#ff1744" : "#ffc400") : null], ["Forward P/E", fm(r.forwardPe)], ["P/B", fm(r.pb)], ["P/S", fm(r.ps)], ["EV/EBITDA", fm(r.evToEbitda)], ["EPS", `₹${fm(r.eps)}`], ["PEG", fm(r.peg)], ["Div Yield", fp(r.dividendYield)], ["Graham No.", r.graham ? `₹${fm(r.graham)}` : "—"], ["Intrinsic Val", r.intrinsicValueEstimate ? `₹${fm(r.intrinsicValueEstimate)}` : "—"], ["Target", r.analystTargetPrice ? `₹${fm(r.analystTargetPrice)}` : "—"]].map(([k, v, c], i) => <div key={i} style={CS.row}><span style={CS.rk}>{k}</span><span style={{ ...CS.rv, color: c || "#fff" }}>{v}</span></div>)}</div>
            <div style={CS.card}><SectionTitle>PROFITABILITY</SectionTitle>{[["ROE", fp(r.roe), r.roe ? (r.roe > 20 ? "#00e676" : r.roe < 10 ? "#ff1744" : "#ffc400") : null], ["ROCE", fp(r.roce)], ["ROA", fp(r.roa)], ["Op Margin", fp(r.operatingMargin)], ["Net Margin", fp(r.netMargin)], ["D/E", fm(r.debtToEquity), r.debtToEquity ? (r.debtToEquity < 0.5 ? "#00e676" : r.debtToEquity > 1 ? "#ff1744" : "#ffc400") : null], ["Current Ratio", fm(r.currentRatio)], ["Interest Coverage", fm(r.interestCoverage)]].map(([k, v, c], i) => <div key={i} style={CS.row}><span style={CS.rk}>{k}</span><span style={{ ...CS.rv, color: c || "#fff" }}>{v}</span></div>)}</div>
            <div style={CS.card}><SectionTitle>GROWTH</SectionTitle>{[["Rev Growth YoY", fp(r.revenueGrowthYoY)], ["Rev Growth 3Y", fp(r.revenueGrowth3Y)], ["Sales Growth 5Y", fp(r.salesGrowth5Y)], ["Profit Growth YoY", fp(r.profitGrowthYoY)], ["Profit Growth 3Y", fp(r.profitGrowth3Y)], ["Profit Growth 5Y", fp(r.profitGrowth5Y)], ["FCF Yield", fp(r.freeCashFlowYield)]].map(([k, v], i) => <div key={i} style={CS.row}><span style={CS.rk}>{k}</span><span style={CS.rv}>{v}</span></div>)}</div>
          </div>
          {/* Scoring models */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div style={{ ...CS.card, borderLeft: `3px solid ${r.piotroski >= 7 ? "#00e676" : r.piotroski >= 4 ? "#ffc400" : "#ff1744"}` }}><div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>PIOTROSKI F-SCORE</div><div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>{r.piotroski}/9</div><div style={{ fontSize: 10, color: r.piotroski >= 7 ? "#00e676" : r.piotroski >= 4 ? "#ffc400" : "#ff1744" }}>{r.piotroski >= 7 ? "Strong" : r.piotroski >= 4 ? "Average" : "Weak"}</div></div>
            {r.altmanZ != null && <div style={{ ...CS.card, borderLeft: `3px solid ${r.altmanZ > 2.99 ? "#00e676" : r.altmanZ > 1.81 ? "#ffc400" : "#ff1744"}` }}><div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>ALTMAN Z-SCORE</div><div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>{r.altmanZ.toFixed(2)}</div><div style={{ fontSize: 10, color: r.altmanZ > 2.99 ? "#00e676" : r.altmanZ > 1.81 ? "#ffc400" : "#ff1744" }}>{r.altmanZ > 2.99 ? "Safe" : r.altmanZ > 1.81 ? "Grey Zone" : "Distress"}</div></div>}
            {r.competitiveAdvantage && <div style={CS.card}><div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>MOAT</div><p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, marginTop: 6 }}>{r.competitiveAdvantage}</p></div>}
          </div>
          {/* Peers */}
          {r.peerComparison?.length > 0 && <div style={{ ...CS.card, marginBottom: 16 }}><SectionTitle>PEER COMPARISON</SectionTitle>{r.peerComparison.map((p, i) => <div key={i} style={CS.row}><span style={CS.rk}>{p.name}</span><span style={{ ...CS.rv, fontSize: 10 }}>P/E: {fm(p.pe)} | ROE: {fm(p.roe)}% | MCap: ₹{p.marketCap ? `${(p.marketCap).toLocaleString("en-IN")} Cr` : "—"}</span></div>)}</div>}
        </>}

        {/* === LEVELS === */}
        {activeTab === "levels" && <>
          {r.fib && <div style={{ ...CS.card, marginBottom: 12 }}><SectionTitle color="#e040fb">FIBONACCI RETRACEMENT (52W)</SectionTitle>{[["0% (High)", r.fib.level0], ["23.6%", r.fib.level236], ["38.2%", r.fib.level382], ["50%", r.fib.level500], ["61.8%", r.fib.level618], ["78.6%", r.fib.level786], ["100% (Low)", r.fib.level100]].map(([k, v], i) => <div key={i} style={CS.row}><span style={CS.rk}>{k}</span><span style={{ ...CS.rv, color: Math.abs(r.currentPrice - v) / r.currentPrice < 0.02 ? "#ffc400" : "#fff" }}>₹{v.toFixed(2)}{Math.abs(r.currentPrice - v) / r.currentPrice < 0.02 ? " ← Near" : ""}</span></div>)}</div>}
          {r.pivot && <div style={{ ...CS.card, marginBottom: 12 }}><SectionTitle color="#00bcd4">PIVOT POINTS (CLASSIC)</SectionTitle>{[["R3", r.pivot.r3], ["R2", r.pivot.r2], ["R1", r.pivot.r1], ["Pivot", r.pivot.pp], ["S1", r.pivot.s1], ["S2", r.pivot.s2], ["S3", r.pivot.s3]].map(([k, v], i) => <div key={i} style={CS.row}><span style={CS.rk}>{k}</span><span style={CS.rv}>₹{v.toFixed(2)}</span></div>)}</div>}
          {r.cam && <div style={{ ...CS.card, marginBottom: 12 }}><SectionTitle color="#ff9800">CAMARILLA PIVOTS</SectionTitle>{[["R4", r.cam.r4], ["R3", r.cam.r3], ["R2", r.cam.r2], ["R1", r.cam.r1], ["S1", r.cam.s1], ["S2", r.cam.s2], ["S3", r.cam.s3], ["S4", r.cam.s4]].map(([k, v], i) => <div key={i} style={CS.row}><span style={CS.rk}>{k}</span><span style={CS.rv}>₹{v.toFixed(2)}</span></div>)}</div>}
        </>}

        {/* === NEWS === */}
        {activeTab === "news" && <>
          {r.recentNews?.length > 0 && <div style={{ ...CS.card, marginBottom: 16 }}><SectionTitle count={r.recentNews.length}>LATEST NEWS</SectionTitle>{r.recentNews.map((n, i) => { const news = typeof n === "string" ? { headline: n } : n; return <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>{news.sentiment && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: news.sentiment === "positive" ? "rgba(0,230,118,0.15)" : news.sentiment === "negative" ? "rgba(255,23,68,0.15)" : "rgba(255,196,0,0.15)", color: news.sentiment === "positive" ? "#00e676" : news.sentiment === "negative" ? "#ff1744" : "#ffc400" }}>{news.sentiment}</span>}{news.date && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{news.date}</span>}</div><p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 600, lineHeight: 1.4 }}>{news.headline}</p>{news.summary && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4, lineHeight: 1.5 }}>{news.summary}</p>}</div>; })}</div>}
          {r.smartMoneySignals && <div style={{ ...CS.card, background: "rgba(68,138,255,0.04)", borderColor: "rgba(68,138,255,0.15)", marginBottom: 16 }}><SectionTitle color="#448aff">SMART MONEY ACTIVITY</SectionTitle><p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{r.smartMoneySignals}</p></div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {r.keyRisks?.length > 0 && <div style={{ ...CS.card, background: "rgba(255,23,68,0.04)", borderColor: "rgba(255,23,68,0.12)" }}><SectionTitle color="#ff1744">KEY RISKS</SectionTitle>{r.keyRisks.map((x, i) => <div key={i} style={{ padding: "4px 0", fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}><span style={{ color: "#ff1744", marginRight: 5 }}>✕</span>{x}</div>)}</div>}
            {r.keyCatalysts?.length > 0 && <div style={{ ...CS.card, background: "rgba(0,230,118,0.04)", borderColor: "rgba(0,230,118,0.12)" }}><SectionTitle color="#00e676">KEY CATALYSTS</SectionTitle>{r.keyCatalysts.map((x, i) => <div key={i} style={{ padding: "4px 0", fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}><span style={{ color: "#00e676", marginRight: 5 }}>✦</span>{x}</div>)}</div>}
          </div>
        </>}

        {/* Analyst + Disclaimer */}
        {r.analystConsensus && <div style={{ ...CS.card, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}><div><span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>ANALYST CONSENSUS </span><span style={{ fontSize: 13, fontWeight: 700, color: sigCol(["Strong Buy", "Buy"].includes(r.analystConsensus) ? "Bullish" : ["Sell", "Strong Sell"].includes(r.analystConsensus) ? "Bearish" : "Neutral") }}>{r.analystConsensus}{r.analystCount ? ` (${r.analystCount} analysts)` : ""}</span></div>{r.analystTargetPrice && r.currentPrice && <div><span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>TARGET </span><span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>₹{fm(r.analystTargetPrice)}</span><span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, fontFamily: "monospace", color: r.analystTargetPrice > r.currentPrice ? "#00e676" : "#ff1744" }}>({((r.analystTargetPrice / r.currentPrice - 1) * 100).toFixed(1)}%)</span></div>}</div>}
        <div style={{ background: "rgba(255,196,0,0.04)", border: "1px solid rgba(255,196,0,0.1)", borderRadius: 8, padding: "10px 14px", marginBottom: 24 }}><p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>⚠ <strong>Disclaimer:</strong> AI-generated analysis using publicly available data. NOT financial advice. Consult a SEBI-registered advisor. Past performance ≠ future results.</p></div>
      </div>}

      {/* Empty state */}
      {!loading && !r && !error && <div style={{ maxWidth: 1280, margin: "0 auto", padding: "50px 24px", textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.15 }}>📊</div><p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, maxWidth: 420, margin: "0 auto", lineHeight: 1.7 }}>Enter any BSE/NSE stock for comprehensive analysis: 25+ technical indicators, candlestick & chart patterns, Smart Money Concepts, trading strategies, enhanced fundamentals, and AI verdict.</p><div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>{["Reliance", "TCS", "HDFC Bank", "Infosys", "ITC", "Bajaj Finance", "SBI", "Tata Motors"].map(s => <button key={s} onClick={() => { setQuery(s); analyse(s); }} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer" }} onMouseEnter={e => { e.target.style.borderColor = "#00e676"; e.target.style.color = "#00e676"; }} onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.color = "rgba(255,255,255,0.5)"; }}>{s}</button>)}</div></div>}
    </div>
  </>);
}
