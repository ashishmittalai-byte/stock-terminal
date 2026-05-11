import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";

// ═══════ INDICATOR FUNCTIONS ═══════
function smaV(a,p){if(a.length<p)return null;return a.slice(-p).reduce((s,v)=>s+v,0)/p}
function emaArr(a,p){if(a.length<p)return[];const k=2/(p+1);let e=a.slice(0,p).reduce((s,v)=>s+v,0)/p;const r=[e];for(let i=p;i<a.length;i++){e=a[i]*k+e*(1-k);r.push(e)}return r}
function lastEma(a,p){const e=emaArr(a,p);return e.length?e[e.length-1]:null}
function calcRSI(p,n=14){if(p.length<n+1)return null;let g=0,l=0;for(let i=1;i<=n;i++){const d=p[i]-p[i-1];d>0?g+=d:l-=d}g/=n;l/=n;return l===0?100:100-100/(1+g/l)}
function calcMACD(p){const e12=emaArr(p,12),e26=emaArr(p,26);if(!e12.length||!e26.length)return{macd:null,signal:null,histogram:null};const o=e12.length-e26.length;const ml=e26.map((v,i)=>e12[i+o]-v);const sl=emaArr(ml,9);const m=ml[ml.length-1],s=sl.length?sl[sl.length-1]:null;return{macd:m,signal:s,histogram:s!=null?m-s:null}}
function calcBB(p,n=20){if(p.length<n)return null;const s=p.slice(-n),m=s.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(s.reduce((a,b)=>a+(b-m)**2,0)/n);return{upper:m+2*sd,middle:m,lower:m-2*sd}}
function calcATR(h,l,c,n=14){if(c.length<n+1)return null;let a=0;for(let i=1;i<=n;i++)a+=Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1]));return a/n}
function calcStoch(h,l,c,n=14){if(c.length<n)return null;const hh=Math.max(...h.slice(-n)),ll=Math.min(...l.slice(-n));return hh===ll?50:((c[c.length-1]-ll)/(hh-ll))*100}
function calcWR(h,l,c,n=14){if(c.length<n)return null;const hh=Math.max(...h.slice(-n)),ll=Math.min(...l.slice(-n));return hh===ll?-50:((hh-c[c.length-1])/(hh-ll))*-100}
function calcCCI(h,l,c,n=20){if(c.length<n)return null;const tp=c.slice(-n).map((v,i)=>(h[h.length-n+i]+l[l.length-n+i]+v)/3);const m=tp.reduce((a,b)=>a+b,0)/n;const md=tp.reduce((a,b)=>a+Math.abs(b-m),0)/n;return md===0?0:(tp[tp.length-1]-m)/(0.015*md)}
function calcMFI(h,l,c,v,n=14){if(c.length<n+1)return null;let pf=0,nf=0;for(let i=c.length-n;i<c.length;i++){const tp=(h[i]+l[i]+c[i])/3,pt=(h[i-1]+l[i-1]+c[i-1])/3;const mf=tp*v[i];tp>pt?pf+=mf:nf+=mf}return nf===0?100:100-100/(1+pf/nf)}
function calcADX(h,l,c,n=14){if(c.length<n*2)return null;let pd=0,nd=0,tr=0;for(let i=1;i<=n;i++){const u=h[i]-h[i-1],d=l[i-1]-l[i];pd+=u>d&&u>0?u:0;nd+=d>u&&d>0?d:0;tr+=Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1]))}const pi=(pd/tr)*100,ni=(nd/tr)*100;return{adx:Math.abs(pi-ni)/(pi+ni)*100,plusDI:pi,minusDI:ni}}
function calcSuperTrend(h,l,c,n=10,m=3){const a=calcATR(h,l,c,n);if(!a)return null;const cp=c[c.length-1];const bu=(h[h.length-1]+l[l.length-1])/2+m*a;const bl=(h[h.length-1]+l[l.length-1])/2-m*a;return{trend:cp>bu?"Bearish":"Bullish",upper:bu,lower:bl}}
function calcPSAR(h,l,c){if(c.length<5)return null;let af=.02,ep,sar,bull=true;sar=l[0];ep=h[0];for(let i=1;i<c.length;i++){sar+=af*(ep-sar);if(bull){if(h[i]>ep){ep=h[i];af=Math.min(af+.02,.2)}if(l[i]<sar){bull=false;sar=ep;ep=l[i];af=.02}}else{if(l[i]<ep){ep=l[i];af=Math.min(af+.02,.2)}if(h[i]>sar){bull=true;sar=ep;ep=h[i];af=.02}}}return{sar,trend:bull?"Bullish":"Bearish"}}
function calcVWAP(h,l,c,v){if(c.length<5)return null;let cv=0,ct=0;for(let i=0;i<c.length;i++){cv+=((h[i]+l[i]+c[i])/3)*v[i];ct+=v[i]}return ct===0?null:cv/ct}
function calcOBV(c,v){if(c.length<2)return null;let o=0;for(let i=1;i<c.length;i++)o+=c[i]>c[i-1]?v[i]:c[i]<c[i-1]?-v[i]:0;return o}
function calcFib(hi,lo){const d=hi-lo;return{l0:hi,l236:hi-.236*d,l382:hi-.382*d,l500:hi-.5*d,l618:hi-.618*d,l786:hi-.786*d,l100:lo}}
function calcPivots(h,l,c){const pp=(h+l+c)/3;return{pp,r1:2*pp-l,r2:pp+(h-l),r3:h+2*(pp-l),s1:2*pp-h,s2:pp-(h-l),s3:l-2*(h-pp)}}

// ═══════ CANDLESTICK PATTERNS ═══════
function detectCandles(o,h,l,c){const n=c.length;if(n<3)return[];const ps=[];const i=n-1;const body=Math.abs(c[i]-o[i]),rng=h[i]-l[i],uw=h[i]-Math.max(o[i],c[i]),lw=Math.min(o[i],c[i])-l[i];const pb=n>1?Math.abs(c[i-1]-o[i-1]):0;const bull=c[i]>o[i],pBull=n>1?c[i-1]>o[i-1]:false;
if(body<rng*.1&&rng>0)ps.push({name:"Doji",signal:"Neutral",detail:"Indecision candle"});
if(lw>body*2&&uw<body*.5&&!pBull&&body>0)ps.push({name:"Hammer",signal:"Bullish",detail:"Potential bottom reversal"});
if(uw>body*2&&lw<body*.5&&pBull&&body>0)ps.push({name:"Shooting Star",signal:"Bearish",detail:"Potential top reversal"});
if(n>1&&bull&&!pBull&&body>pb)ps.push({name:"Bullish Engulfing",signal:"Bullish",detail:"Strong reversal signal"});
if(n>1&&!bull&&pBull&&body>pb)ps.push({name:"Bearish Engulfing",signal:"Bearish",detail:"Strong reversal signal"});
if(body>rng*.9&&rng>0)ps.push({name:bull?"Bullish Marubozu":"Bearish Marubozu",signal:bull?"Bullish":"Bearish",detail:bull?"Strong buying":"Strong selling"});
if(n>2&&c[i]>o[i]&&c[i-1]>o[i-1]&&c[i-2]>o[i-2]&&c[i]>c[i-1]&&c[i-1]>c[i-2])ps.push({name:"Three White Soldiers",signal:"Bullish",detail:"Strong continuation"});
if(n>2&&c[i]<o[i]&&c[i-1]<o[i-1]&&c[i-2]<o[i-2]&&c[i]<c[i-1]&&c[i-1]<c[i-2])ps.push({name:"Three Black Crows",signal:"Bearish",detail:"Strong continuation"});
return ps}

// ═══════ CHART PATTERNS ═══════
function detectCharts(p,h,l){const n=p.length;if(n<15)return[];const ps=[];
const r=p.slice(-15),rMax=Math.max(...r),rMin=Math.min(...r);
const last5R=Math.max(...p.slice(-5))-Math.min(...p.slice(-5));const prev10R=n>15?Math.max(...p.slice(-15,-5))-Math.min(...p.slice(-15,-5)):0;
if(prev10R>0&&last5R<prev10R*.4&&p[n-1]>p[Math.max(0,n-11)])ps.push({name:"Bull Flag",signal:"Bullish",detail:"Consolidation after up-move"});
if(prev10R>0&&last5R<prev10R*.4&&p[n-1]<p[Math.max(0,n-11)])ps.push({name:"Bear Flag",signal:"Bearish",detail:"Consolidation after down-move"});
const topFlat=r.filter(v=>v>rMax*.98).length,rising=r[r.length-1]>r[0];
if(topFlat>=3&&rising)ps.push({name:"Ascending Triangle",signal:"Bullish",detail:"Flat resistance, rising support"});
return ps}

// ═══════ SMC ═══════
function detectSMC(o,h,l,c){const n=c.length;if(n<10)return[];const s=[];
const pH=Math.max(...h.slice(-10,-2)),pL=Math.min(...l.slice(-10,-2));
if(c[n-1]>pH)s.push({name:"BOS (Bullish)",signal:"Bullish",detail:`Broke above ₹${pH.toFixed(0)}`});
if(c[n-1]<pL)s.push({name:"BOS (Bearish)",signal:"Bearish",detail:`Broke below ₹${pL.toFixed(0)}`});
if(n>2&&l[n-1]-h[n-3]>0)s.push({name:"Bullish FVG",signal:"Bullish",detail:"Unfilled gap — support zone"});
if(n>2&&l[n-3]-h[n-1]>0)s.push({name:"Bearish FVG",signal:"Bearish",detail:"Unfilled gap — resistance zone"});
const p5H=Math.max(...h.slice(-7,-2)),p5L=Math.min(...l.slice(-7,-2));
if(h[n-1]>p5H&&c[n-1]<p5H)s.push({name:"Liquidity Sweep ↑",signal:"Bearish",detail:"Stop hunt above highs"});
if(l[n-1]<p5L&&c[n-1]>p5L)s.push({name:"Liquidity Sweep ↓",signal:"Bullish",detail:"Stop hunt below lows"});
return s.slice(0,5)}

// ═══════ STRATEGIES ═══════
function genStrategies(d){const st=[];const{rsi,macdH,stoch,adx,superTrend,bb,cp,sma20,sma50,volRatio,w52H,w52L}=d;
st.push({name:"Momentum",signal:rsi>50&&rsi<70&&macdH>0?"Buy":rsi<50&&rsi>30&&macdH<0?"Sell":"Neutral",detail:"RSI + MACD alignment"});
st.push({name:"Trend Following",signal:cp>sma20&&sma20>sma50&&adx?.adx>25?"Buy":cp<sma20&&sma20<sma50&&adx?.adx>25?"Sell":"Neutral",detail:"MA alignment + ADX strength"});
if(bb)st.push({name:"Mean Reversion",signal:cp<bb.lower?"Buy":cp>bb.upper?"Sell":"Neutral",detail:"Bollinger Band extremes"});
st.push({name:"Breakout",signal:w52H&&cp>w52H*.97&&volRatio>1.3?"Buy":w52L&&cp<w52L*1.03&&volRatio>1.3?"Sell":"Neutral",detail:"52W extreme + volume"});
st.push({name:"Swing",signal:rsi<35&&stoch<25?"Buy":rsi>65&&stoch>75?"Sell":"Neutral",detail:"Oscillator extremes"});
return st}

// ═══════ FUNDAMENTAL SCORING ═══════
function piotroski(d){let s=0;if(d.netMargin>0)s++;if(d.roa>0)s++;if(d.freeCashFlow>0)s++;if(d.profitGrowthYoY>0)s++;if(d.currentRatio>1)s++;if(d.debtToEquity<1)s++;if(d.operatingMargin>d.netMargin)s++;if(d.revenueGrowthYoY>0)s++;if(d.roe>10)s++;return s}
function graham(eps,bv){return eps>0&&bv>0?Math.sqrt(22.5*eps*bv):null}

// ═══════ CANDLESTICK CHART COMPONENT ═══════
function CandlestickChart({candles,width=700,height=340}){
  if(!candles||candles.length<5)return <div style={{color:"rgba(255,255,255,0.3)",fontSize:12,padding:20}}>Insufficient data for chart</div>;
  const chartH=height*.7,volH=height*.25,gap=5,cw=Math.max(2,Math.min(8,(width-40)/candles.length-1));
  const prices=candles.flatMap(c=>[c.high,c.low]);const mn=Math.min(...prices),mx=Math.max(...prices),pr=mx-mn||1;
  const maxVol=Math.max(...candles.map(c=>c.volume))||1;
  const yP=v=>20+(1-(v-mn)/pr)*(chartH-30);
  const ema20=emaArr(candles.map(c=>c.close),20);
  return(<svg width={width} height={height} style={{display:"block"}}><rect width={width} height={height} fill="transparent"/>
    {[0,.25,.5,.75,1].map(f=>{const y=20+f*(chartH-30),v=mx-f*pr;return<g key={f}><line x1={30} x2={width-10} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/><text x={2} y={y+3} fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">{v.toFixed(0)}</text></g>})}
    {candles.map((c,i)=>{const x=35+i*(cw+1);const bull=c.close>=c.open;const col=bull?"#00e676":"#ff1744";const bodyT=yP(Math.max(c.open,c.close)),bodyB=yP(Math.min(c.open,c.close));const bodyH=Math.max(1,bodyB-bodyT);
    return<g key={i}><line x1={x+cw/2} x2={x+cw/2} y1={yP(c.high)} y2={yP(c.low)} stroke={col} strokeWidth="1"/><rect x={x} y={bodyT} width={cw} height={bodyH} fill={col} rx="0.5"/>
    <rect x={x} y={chartH+gap} width={cw} height={Math.max(1,(c.volume/maxVol)*volH)} fill={col} opacity="0.3"/></g>})}
    {ema20.length>1&&<polyline points={ema20.map((v,i)=>`${35+(i+candles.length-ema20.length)*(cw+1)+cw/2},${yP(v)}`).join(" ")} fill="none" stroke="#ffc400" strokeWidth="1" opacity="0.6"/>}
    <text x={width-60} y={chartH+gap+volH+12} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">Vol</text>
    <text x={width-80} y={12} fill="#ffc400" fontSize="8" fontFamily="monospace" opacity="0.6">— EMA 20</text>
  </svg>)}

// ═══════ UI HELPERS ═══════
const CS={card:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"20px 24px"},lb:{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:12,fontFamily:"monospace",letterSpacing:"0.05em"},rw:{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"},rk:{fontSize:12,color:"rgba(255,255,255,0.45)"},rv:{fontSize:12,color:"#fff",fontFamily:"monospace",fontWeight:600}};
function sc(s){return["Bullish","Buy","Strong Buy","Oversold"].includes(s)?"#00e676":["Bearish","Sell","Strong Sell","Overbought"].includes(s)?"#ff1744":"#ffc400"}
function se(s){return["Bullish","Buy","Strong Buy"].includes(s)?"▲":["Bearish","Sell","Strong Sell"].includes(s)?"▼":"●"}
function Gauge({value,label,color}){const p=Math.min(Math.max((value+100)/200,0),1);return<div style={{textAlign:"center"}}><svg width="80" height="50" viewBox="0 0 80 50"><path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round"/><path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${p*100} 200`}/><text x="40" y="40" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="monospace">{value?.toFixed(0)}</text></svg><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:-4}}>{label}</div></div>}
function SB({score,label}){const c=Math.min(Math.max(score,-100),100),col=c>30?"#00e676":c<-30?"#ff1744":"#ffc400";return<div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}><span style={{color:"rgba(255,255,255,0.6)"}}>{label}</span><span style={{color:col,fontWeight:700,fontFamily:"monospace"}}>{c>0?"+":""}{c.toFixed(0)}</span></div><div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,position:"relative"}}><div style={{position:"absolute",left:"50%",width:1,height:4,background:"rgba(255,255,255,0.15)"}}/><div style={{position:"absolute",left:c>=0?"50%":`${(c+100)/2}%`,width:`${Math.abs(c)/2}%`,height:4,borderRadius:2,background:col,transition:"all 0.6s"}}/></div></div>}
function IC({ind}){return<div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,padding:"12px 14px",borderLeft:`3px solid ${sc(ind.signal)}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{ind.name}</span><span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:`${sc(ind.signal)}18`,color:sc(ind.signal),fontWeight:700,fontFamily:"monospace"}}>{se(ind.signal)} {ind.signal}</span></div><div style={{fontSize:16,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{ind.value}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:3}}>{ind.detail}</div></div>}
function ST({children,color="rgba(255,255,255,0.4)",count}){return<div style={{...CS.lb,display:"flex",justifyContent:"space-between",color}}><span>{children}</span>{count!=null&&<span style={{color:"rgba(255,255,255,0.25)"}}>{count}</span>}</div>}

// ═══════ ANALYST LINKS ═══════
function AnalystLinks({ticker,name}){
  const t=ticker?.replace(".NS","").replace(".BO","");const n=name?.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  const links=[
    {label:"Screener.in",url:`https://www.screener.in/company/${t}/`,color:"#4caf50"},
    {label:"Trendlyne",url:`https://trendlyne.com/equity/${t}/`,color:"#2196f3"},
    {label:"Tickertape",url:`https://www.tickertape.in/stocks/${t}`,color:"#ff9800"},
    {label:"MoneyControl",url:`https://www.moneycontrol.com/india/stockpricequote/${n}/${t}`,color:"#e91e63"},
    {label:"NSE India",url:`https://www.nseindia.com/get-quotes/equity?symbol=${t}`,color:"#00bcd4"},
    {label:"BSE India",url:`https://www.bseindia.com/stock-share-price/${n}/${t}/`,color:"#ff5722"},
    {label:"TijoriFinance",url:`https://www.tijorifinance.com/company/${n}`,color:"#9c27b0"},
    {label:"Investing.com",url:`https://in.investing.com/equities/${n}`,color:"#4caf50"},
  ];
  return<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{links.map((l,i)=><a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${l.color}40`,background:`${l.color}10`,color:l.color,fontSize:11,fontWeight:600,textDecoration:"none",transition:"all 0.2s"}} onMouseEnter={e=>e.target.style.background=`${l.color}25`} onMouseLeave={e=>e.target.style.background=`${l.color}10`}>{l.label} ↗</a>)}</div>}

// ═══════ WATCHLIST ═══════
function useWatchlist(){
  const[wl,setWl]=useState([]);
  useEffect(()=>{try{const s=localStorage.getItem("eq_watchlist");if(s)setWl(JSON.parse(s))}catch{}},[]);
  const save=useCallback(list=>{setWl(list);try{localStorage.setItem("eq_watchlist",JSON.stringify(list))}catch{}},[]);
  const add=useCallback(stock=>{save(prev=>{const n=[stock,...prev.filter(s=>s.ticker!==stock.ticker)].slice(0,20);localStorage.setItem("eq_watchlist",JSON.stringify(n));return n});setWl(prev=>{const n=[stock,...prev.filter(s=>s.ticker!==stock.ticker)].slice(0,20);try{localStorage.setItem("eq_watchlist",JSON.stringify(n))}catch{}return n})},[]);
  const remove=useCallback(ticker=>{setWl(prev=>{const n=prev.filter(s=>s.ticker!==ticker);try{localStorage.setItem("eq_watchlist",JSON.stringify(n))}catch{}return n})},[]);
  const has=useCallback(ticker=>wl.some(s=>s.ticker===ticker),[wl]);
  return{wl,add,remove,has}}

// ═══════ MAIN PAGE ═══════
export default function Home(){
  const[query,setQuery]=useState("");const[loading,setLoading]=useState(false);const[msg,setMsg]=useState("");const[result,setResult]=useState(null);const[error,setError]=useState(null);const[recent,setRecent]=useState([]);const[tab,setTab]=useState("overview");const[showWL,setShowWL]=useState(false);
  const{wl,add:addWL,remove:removeWL,has:hasWL}=useWatchlist();
  const msgs=["Fetching live price...","Pulling fundamentals...","Computing indicators...","Detecting patterns...","Building analysis..."];
  useEffect(()=>{if(!loading)return;let i=0;setMsg(msgs[0]);const iv=setInterval(()=>{i=(i+1)%msgs.length;setMsg(msgs[i])},1500);return()=>clearInterval(iv)},[loading]);

  const analyse=useCallback(async name=>{
    if(!name.trim())return;setLoading(true);setError(null);setResult(null);setTab("overview");
    const t=name.trim();setRecent(p=>[t,...p.filter(s=>s.toLowerCase()!==t.toLowerCase())].slice(0,8));
    try{
      // Parallel fetch: Yahoo Finance + Gemini
      const[quoteRes,aiRes]=await Promise.allSettled([
        fetch("/api/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({stockQuery:t})}),
        fetch("/api/analyse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({stockQuery:t})})
      ]);
      let quote=null,ai=null;
      if(quoteRes.status==="fulfilled"&&quoteRes.value.ok)quote=await quoteRes.value.json();
      if(aiRes.status==="fulfilled"&&aiRes.value.ok)ai=await aiRes.value.json();
      else if(aiRes.status==="fulfilled"){const err=await aiRes.value.json();throw new Error(err.error||"AI analysis failed")}
      else throw new Error("Analysis request failed");

      const candles=quote?.candles||[];
      const prices=candles.map(c=>c.close);const highs=candles.map(c=>c.high);const lows=candles.map(c=>c.low);const opens=candles.map(c=>c.open);const vols=candles.map(c=>c.volume);
      const cp=quote?.currentPrice||candles[candles.length-1]?.close||0;
      const prevClose=quote?.previousClose||0;const dayChg=prevClose?((cp-prevClose)/prevClose*100):0;

      // Compute indicators
      const rsi=calcRSI(prices);const macd=calcMACD(prices);const bb=calcBB(prices);const atr=calcATR(highs,lows,prices);const stoch=calcStoch(highs,lows,prices);const wr=calcWR(highs,lows,prices);const cci=calcCCI(highs,lows,prices);const mfi=calcMFI(highs,lows,prices,vols);const adx=calcADX(highs,lows,prices);const st=calcSuperTrend(highs,lows,prices);const psar=calcPSAR(highs,lows,prices);const vwap=calcVWAP(highs,lows,prices,vols);const obv=calcOBV(prices,vols);
      const s20=smaV(prices,20),s50=smaV(prices,50),s100=smaV(prices,100),s200=ai?.sma200||null;
      const e9=lastEma(prices,9),e12=lastEma(prices,12),e21=lastEma(prices,21),e26=lastEma(prices,26),e50=lastEma(prices,50);
      const rv=vols.length>=5?vols.slice(-5).reduce((a,b)=>a+b,0)/5:null;const av=vols.length>=20?vols.slice(-20).reduce((a,b)=>a+b,0)/20:null;const vr=rv&&av?rv/av:null;
      const w52H=quote?.fiftyTwoWeekHigh||Math.max(...highs);const w52L=quote?.fiftyTwoWeekLow||Math.min(...lows);
      const fib=calcFib(w52H,w52L);const piv=quote?.dayHigh?calcPivots(quote.dayHigh,quote.dayLow||lows[lows.length-1],prevClose||prices[prices.length-2]):null;

      // Build indicator list
      const inds=[];
      if(rsi!=null)inds.push({name:"RSI (14)",value:rsi.toFixed(2),signal:rsi<30?"Oversold":rsi<40?"Bullish":rsi>70?"Overbought":rsi>60?"Bearish":"Neutral",detail:rsi<30?"Reversal zone":rsi>70?"Correction zone":"Normal"});
      if(macd.macd!=null)inds.push({name:"MACD",value:macd.macd.toFixed(2),signal:macd.histogram>0?"Bullish":"Bearish",detail:`Sig:${macd.signal?.toFixed(2)} Hist:${macd.histogram?.toFixed(2)}`});
      if(bb)inds.push({name:"Bollinger",value:`${((cp-bb.lower)/(bb.upper-bb.lower)*100).toFixed(0)}%`,signal:cp<bb.lower?"Oversold":cp>bb.upper?"Overbought":"Neutral",detail:`U:₹${bb.upper.toFixed(0)} M:₹${bb.middle.toFixed(0)} L:₹${bb.lower.toFixed(0)}`});
      if(stoch!=null)inds.push({name:"Stochastic",value:stoch.toFixed(2),signal:stoch<20?"Oversold":stoch>80?"Overbought":stoch<40?"Bullish":stoch>60?"Bearish":"Neutral",detail:"K-value"});
      if(wr!=null)inds.push({name:"Williams %R",value:wr.toFixed(2),signal:wr<-80?"Oversold":wr>-20?"Overbought":"Neutral",detail:""});
      if(cci!=null)inds.push({name:"CCI",value:cci.toFixed(2),signal:cci<-100?"Oversold":cci>100?"Overbought":cci>0?"Bullish":"Bearish",detail:""});
      if(mfi!=null)inds.push({name:"MFI",value:mfi.toFixed(2),signal:mfi<20?"Oversold":mfi>80?"Overbought":mfi>50?"Bullish":"Bearish",detail:"Volume-weighted RSI"});
      if(atr&&cp)inds.push({name:"ATR",value:`₹${atr.toFixed(2)}`,signal:(atr/cp*100)>3?"High Volatility":(atr/cp*100)<1.5?"Low Volatility":"Neutral",detail:`${(atr/cp*100).toFixed(2)}% of price`});
      if(adx)inds.push({name:"ADX",value:adx.adx.toFixed(2),signal:adx.plusDI>adx.minusDI?"Bullish":"Bearish",detail:`+DI:${adx.plusDI.toFixed(1)} -DI:${adx.minusDI.toFixed(1)} ${adx.adx>25?"Strong":"Weak"}`});
      if(st)inds.push({name:"SuperTrend",value:st.trend,signal:st.trend,detail:`U:₹${st.upper.toFixed(0)} L:₹${st.lower.toFixed(0)}`});
      if(psar)inds.push({name:"Parabolic SAR",value:`₹${psar.sar.toFixed(2)}`,signal:psar.trend,detail:`SAR ${psar.trend==="Bullish"?"below":"above"} price`});
      if(vwap)inds.push({name:"VWAP",value:`₹${vwap.toFixed(2)}`,signal:cp>vwap?"Bullish":"Bearish",detail:`Price ${cp>vwap?"above":"below"}`});
      if(obv!=null)inds.push({name:"OBV",value:obv>1e6?`${(obv/1e6).toFixed(1)}M`:obv>1e3?`${(obv/1e3).toFixed(0)}K`:`${obv}`,signal:obv>0?"Bullish":"Bearish",detail:"Cumulative volume flow"});
      [[s20,"SMA 20"],[s50,"SMA 50"],[s100,"SMA 100"],[s200,"SMA 200"]].forEach(([v,n])=>{if(v&&cp)inds.push({name:n,value:`₹${v.toFixed(2)}`,signal:cp>v?"Bullish":"Bearish",detail:`${((cp/v-1)*100).toFixed(1)}% ${cp>v?"above":"below"}`})});
      [[e9,"EMA 9"],[e12,"EMA 12"],[e21,"EMA 21"],[e50,"EMA 50"]].forEach(([v,n])=>{if(v&&cp)inds.push({name:n,value:`₹${v.toFixed(2)}`,signal:cp>v?"Bullish":"Bearish",detail:`${((cp/v-1)*100).toFixed(1)}%`})});
      if(s50&&s200)inds.push({name:s50>s200?"Golden Cross":"Death Cross",value:"Active",signal:s50>s200?"Bullish":"Bearish",detail:`SMA50 ${s50>s200?"above":"below"} SMA200`});
      if(vr)inds.push({name:"Vol Ratio",value:`${vr.toFixed(2)}x`,signal:vr>1.5?"Bullish":vr<.7?"Bearish":"Neutral",detail:vr>1.5?"High participation":"Normal"});

      const candlePat=detectCandles(opens,highs,lows,prices);const chartPat=detectCharts(prices,highs,lows);const smcSig=detectSMC(opens,highs,lows,prices);
      const strategies=genStrategies({rsi,macdH:macd.histogram,stoch,adx,superTrend:st,bb,cp,sma20:s20,sma50:s50,volRatio:vr,w52H,w52L});

      // Scores
      let ts=0,tc=0;inds.forEach(ind=>{tc++;if(["Bullish","Buy","Strong Buy","Oversold"].includes(ind.signal))ts++;else if(["Bearish","Sell","Strong Sell","Overbought"].includes(ind.signal))ts--});
      const tP=tc>0?(ts/tc)*100:0;
      let fs=0,fc=0;
      if(ai?.pe!=null){fs+=ai.pe<15?1:ai.pe<25?.3:ai.pe>40?-1:-.3;fc++}
      if(ai?.roe!=null){fs+=ai.roe>20?1:ai.roe>12?.5:-.5;fc++}
      if(ai?.debtToEquity!=null){fs+=ai.debtToEquity<.5?1:ai.debtToEquity<1?.3:-.8;fc++}
      if(ai?.profitGrowthYoY!=null){fs+=ai.profitGrowthYoY>20?1:ai.profitGrowthYoY>0?.3:-.8;fc++}
      if(ai?.revenueGrowthYoY!=null){fs+=ai.revenueGrowthYoY>15?1:ai.revenueGrowthYoY>5?.3:-.5;fc++}
      if(ai?.operatingMargin!=null){fs+=ai.operatingMargin>20?1:ai.operatingMargin>10?.3:-.5;fc++}
      if(ai?.promoterHolding!=null){fs+=ai.promoterHolding>60?1:ai.promoterHolding>40?.3:-.3;fc++}
      const fP=fc>0?(fs/fc)*100:0;const comp=tP*.4+fP*.6;
      let verdict,vCol;if(comp>40){verdict="STRONG BUY";vCol="#00e676"}else if(comp>15){verdict="BUY";vCol="#69f0ae"}else if(comp>-15){verdict="HOLD";vCol="#ffc400"}else if(comp>-40){verdict="SELL";vCol="#ff6e40"}else{verdict="STRONG SELL";vCol="#ff1744"}

      const pio=piotroski(ai||{});const gn=ai?.grahamNumber||graham(ai?.eps,ai?.bookValue);

      setResult({...ai,currentPrice:cp,dayChange:dayChg,dayHigh:quote?.dayHigh||highs[highs.length-1],dayLow:quote?.dayLow||lows[lows.length-1],open:quote?.open||opens[opens.length-1],prevClose,fiftyTwoWeekHigh:w52H,fiftyTwoWeekLow:w52L,volume:quote?.volume||vols[vols.length-1],candles,indicators:inds,candlePat,chartPat,smcSig,strategies,techScore:tP,fundScore:fP,compositeScore:comp,verdict,verdictColor:vCol,piotroski:pio,graham:gn,fib,pivot:piv,sma20:s20,sma50:s50,volumeRatio:vr,yahooTicker:quote?.ticker,dataSource:quote?"Yahoo Finance + Gemini AI":"Gemini AI"});
    }catch(err){setError(err.message)}finally{setLoading(false)}
  },[]);

  const fm=(v,d=2)=>v!=null?Number(v).toFixed(d):"—";const fp=v=>v!=null?`${Number(v)>=0?"+":""}${Number(v).toFixed(2)}%`:"—";
  const r=result;
  const tabList=[{id:"overview",l:"Overview"},{id:"chart",l:"Chart"},{id:"technical",l:"Technical"},{id:"patterns",l:"Patterns"},{id:"smc",l:"SMC"},{id:"strategies",l:"Strategies"},{id:"fundamentals",l:"Fundamentals"},{id:"levels",l:"Levels"},{id:"news",l:"News"},{id:"links",l:"Research"}];

  return(<>
    <Head><title>Equity Analysis Terminal V3</title><meta name="viewport" content="width=device-width,initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/></Head>
    <style jsx global>{`*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0e17;color:#e0e6f0;font-family:'DM Sans',-apple-system,sans-serif}::selection{background:#00e67640}input::placeholder{color:rgba(255,255,255,0.25)}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.fi{animation:fadeIn .4s ease-out both}`}</style>

    <div style={{minHeight:"100vh"}}>
      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#0d1321,#111827,#0f1729)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"16px 24px"}}>
        <div style={{maxWidth:1280,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:30,height:30,borderRadius:7,background:"linear-gradient(135deg,#00e676,#00bfa5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#0a0e17"}}>₹</div>
              <div><h1 style={{fontSize:17,fontWeight:700,color:"#fff"}}>Equity Analysis Terminal <span style={{fontSize:10,color:"#00e676",fontFamily:"monospace"}}>V3</span></h1><p style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>LIVE PRICES · 25+ INDICATORS · PATTERNS · SMC · STRATEGIES</p></div>
            </div>
            <button onClick={()=>setShowWL(!showWL)} style={{padding:"6px 14px",borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:showWL?"rgba(0,230,118,0.1)":"rgba(255,255,255,0.03)",color:showWL?"#00e676":"rgba(255,255,255,0.5)",fontSize:11,fontWeight:600,cursor:"pointer"}}>★ Watchlist ({wl.length})</button>
          </div>
          {/* Watchlist panel */}
          {showWL&&<div style={{...CS.card,marginBottom:10}}><ST color="#ffc400">WATCHLIST</ST>{wl.length===0?<p style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Empty. Analyse a stock and click ★ to add.</p>:
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{wl.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)"}}><button onClick={()=>{setQuery(s.name);analyse(s.name)}} style={{background:"none",border:"none",color:"#fff",fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>{s.ticker}</button><span style={{fontSize:10,color:s.verdict?.includes("BUY")?"#00e676":s.verdict?.includes("SELL")?"#ff1744":"#ffc400"}}>{s.verdict}</span><button onClick={()=>removeWL(s.ticker)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:10,cursor:"pointer"}}>✕</button></div>)}</div>}</div>}
          <form onSubmit={e=>{e.preventDefault();analyse(query)}} style={{display:"flex",gap:8}}>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Stock name or ticker..." style={{flex:1,padding:"10px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:13,outline:"none",fontFamily:"monospace"}} onFocus={e=>e.target.style.borderColor="#00e676"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}/>
            <button type="submit" disabled={loading||!query.trim()} style={{padding:"10px 24px",borderRadius:8,border:"none",background:loading?"rgba(255,255,255,0.1)":"linear-gradient(135deg,#00e676,#00bfa5)",color:loading?"rgba(255,255,255,0.4)":"#0a0e17",fontSize:13,fontWeight:700,cursor:loading?"not-allowed":"pointer",whiteSpace:"nowrap"}}>{loading?"Analysing...":"Analyse →"}</button>
          </form>
          {recent.length>0&&<div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>{recent.map((s,i)=><button key={i} onClick={()=>{setQuery(s);analyse(s)}} style={{padding:"3px 8px",borderRadius:5,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.5)",fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>{s}</button>)}</div>}
        </div>
      </div>

      {loading&&<div style={{maxWidth:1280,margin:"50px auto",textAlign:"center",padding:"0 24px"}}><div style={{width:40,height:40,border:"3px solid rgba(255,255,255,0.06)",borderTopColor:"#00e676",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/><p style={{color:"#00e676",fontSize:13,fontFamily:"monospace"}}>{msg}</p></div>}
      {error&&<div style={{maxWidth:1280,margin:"30px auto",padding:"0 24px"}}><div style={{background:"rgba(255,23,68,0.08)",border:"1px solid rgba(255,23,68,0.2)",borderRadius:10,padding:"16px 20px"}}><p style={{color:"#ff1744",fontSize:13}}>⚠ {error}</p></div></div>}

      {r&&<div className="fi" style={{maxWidth:1280,margin:"0 auto",padding:"20px 24px"}}>
        {/* STOCK HEADER */}
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:12}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}><h2 style={{fontSize:22,fontWeight:800,color:"#fff"}}>{r.stockName||r.ticker}</h2>
            <button onClick={()=>{if(hasWL(r.ticker))removeWL(r.ticker);else addWL({ticker:r.ticker,name:r.stockName,verdict:r.verdict})}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:hasWL(r.ticker)?"#ffc400":"rgba(255,255,255,0.2)"}}>{hasWL(r.ticker)?"★":"☆"}</button></div>
            <p style={{marginTop:3,fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>{r.ticker} · {r.exchange} · {r.sector}</p>
            {r.dataSource&&<p style={{fontSize:9,color:"rgba(0,230,118,0.5)",fontFamily:"monospace",marginTop:2}}>Data: {r.dataSource}</p>}
          </div>
          <div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>₹{fm(r.currentPrice)}</div><div style={{fontSize:13,fontWeight:600,fontFamily:"monospace",color:r.dayChange>=0?"#00e676":"#ff1744"}}>{fp(r.dayChange)} today</div></div>
        </div>

        {/* VERDICT */}
        <div style={{background:`linear-gradient(135deg,${r.verdictColor}15,${r.verdictColor}08)`,border:`1px solid ${r.verdictColor}30`,borderRadius:12,padding:"14px 22px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",fontFamily:"monospace"}}>AI COMPOSITE VERDICT</div><div style={{fontSize:22,fontWeight:900,color:r.verdictColor}}>{r.verdict}</div></div>
          <div style={{display:"flex",gap:16}}><Gauge value={r.techScore} label="Technical" color={r.techScore>20?"#00e676":r.techScore<-20?"#ff1744":"#ffc400"}/><Gauge value={r.fundScore} label="Fundamental" color={r.fundScore>20?"#00e676":r.fundScore<-20?"#ff1744":"#ffc400"}/><Gauge value={r.compositeScore} label="Composite" color={r.verdictColor}/></div>
        </div>
        <div style={{...CS.card,marginBottom:14}}><SB score={r.techScore} label="Technical"/><SB score={r.fundScore} label="Fundamental"/><SB score={r.compositeScore} label="Composite"/></div>

        {/* TABS */}
        <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap",overflowX:"auto"}}>{tabList.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid "+(tab===t.id?"#00e676":"rgba(255,255,255,0.08)"),background:tab===t.id?"rgba(0,230,118,0.1)":"rgba(255,255,255,0.02)",color:tab===t.id?"#00e676":"rgba(255,255,255,0.5)",fontSize:10,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{t.l}</button>)}</div>

        {/* OVERVIEW */}
        {tab==="overview"&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:14}}>
          <div style={CS.card}><ST>MARKET DATA</ST>{[["Price",`₹${fm(r.currentPrice)}`],["Open",`₹${fm(r.open)}`],["High",`₹${fm(r.dayHigh)}`],["Low",`₹${fm(r.dayLow)}`],["Prev Close",`₹${fm(r.prevClose)}`],["Volume",r.volume?Number(r.volume).toLocaleString("en-IN"):"—"],["52W H",`₹${fm(r.fiftyTwoWeekHigh)}`],["52W L",`₹${fm(r.fiftyTwoWeekLow)}`],["Mkt Cap",r.marketCapLabel||"—"],["Beta",fm(r.beta)]].map(([k,v],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={CS.rv}>{v}</span></div>)}</div>
          <div style={CS.card}><ST>BUSINESS</ST>{r.businessDescription&&<p style={{fontSize:12,color:"rgba(255,255,255,0.6)",lineHeight:1.6,marginBottom:10}}>{r.businessDescription}</p>}{r.competitiveAdvantage&&<p style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>🏰 <strong style={{color:"rgba(255,255,255,0.7)"}}>Moat:</strong> {r.competitiveAdvantage}</p>}</div>
        </div>
        {(r.promoterHolding!=null)&&<div style={{...CS.card,marginBottom:14}}><ST>SHAREHOLDING</ST><div style={{display:"flex",gap:0,height:22,borderRadius:5,overflow:"hidden",marginBottom:10}}>{[{l:"Promoter",v:r.promoterHolding,c:"#00e676"},{l:"FII",v:r.fiiHolding,c:"#448aff"},{l:"DII",v:r.diiHolding,c:"#ffc400"},{l:"Public",v:r.publicHolding,c:"#ff6e40"}].filter(x=>x.v!=null).map((x,i)=><div key={i} style={{width:`${x.v}%`,background:x.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#0a0e17",fontFamily:"monospace"}}>{x.v>8?`${x.v.toFixed(1)}%`:""}</div>)}</div><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{[{l:"Promoter",v:r.promoterHolding,c:"#00e676",ch:r.promoterHoldingChange},{l:"FII",v:r.fiiHolding,c:"#448aff",ch:r.fiiHoldingChange},{l:"DII",v:r.diiHolding,c:"#ffc400",ch:r.diiHoldingChange},{l:"Public",v:r.publicHolding,c:"#ff6e40"}].filter(x=>x.v!=null).map((x,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:7,height:7,borderRadius:2,background:x.c}}/><span style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{x.l}:{x.v.toFixed(1)}%{x.ch!=null?` (${x.ch>0?"+":""}${x.ch.toFixed(1)}%)`:""}</span></div>)}</div></div>}</>}

        {/* CHART */}
        {tab==="chart"&&<div style={{...CS.card,marginBottom:14,overflowX:"auto"}}><ST>CANDLESTICK CHART (3 MONTHS) + EMA 20</ST><CandlestickChart candles={r.candles} width={Math.min(900,typeof window!=="undefined"?window.innerWidth-80:700)} height={340}/></div>}

        {/* TECHNICAL */}
        {tab==="technical"&&<div style={{...CS.card,marginBottom:14}}><ST count={r.indicators.length}>ALL TECHNICAL INDICATORS</ST><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>{r.indicators.map((ind,i)=><IC key={i} ind={ind}/>)}</div></div>}

        {/* PATTERNS */}
        {tab==="patterns"&&<><div style={{...CS.card,marginBottom:14}}><ST color="#ffc400" count={r.candlePat.length}>CANDLESTICK PATTERNS</ST>{r.candlePat.length===0?<p style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>No patterns detected</p>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>{r.candlePat.map((p,i)=><IC key={i} ind={p}/>)}</div>}</div>
        <div style={{...CS.card,marginBottom:14}}><ST color="#448aff" count={r.chartPat.length}>CHART PATTERNS</ST>{r.chartPat.length===0?<p style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>No patterns detected</p>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>{r.chartPat.map((p,i)=><IC key={i} ind={p}/>)}</div>}</div></>}

        {/* SMC */}
        {tab==="smc"&&<div style={{...CS.card,marginBottom:14}}><ST color="#e040fb" count={r.smcSig.length}>SMART MONEY CONCEPTS</ST>{r.smcSig.length===0?<p style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>No SMC signals</p>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:8}}>{r.smcSig.map((s,i)=><IC key={i} ind={s}/>)}</div>}</div>}

        {/* STRATEGIES */}
        {tab==="strategies"&&<div style={{...CS.card,marginBottom:14}}><ST color="#00bcd4">TRADING STRATEGIES</ST><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:8}}>{r.strategies.map((s,i)=><IC key={i} ind={s}/>)}</div></div>}

        {/* FUNDAMENTALS */}
        {tab==="fundamentals"&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:12,marginBottom:14}}>
          <div style={CS.card}><ST>VALUATION</ST>{[["P/E",fm(r.pe),r.pe?(r.pe<15?"#00e676":r.pe>40?"#ff1744":"#ffc400"):null],["Fwd P/E",fm(r.forwardPe)],["P/B",fm(r.pb)],["EV/EBITDA",fm(r.evToEbitda)],["EPS",`₹${fm(r.eps)}`],["PEG",fm(r.peg)],["Div Yield",fp(r.dividendYield)],["Graham",r.graham?`₹${fm(r.graham)}`:"—"],["Target",r.analystTargetPrice?`₹${fm(r.analystTargetPrice)}`:"—"]].map(([k,v,c],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={{...CS.rv,color:c||"#fff"}}>{v}</span></div>)}</div>
          <div style={CS.card}><ST>PROFITABILITY</ST>{[["ROE",fp(r.roe),r.roe?(r.roe>20?"#00e676":r.roe<10?"#ff1744":"#ffc400"):null],["ROCE",fp(r.roce)],["D/E",fm(r.debtToEquity),r.debtToEquity?(r.debtToEquity<.5?"#00e676":r.debtToEquity>1?"#ff1744":"#ffc400"):null],["Op Margin",fp(r.operatingMargin)],["Net Margin",fp(r.netMargin)],["Current Ratio",fm(r.currentRatio)],["FCF Yield",fp(r.freeCashFlowYield)]].map(([k,v,c],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={{...CS.rv,color:c||"#fff"}}>{v}</span></div>)}</div>
          <div style={CS.card}><ST>GROWTH</ST>{[["Rev YoY",fp(r.revenueGrowthYoY)],["Rev 3Y",fp(r.revenueGrowth3Y)],["Sales 5Y",fp(r.salesGrowth5Y)],["Profit YoY",fp(r.profitGrowthYoY)],["Profit 3Y",fp(r.profitGrowth3Y)],["Profit 5Y",fp(r.profitGrowth5Y)]].map(([k,v],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={CS.rv}>{v}</span></div>)}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:14}}>
          <div style={{...CS.card,borderLeft:`3px solid ${r.piotroski>=7?"#00e676":r.piotroski>=4?"#ffc400":"#ff1744"}`}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>PIOTROSKI F-SCORE</div><div style={{fontSize:26,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{r.piotroski}/9</div><div style={{fontSize:10,color:r.piotroski>=7?"#00e676":r.piotroski>=4?"#ffc400":"#ff1744"}}>{r.piotroski>=7?"Strong":r.piotroski>=4?"Average":"Weak"}</div></div>
          {r.managementQuality&&<div style={CS.card}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>MANAGEMENT</div><p style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6}}>{r.managementQuality}</p></div>}
        </div>
        {r.peerComparison?.length>0&&<div style={{...CS.card,marginBottom:14}}><ST>PEERS</ST>{r.peerComparison.map((p,i)=><div key={i} style={CS.rw}><span style={CS.rk}>{p.name}</span><span style={{...CS.rv,fontSize:10}}>P/E:{fm(p.pe)} ROE:{fm(p.roe)}%</span></div>)}</div>}</>}

        {/* LEVELS */}
        {tab==="levels"&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:14}}>
          {r.fib&&<div style={CS.card}><ST color="#e040fb">FIBONACCI (52W)</ST>{[["0% High",r.fib.l0],["23.6%",r.fib.l236],["38.2%",r.fib.l382],["50%",r.fib.l500],["61.8%",r.fib.l618],["78.6%",r.fib.l786],["100% Low",r.fib.l100]].map(([k,v],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={{...CS.rv,color:Math.abs(r.currentPrice-v)/r.currentPrice<.02?"#ffc400":"#fff"}}>₹{v.toFixed(2)}{Math.abs(r.currentPrice-v)/r.currentPrice<.02?" ← Near":""}</span></div>)}</div>}
          {r.pivot&&<div style={CS.card}><ST color="#00bcd4">PIVOT POINTS</ST>{[["R3",r.pivot.r3],["R2",r.pivot.r2],["R1",r.pivot.r1],["Pivot",r.pivot.pp],["S1",r.pivot.s1],["S2",r.pivot.s2],["S3",r.pivot.s3]].map(([k,v],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={CS.rv}>₹{v.toFixed(2)}</span></div>)}</div>}
        </div></>}

        {/* NEWS */}
        {tab==="news"&&<>{r.recentNews?.length>0&&<div style={{...CS.card,marginBottom:14}}><ST count={r.recentNews.length}>LATEST NEWS</ST>{r.recentNews.map((n,i)=>{const nw=typeof n==="string"?{headline:n}:n;return<div key={i} style={{padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>{nw.sentiment&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:nw.sentiment==="positive"?"rgba(0,230,118,0.15)":nw.sentiment==="negative"?"rgba(255,23,68,0.15)":"rgba(255,196,0,0.15)",color:nw.sentiment==="positive"?"#00e676":nw.sentiment==="negative"?"#ff1744":"#ffc400"}}>{nw.sentiment}</span>}{nw.source&&<span style={{fontSize:9,color:"rgba(255,255,255,0.35)",fontFamily:"monospace"}}>{nw.source}</span>}{nw.date&&<span style={{fontSize:9,color:"rgba(255,255,255,0.25)",fontFamily:"monospace"}}>{nw.date}</span>}</div><p style={{fontSize:12,color:"rgba(255,255,255,0.8)",fontWeight:600,lineHeight:1.4}}>{nw.headline}</p>{nw.summary&&<p style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:3,lineHeight:1.5}}>{nw.summary}</p>}</div>})}</div>}
        {r.smartMoneySignals&&<div style={{...CS.card,background:"rgba(68,138,255,0.04)",borderColor:"rgba(68,138,255,0.15)",marginBottom:14}}><ST color="#448aff">SMART MONEY ACTIVITY</ST><p style={{fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.6}}>{r.smartMoneySignals}</p></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          {r.keyRisks?.length>0&&<div style={{...CS.card,background:"rgba(255,23,68,0.04)",borderColor:"rgba(255,23,68,0.12)"}}><ST color="#ff1744">RISKS</ST>{r.keyRisks.map((x,i)=><div key={i} style={{padding:"3px 0",fontSize:12,color:"rgba(255,255,255,0.6)"}}><span style={{color:"#ff1744",marginRight:5}}>✕</span>{x}</div>)}</div>}
          {r.keyCatalysts?.length>0&&<div style={{...CS.card,background:"rgba(0,230,118,0.04)",borderColor:"rgba(0,230,118,0.12)"}}><ST color="#00e676">CATALYSTS</ST>{r.keyCatalysts.map((x,i)=><div key={i} style={{padding:"3px 0",fontSize:12,color:"rgba(255,255,255,0.6)"}}><span style={{color:"#00e676",marginRight:5}}>✦</span>{x}</div>)}</div>}
        </div></>}

        {/* RESEARCH LINKS */}
        {tab==="links"&&<div style={{...CS.card,marginBottom:14}}><ST color="#e040fb">RESEARCH & ANALYST REPORTS</ST><p style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5}}>Deep-dive into {r.stockName} on these platforms for detailed financials, analyst reports, corporate filings, and peer analysis:</p><AnalystLinks ticker={r.yahooTicker||r.ticker} name={r.stockName}/></div>}

        {/* ANALYST + DISCLAIMER */}
        {r.analystConsensus&&<div style={{...CS.card,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}><div><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>CONSENSUS </span><span style={{fontSize:13,fontWeight:700,color:sc(["Strong Buy","Buy"].includes(r.analystConsensus)?"Bullish":["Sell","Strong Sell"].includes(r.analystConsensus)?"Bearish":"Neutral")}}>{r.analystConsensus}{r.analystCount?` (${r.analystCount})`:""}</span></div>{r.analystTargetPrice&&r.currentPrice&&<div><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>TARGET </span><span style={{fontSize:15,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>₹{fm(r.analystTargetPrice)}</span><span style={{marginLeft:6,fontSize:11,fontWeight:600,fontFamily:"monospace",color:r.analystTargetPrice>r.currentPrice?"#00e676":"#ff1744"}}>({((r.analystTargetPrice/r.currentPrice-1)*100).toFixed(1)}%)</span></div>}</div>}
        <div style={{background:"rgba(255,196,0,0.04)",border:"1px solid rgba(255,196,0,0.1)",borderRadius:8,padding:"10px 14px",marginBottom:24}}><p style={{fontSize:9,color:"rgba(255,255,255,0.3)",lineHeight:1.6}}>⚠ <strong>Disclaimer:</strong> AI-generated analysis. NOT financial advice. Consult a SEBI-registered advisor.</p></div>
      </div>}

      {/* EMPTY STATE */}
      {!loading&&!r&&!error&&<div style={{maxWidth:1280,margin:"0 auto",padding:"50px 24px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:12,opacity:.15}}>📊</div><p style={{color:"rgba(255,255,255,0.3)",fontSize:13,maxWidth:420,margin:"0 auto",lineHeight:1.7}}>Live prices via Yahoo Finance + AI analysis with 25+ indicators, candlestick & chart patterns, SMC, strategies, and research links.</p><div style={{display:"flex",gap:6,justifyContent:"center",marginTop:20,flexWrap:"wrap"}}>{["Reliance","TCS","HDFC Bank","Infosys","ITC","SBI","Tata Motors","Bajaj Finance"].map(s=><button key={s} onClick={()=>{setQuery(s);analyse(s)}} style={{padding:"6px 14px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.5)",fontSize:11,cursor:"pointer"}} onMouseEnter={e=>{e.target.style.borderColor="#00e676";e.target.style.color="#00e676"}} onMouseLeave={e=>{e.target.style.borderColor="rgba(255,255,255,0.08)";e.target.style.color="rgba(255,255,255,0.5)"}}>{s}</button>)}</div></div>}
    </div>
  </>)}
