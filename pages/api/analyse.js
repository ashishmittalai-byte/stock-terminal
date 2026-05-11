// pages/api/analyse.js — Standard serverless (no Edge Runtime needed without grounding)

const API_KEY = process.env.GEMINI_API_KEY;

const PROMPT = `Expert Indian equity analyst. Return ONLY raw JSON (no markdown/backticks).
{
  "stockName":string,"ticker":string,"currentPrice":number,"change":number,"changePercent":number,
  "open":number,"dayHigh":number,"dayLow":number,"previousClose":number,"volume":string,
  "weekHigh52":number,"weekLow52":number,"marketCap":string,
  "movingAverages":[{"name":"SMA 20/50/100/200 + EMA 9/21/50/200","value":number,"signal":"Buy/Sell/Neutral"}],
  "maSummary":"X Buy, Y Sell. Golden/Death Cross status.",
  "indicators":[{"name":"RSI/MACD/MACD Signal/Histogram/Stochastic/Williams%R/CCI/ADX/Supertrend/SAR/VWAP/BollingerUpper/BollingerLower/ATR/OBV/VolumeRatio/MFI/ROC","value":number,"signal":string}],
  "chartPattern":{"pattern":string,"implication":"Bullish/Bearish/Neutral","breakoutLevel":number,"targetPrice":number,"stopLoss":number,"description":string,"additionalPatterns":[string]},
  "supportResistance":{"support1":n,"support2":n,"support3":n,"resistance1":n,"resistance2":n,"resistance3":n,"pivotPoint":n},
  "candlestickPatterns":[{"name":string,"signal":"Bullish/Bearish","reliability":"High/Medium/Low"}],
  "fundamentals":{"P/E":n,"P/B":n,"EPS":n,"ROE":"%","ROCE":"%","D/E":n,"Net Margin":"%","Revenue Growth":"%","Profit Growth":"%","Dividend Yield":"%","Book Value":n,"EV/EBITDA":n},
  "shareholding":{"promoter":n,"fii":n,"dii":n,"public":n},
  "smartMoney":[string],"news":[{"headline":string,"source":string,"date":string}],
  "risks":[string],"catalysts":[string],
  "strategies":[{"name":string,"description":string}],
  "researchLinks":[{"title":string,"url":string}],
  "technicalScore":0-100,"fundamentalScore":0-100,"compositeScore":0-100,
  "verdict":"Strong Buy/Buy/Hold/Sell/Strong Sell","overallSummary":string
}
Return 8 MAs, 18 indicators, chart pattern, S/R levels, candlestick patterns, fundamentals, news, verdict. All numbers as JSON numbers. Fill every field.`;

function extractJSON(text) {
  if (!text) return null;
  const s = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(s); } catch {}
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) {
    try { return JSON.parse(s.substring(i, j + 1)); } catch {}
    try { return JSON.parse(s.substring(i, j + 1).replace(/,\s*([}\]])/g, '$1')); } catch {}
  }
  return null;
}

async function callGemini(model, stock) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + API_KEY;
  const isGemma = model.startsWith('gemma');

  const body = {
    contents: [{
      role: 'user',
      parts: [{
        text: isGemma
          ? PROMPT + '\n\nAnalyse this Indian stock: ' + stock
          : 'Analyse Indian stock: ' + stock
      }],
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  };

  if (!isGemma) {
    body.system_instruction = { parts: [{ text: PROMPT }] };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(function() { ctrl.abort(); }, 9000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const e = await res.text().catch(function() { return ''; });
      if (res.status === 429) throw new Error('RATE_LIMIT');
      throw new Error('HTTP ' + res.status + ': ' + e.substring(0, 150));
    }
    const data = await res.json();
    const cand = data.candidates && data.candidates[0];
    if (!cand || !cand.content || !cand.content.parts) throw new Error('No content');
    var text = cand.content.parts.filter(function(p) { return p.text && !p.thought; }).map(function(p) { return p.text; }).join('\n');
    if (!text || text.trim().length < 30) throw new Error('Empty response');
    return text;
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  var body;
  try { body = req.body; } catch(e) {
    return res.status(400).json({ error: 'Invalid body' });
  }

  var stock = body && body.stock ? body.stock.trim() : '';
  if (!stock) return res.status(400).json({ error: 'Stock name required' });

  var models = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  var errors = [];

  for (var m = 0; m < models.length; m++) {
    try {
      var text = await callGemini(models[m], stock);
      var json = extractJSON(text);
      if (json) {
        json._model = models[m];
        json._skipped = errors.length > 0 ? errors : undefined;
        return res.status(200).json(json);
      }
      return res.status(200).json({ stockName: stock, rawAnalysis: text, verdict: 'Hold', _model: models[m] });
    } catch (err) {
      errors.push(models[m] + ': ' + (err.name === 'AbortError' ? 'timed out' : err.message));
    }
  }

  return res.status(502).json({ error: 'Failed: ' + errors.join(' | ') });
}
