import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

// ═══ INDICATORS ═══
function smaV(a,p){if(a.length<p)return null;return a.slice(-p).reduce((s,v)=>s+v,0)/p}
function emaArr(a,p){if(a.length<p)return[];const k=2/(p+1);let e=a.slice(0,p).reduce((s,v)=>s+v,0)/p;const r=[e];for(let i=p;i<a.length;i++){e=a[i]*k+e*(1-k);r.push(e)}return r}
function lastEma(a,p){const e=emaArr(a,p);return e.length?e[e.length-1]:null}
function calcRSI(p,n=14){if(p.length<n+1)return null;let g=0,l=0;for(let i=1;i<=n;i++){const d=p[i]-p[i-1];d>0?g+=d:l-=d}g/=n;l/=n;return l===0?100:100-100/(1+g/l)}
function calcMACD(p){const e12=emaArr(p,12),e26=emaArr(p,26);if(!e12.length||!e26.length)return{macd:null,signal:null,histogram:null};const o=e12.length-e26.length;const ml=e26.map((v,i)=>e12[i+o]-v);const sl=emaArr(ml,9);const m=ml[ml.length-1],s=sl.length?sl[sl.length-1]:null;return{macd:m,signal:s,histogram:s!=null?m-s:null}}
function calcBB(p,n=20){if(p.length<n)return null;const s=p.slice(-n),m=s.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(s.reduce((a,b)=>a+(b-m)**2,0)/n);return{upper:m+2*sd,middle:m,lower:m-2*sd}}
function calcATR(h,l,c,n=14){if(c.length<n+1)return null;let a=0;for(let i=1;i<=n;i++)a+=Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1]));return a/n}
function calcStoch(h,l,c,n=14){if(c.length<n)return null;const hh=Math.max(...h.slice(-n)),ll=Math.min(...l.slice(-n));return hh===ll?50:((c[c.length-1]-ll)/(hh-ll))*100}
function calcWR(h,l,c,n=14){if(c.length<n)return null;const hh=Math.max(...h.slice(-n)),ll=Math.min(...l.slice(-n));return hh===ll?-50:((hh-c[c.length-1])/(hh-ll))*-100}
function calcCCI(h,l,c,n=20){if(c.length<n)return null;const tp=c.slice(-n).map((v,i)=>(h[h.length-n+i]+l[l.length-n+i]+v)/3);const m=tp.reduce((a,b)=>a+b,0)/n;const md=tp.reduce((a,b)=>a+Math.abs(b-m),0)/n;return md===0?0:(tp[tp.length-1]-m)/(.015*md)}
function calcMFI(h,l,c,v,n=14){if(c.length<n+1)return null;let pf=0,nf=0;for(let i=c.length-n;i<c.length;i++){const tp=(h[i]+l[i]+c[i])/3,pt=(h[i-1]+l[i-1]+c[i-1])/3;tp>pt?pf+=tp*v[i]:nf+=tp*v[i]}return nf===0?100:100-100/(1+pf/nf)}
function calcADX(h,l,c,n=14){if(c.length<n*2)return null;let pd=0,nd=0,tr=0;for(let i=1;i<=n;i++){const u=h[i]-h[i-1],d=l[i-1]-l[i];pd+=u>d&&u>0?u:0;nd+=d>u&&d>0?d:0;tr+=Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1]))}const pi=(pd/tr)*100,ni=(nd/tr)*100;return{adx:Math.abs(pi-ni)/(pi+ni)*100,plusDI:pi,minusDI:ni}}
function calcSuperTrend(h,l,c){const a=calcATR(h,l,c);if(!a)return null;const cp=c[c.length-1];const bu=(h[h.length-1]+l[l.length-1])/2+3*a;const bl=(h[h.length-1]+l[l.length-1])/2-3*a;return{trend:cp>bu?"Bearish":"Bullish",upper:bu,lower:bl}}
function calcPSAR(h,l){if(h.length<5)return null;let af=.02,ep,sar,bull=true;sar=l[0];ep=h[0];for(let i=1;i<h.length;i++){sar+=af*(ep-sar);if(bull){if(h[i]>ep){ep=h[i];af=Math.min(af+.02,.2)}if(l[i]<sar){bull=false;sar=ep;ep=l[i];af=.02}}else{if(l[i]<ep){ep=l[i];af=Math.min(af+.02,.2)}if(h[i]>sar){bull=true;sar=ep;ep=h[i];af=.02}}}return{sar,trend:bull?"Bullish":"Bearish"}}
function calcVWAP(h,l,c,v){if(c.length<5)return null;let cv=0,ct=0;for(let i=0;i<c.length;i++){cv+=((h[i]+l[i]+c[i])/3)*v[i];ct+=v[i]}return ct===0?null:cv/ct}
function calcOBV(c,v){if(c.length<2)return null;let o=0;for(let i=1;i<c.length;i++)o+=c[i]>c[i-1]?v[i]:c[i]<c[i-1]?-v[i]:0;return o}
function calcFib(hi,lo){const d=hi-lo;return{l0:hi,l236:hi-.236*d,l382:hi-.382*d,l500:hi-.5*d,l618:hi-.618*d,l100:lo}}
function calcPivots(h,l,c){const pp=(h+l+c)/3;return{pp,r1:2*pp-l,r2:pp+(h-l),s1:2*pp-h,s2:pp-(h-l)}}

// ═══ CANDLESTICK PATTERNS ═══
function detectCandles(o,h,l,c){const n=c.length;if(n<3)return[];const ps=[];const i=n-1;const body=Math.abs(c[i]-o[i]),rng=h[i]-l[i],uw=h[i]-Math.max(o[i],c[i]),lw=Math.min(o[i],c[i])-l[i];const pb=n>1?Math.abs(c[i-1]-o[i-1]):0;const bull=c[i]>o[i],pB=n>1?c[i-1]>o[i-1]:false;
if(body<rng*.1&&rng>0)ps.push({name:"Doji",signal:"Neutral",detail:"Indecision"});
if(lw>body*2&&uw<body*.5&&!pB&&body>0)ps.push({name:"Hammer",signal:"Bullish",detail:"Bottom reversal"});
if(uw>body*2&&lw<body*.5&&pB&&body>0)ps.push({name:"Shooting Star",signal:"Bearish",detail:"Top reversal"});
if(n>1&&bull&&!pB&&body>pb)ps.push({name:"Bullish Engulfing",signal:"Bullish",detail:"Strong reversal"});
if(n>1&&!bull&&pB&&body>pb)ps.push({name:"Bearish Engulfing",signal:"Bearish",detail:"Strong reversal"});
if(body>rng*.9&&rng>0)ps.push({name:bull?"Bull Marubozu":"Bear Marubozu",signal:bull?"Bullish":"Bearish",detail:"Strong momentum"});
if(n>2&&c[i]>o[i]&&c[i-1]>o[i-1]&&c[i-2]>o[i-2]&&c[i]>c[i-1])ps.push({name:"3 White Soldiers",signal:"Bullish",detail:"Continuation"});
if(n>2&&c[i]<o[i]&&c[i-1]<o[i-1]&&c[i-2]<o[i-2]&&c[i]<c[i-1])ps.push({name:"3 Black Crows",signal:"Bearish",detail:"Continuation"});
return ps}

// ═══ SMC ═══
function detectSMC(o,h,l,c){const n=c.length;if(n<10)return[];const s=[];
const pH=Math.max(...h.slice(-10,-2)),pL=Math.min(...l.slice(-10,-2));
if(c[n-1]>pH)s.push({name:"BOS ↑",signal:"Bullish",detail:`Broke ₹${pH.toFixed(0)}`});
if(c[n-1]<pL)s.push({name:"BOS ↓",signal:"Bearish",detail:`Broke ₹${pL.toFixed(0)}`});
if(n>2&&l[n-1]-h[n-3]>0)s.push({name:"Bullish FVG",signal:"Bullish",detail:"Gap support"});
if(n>2&&l[n-3]-h[n-1]>0)s.push({name:"Bearish FVG",signal:"Bearish",detail:"Gap resistance"});
return s.slice(0,4)}

// ═══ STRATEGIES ═══
function genStrats(rsi,macdH,stoch,adx,st,bb,cp,s20,s50,vr,w52H,w52L){const r=[];
r.push({name:"Momentum",signal:rsi>50&&rsi<70&&macdH>0?"Buy":rsi<50&&macdH<0?"Sell":"Neutral",detail:"RSI+MACD"});
r.push({name:"Trend",signal:cp>s20&&s20>s50&&adx?.adx>25?"Buy":cp<s20&&s20<s50?"Sell":"Neutral",detail:"MA+ADX"});
if(bb)r.push({name:"Mean Rev",signal:cp<bb.lower?"Buy":cp>bb.upper?"Sell":"Neutral",detail:"BB extreme"});
r.push({name:"Breakout",signal:w52H&&cp>w52H*.97&&vr>1.3?"Buy":"Neutral",detail:"52W+Vol"});
r.push({name:"Swing",signal:rsi<35&&stoch<25?"Buy":rsi>65&&stoch>75?"Sell":"Neutral",detail:"Oscillators"});
return r}

// ═══ CHART ═══
function CandleChart({data,w=700,ht=300}){
  if(!data||data.length<5)return null;
  const cH=ht*.7,cw=Math.max(2,Math.min(7,(w-40)/data.length-1));
  const mn=Math.min(...data.map(d=>d.l)),mx=Math.max(...data.map(d=>d.h)),pr=mx-mn||1;
  const maxV=Math.max(...data.map(d=>d.v))||1;
  const yP=v=>15+(1-(v-mn)/pr)*(cH-20);
  return<svg width={w} height={ht} style={{display:"block"}}>{data.map((d,i)=>{const x=30+i*(cw+1);const bull=d.c>=d.o;const col=bull?"#00e676":"#ff1744";const bT=yP(Math.max(d.o,d.c)),bB=yP(Math.min(d.o,d.c));
  return<g key={i}><line x1={x+cw/2} x2={x+cw/2} y1={yP(d.h)} y2={yP(d.l)} stroke={col} strokeWidth="1"/><rect x={x} y={bT} width={cw} height={Math.max(1,bB-bT)} fill={col}/><rect x={x} y={cH+5} width={cw} height={Math.max(1,(d.v/maxV)*(ht*.22))} fill={col} opacity=".3"/></g>})}</svg>}

// ═══ UI ═══
const CS={card:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"20px 24px"},lb:{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:12,fontFamily:"monospace",letterSpacing:"0.05em"},rw:{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"},rk:{fontSize:12,color:"rgba(255,255,255,0.45)"},rv:{fontSize:12,color:"#fff",fontFamily:"monospace",fontWeight:600}};
function sc(s){return["Bullish","Buy","Strong Buy","Oversold"].includes(s)?"#00e676":["Bearish","Sell","Strong Sell","Overbought"].includes(s)?"#ff1744":"#ffc400"}
function Gauge({value,label,color}){const p=Math.min(Math.max((value+100)/200,0),1);return<div style={{textAlign:"center"}}><svg width="80" height="50" viewBox="0 0 80 50"><path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round"/><path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${p*100} 200`}/><text x="40" y="40" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="monospace">{value?.toFixed(0)}</text></svg><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:-4}}>{label}</div></div>}
function SB({score,label}){const c=Math.min(Math.max(score,-100),100),col=c>30?"#00e676":c<-30?"#ff1744":"#ffc400";return<div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}><span style={{color:"rgba(255,255,255,0.6)"}}>{label}</span><span style={{color:col,fontWeight:700,fontFamily:"monospace"}}>{c>0?"+":""}{c.toFixed(0)}</span></div><div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,position:"relative"}}><div style={{position:"absolute",left:"50%",width:1,height:4,background:"rgba(255,255,255,0.15)"}}/><div style={{position:"absolute",left:c>=0?"50%":`${(c+100)/2}%`,width:`${Math.abs(c)/2}%`,height:4,borderRadius:2,background:col,transition:"all 0.6s"}}/></div></div>}
function IC({ind}){return<div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,padding:"12px 14px",borderLeft:`3px solid ${sc(ind.signal)}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{ind.name}</span><span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:`${sc(ind.signal)}18`,color:sc(ind.signal),fontWeight:700,fontFamily:"monospace"}}>{ind.signal}</span></div><div style={{fontSize:16,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{ind.value}</div>{ind.detail&&<div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:3}}>{ind.detail}</div>}</div>}
function Spark({data,w=260,ht=55,color="#00e676"}){if(!data||data.length<2)return null;const mn=Math.min(...data),mx=Math.max(...data),r=mx-mn||1;const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${ht-((v-mn)/r)*ht}`).join(" ");return<svg width={w} height={ht} style={{display:"block"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/></svg>}

// ═══ LINKS ═══
function Links({ticker,name}){const t=(ticker||"").replace(".NS","").replace(".BO","");
return<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>{[["Screener",`https://www.screener.in/company/${t}/`,"#4caf50"],["Trendlyne",`https://trendlyne.com/equity/${t}/`,"#2196f3"],["Tickertape",`https://www.tickertape.in/stocks/${t}`,"#ff9800"],["MoneyControl",`https://www.moneycontrol.com/india/stockpricequote/${(name||"").toLowerCase().replace(/\s+/g,"-")}/${t}`,"#e91e63"],["NSE",`https://www.nseindia.com/get-quotes/equity?symbol=${t}`,"#00bcd4"],["TijoriFinance",`https://www.tijorifinance.com/company/${(name||"").toLowerCase().replace(/\s+/g,"-")}`,"#9c27b0"]].map(([l,u,c],i)=><a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{padding:"4px 10px",borderRadius:5,border:`1px solid ${c}40`,background:`${c}10`,color:c,fontSize:10,fontWeight:600,textDecoration:"none"}}>{l} ↗</a>)}</div>}

// ═══ WATCHLIST ═══
function useWL(){const[wl,setWl]=useState([]);
useEffect(()=>{try{const s=localStorage.getItem("eq_wl");if(s)setWl(JSON.parse(s))}catch{}},[]);
const add=useCallback(s=>{setWl(p=>{const n=[s,...p.filter(x=>x.t!==s.t)].slice(0,20);try{localStorage.setItem("eq_wl",JSON.stringify(n))}catch{}return n})},[]);
const rm=useCallback(t=>{setWl(p=>{const n=p.filter(x=>x.t!==t);try{localStorage.setItem("eq_wl",JSON.stringify(n))}catch{}return n})},[]);
const has=useCallback(t=>wl.some(x=>x.t===t),[wl]);return{wl,add,rm,has}}

// ═══ MAIN ═══
export default function Home(){
  const[query,setQuery]=useState("");const[loading,setLoading]=useState(false);const[msg,setMsg]=useState("");const[result,setResult]=useState(null);const[error,setError]=useState(null);const[recent,setRecent]=useState([]);
  const{wl,add:addWL,rm:rmWL,has:hasWL}=useWL();const[showWL,setShowWL]=useState(false);const[showChart,setShowChart]=useState(false);
  const ms=["Scanning markets...","Computing indicators...","Detecting patterns...","Analysing fundamentals...","Building verdict..."];
  useEffect(()=>{if(!loading)return;let i=0;setMsg(ms[0]);const iv=setInterval(()=>{i=(i+1)%ms.length;setMsg(ms[i])},1500);return()=>clearInterval(iv)},[loading]);

  const analyse=useCallback(async name=>{
    if(!name.trim())return;setLoading(true);setError(null);setResult(null);setShowChart(false);
    const t=name.trim();setRecent(p=>[t,...p.filter(s=>s.toLowerCase()!==t.toLowerCase())].slice(0,8));
    try{
      // Fetch Gemini (primary) + Yahoo (optional overlay)
      const[aiRes,yRes]=await Promise.allSettled([
        fetch("/api/analyse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({stockQuery:t})}),
        fetch("/api/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({stockQuery:t})})
      ]);
      let d=null,yq=null;
      if(aiRes.status==="fulfilled"&&aiRes.value.ok)d=await aiRes.value.json();
      else if(aiRes.status==="fulfilled"){const e=await aiRes.value.json();throw new Error(e.error||"Failed")}
      else throw new Error("Network error");
      if(yRes.status==="fulfilled"&&yRes.value.ok)yq=await yRes.value.json();

      // Use Yahoo live price if available, else Gemini
      const cp=yq?.currentPrice||d.currentPrice;const prevCl=yq?.previousClose||d.prevClose;
      const dayChg=prevCl?((cp-prevCl)/prevCl*100):(d.dayChange||0);
      const w52H=yq?.fiftyTwoWeekHigh||d.fiftyTwoWeekHigh;const w52L=yq?.fiftyTwoWeekLow||d.fiftyTwoWeekLow;

      // Historical data: prefer Yahoo candles, fallback to Gemini
      let prices,highs,lows,opens,vols,chartData=null;
      if(yq?.candles?.length>10){
        const cn=yq.candles;prices=cn.map(c=>c.close);highs=cn.map(c=>c.high);lows=cn.map(c=>c.low);opens=cn.map(c=>c.open);vols=cn.map(c=>c.volume);
        chartData=cn.map(c=>({o:c.open,h:c.high,l:c.low,c:c.close,v:c.volume}));
      } else {
        prices=d.historicalPrices||[];highs=d.historicalHighs||prices.map(p=>p*1.01);lows=d.historicalLows||prices.map(p=>p*.99);opens=d.historicalOpens||prices.map((p,i)=>i>0?prices[i-1]:p);vols=d.historicalVolumes||[];
        if(prices.length>5)chartData=prices.map((p,i)=>({o:opens[i],h:highs[i],l:lows[i],c:p,v:vols[i]||0}));
      }

      // ── COMPUTE ALL INDICATORS ──
      const rsi=calcRSI(prices);const macd=calcMACD(prices);const bb=calcBB(prices);const atr=calcATR(highs,lows,prices);const stoch=calcStoch(highs,lows,prices);const wr=calcWR(highs,lows,prices);const cci=calcCCI(highs,lows,prices);const mfi=calcMFI(highs,lows,prices,vols);const adx=calcADX(highs,lows,prices);const superT=calcSuperTrend(highs,lows,prices);const psar=calcPSAR(highs,lows);const vwap=calcVWAP(highs,lows,prices,vols);const obv=calcOBV(prices,vols);
      const s20=d.sma20||smaV(prices,20),s50=d.sma50||smaV(prices,50),s200=d.sma200||null;
      const e9=lastEma(prices,9),e12=lastEma(prices,12),e21=lastEma(prices,21),e50=lastEma(prices,50);
      const rv=vols.length>=5?vols.slice(-5).reduce((a,b)=>a+b,0)/5:null;const av=vols.length>=20?vols.slice(-20).reduce((a,b)=>a+b,0)/20:null;const vr=rv&&av?rv/av:null;
      const fib=w52H&&w52L?calcFib(w52H,w52L):null;
      const piv=d.dayHigh?calcPivots(d.dayHigh,d.dayLow,d.prevClose):null;

      // Build ALL indicator cards
      const inds=[];
      if(rsi!=null)inds.push({name:"RSI (14)",value:rsi.toFixed(2),signal:rsi<30?"Oversold":rsi<40?"Bullish":rsi>70?"Overbought":rsi>60?"Bearish":"Neutral",detail:rsi<30?"Reversal zone":rsi>70?"Correction":"Normal"});
      if(macd.macd!=null)inds.push({name:"MACD",value:macd.macd.toFixed(2),signal:macd.histogram>0?"Bullish":"Bearish",detail:`Sig:${macd.signal?.toFixed(2)} H:${macd.histogram?.toFixed(2)}`});
      if(bb&&cp){const pos=((cp-bb.lower)/(bb.upper-bb.lower)*100);inds.push({name:"Bollinger",value:`${pos.toFixed(0)}%`,signal:cp<bb.lower?"Oversold":cp>bb.upper?"Overbought":"Neutral",detail:`U:₹${bb.upper.toFixed(0)} M:₹${bb.middle.toFixed(0)} L:₹${bb.lower.toFixed(0)}`})}
      if(stoch!=null)inds.push({name:"Stochastic",value:stoch.toFixed(2),signal:stoch<20?"Oversold":stoch>80?"Overbought":stoch<40?"Bullish":"Neutral",detail:""});
      if(wr!=null)inds.push({name:"Williams %R",value:wr.toFixed(2),signal:wr<-80?"Oversold":wr>-20?"Overbought":"Neutral",detail:""});
      if(cci!=null)inds.push({name:"CCI",value:cci.toFixed(2),signal:cci<-100?"Oversold":cci>100?"Overbought":cci>0?"Bullish":"Bearish",detail:""});
      if(mfi!=null)inds.push({name:"MFI",value:mfi.toFixed(2),signal:mfi<20?"Oversold":mfi>80?"Overbought":mfi>50?"Bullish":"Bearish",detail:"Vol-weighted RSI"});
      if(atr&&cp)inds.push({name:"ATR",value:`₹${atr.toFixed(2)}`,signal:(atr/cp*100)>3?"High Volatility":"Neutral",detail:`${(atr/cp*100).toFixed(2)}%`});
      if(adx)inds.push({name:"ADX",value:adx.adx.toFixed(2),signal:adx.plusDI>adx.minusDI?"Bullish":"Bearish",detail:`+DI:${adx.plusDI.toFixed(1)} -DI:${adx.minusDI.toFixed(1)} ${adx.adx>25?"Strong":"Weak"}`});
      if(superT)inds.push({name:"SuperTrend",value:superT.trend,signal:superT.trend,detail:`U:₹${superT.upper.toFixed(0)} L:₹${superT.lower.toFixed(0)}`});
      if(psar)inds.push({name:"Parabolic SAR",value:`₹${psar.sar.toFixed(2)}`,signal:psar.trend,detail:""});
      if(vwap&&cp)inds.push({name:"VWAP",value:`₹${vwap.toFixed(2)}`,signal:cp>vwap?"Bullish":"Bearish",detail:""});
      if(obv!=null)inds.push({name:"OBV",value:obv>1e6?`${(obv/1e6).toFixed(1)}M`:`${(obv/1e3).toFixed(0)}K`,signal:obv>0?"Bullish":"Bearish",detail:"Volume flow"});
      // MAs
      [[s20,"SMA 20"],[s50,"SMA 50"],[s200,"SMA 200"]].forEach(([v,n])=>{if(v&&cp)inds.push({name:n,value:`₹${v.toFixed(2)}`,signal:cp>v?"Bullish":"Bearish",detail:`${((cp/v-1)*100).toFixed(1)}% ${cp>v?"above":"below"}`})});
      [[e9,"EMA 9"],[e12,"EMA 12"],[e21,"EMA 21"],[e50,"EMA 50"]].forEach(([v,n])=>{if(v&&cp)inds.push({name:n,value:`₹${v.toFixed(2)}`,signal:cp>v?"Bullish":"Bearish",detail:`${((cp/v-1)*100).toFixed(1)}%`})});
      if(s50&&s200)inds.push({name:s50>s200?"Golden Cross":"Death Cross",value:"Active",signal:s50>s200?"Bullish":"Bearish",detail:"SMA50 vs SMA200"});
      if(vr)inds.push({name:"Vol Ratio",value:`${vr.toFixed(2)}x`,signal:vr>1.5?"Bullish":vr<.7?"Bearish":"Neutral",detail:""});
      if(w52H&&w52L&&cp){const pos=((cp-w52L)/(w52H-w52L))*100;inds.push({name:"52W Range",value:`${pos.toFixed(0)}%`,signal:pos>80?"Overbought":pos<20?"Oversold":pos>50?"Bullish":"Bearish",detail:`L:₹${w52L.toFixed(0)} H:₹${w52H.toFixed(0)}`})}

      // Patterns
      const candlePat=detectCandles(opens,highs,lows,prices);const smcSig=detectSMC(opens,highs,lows,prices);
      const strats=genStrats(rsi,macd.histogram,stoch,adx,superT,bb,cp,s20,s50,vr,w52H,w52L);

      // Scores
      let ts=0,tc=0;inds.forEach(ind=>{tc++;if(["Bullish","Buy","Strong Buy","Oversold"].includes(ind.signal))ts++;else if(["Bearish","Sell","Strong Sell","Overbought"].includes(ind.signal))ts--});
      const tP=tc>0?(ts/tc)*100:0;
      let fs=0,fc=0;
      if(d.pe!=null){fs+=d.pe<15?1:d.pe<25?.3:d.pe>40?-1:-.3;fc++}if(d.roe!=null){fs+=d.roe>20?1:d.roe>12?.5:-.5;fc++}if(d.debtToEquity!=null){fs+=d.debtToEquity<.5?1:d.debtToEquity<1?.3:-.8;fc++}if(d.profitGrowthYoY!=null){fs+=d.profitGrowthYoY>20?1:d.profitGrowthYoY>0?.3:-.8;fc++}if(d.revenueGrowthYoY!=null){fs+=d.revenueGrowthYoY>15?1:d.revenueGrowthYoY>5?.3:-.5;fc++}if(d.operatingMargin!=null){fs+=d.operatingMargin>20?1:d.operatingMargin>10?.3:-.5;fc++}if(d.promoterHolding!=null){fs+=d.promoterHolding>60?1:d.promoterHolding>40?.3:-.3;fc++}
      const fP=fc>0?(fs/fc)*100:0;const comp=tP*.4+fP*.6;
      let verdict,vCol;if(comp>40){verdict="STRONG BUY";vCol="#00e676"}else if(comp>15){verdict="BUY";vCol="#69f0ae"}else if(comp>-15){verdict="HOLD";vCol="#ffc400"}else if(comp>-40){verdict="SELL";vCol="#ff6e40"}else{verdict="STRONG SELL";vCol="#ff1744"}

      const pio=(()=>{let s=0;if(d.netMargin>0)s++;if(d.roa>0)s++;if(d.freeCashFlow>0)s++;if(d.profitGrowthYoY>0)s++;if(d.currentRatio>1)s++;if(d.debtToEquity<1)s++;if(d.revenueGrowthYoY>0)s++;if(d.roe>10)s++;return s})();
      const gn=d.grahamNumber||(d.eps>0&&d.bookValue>0?Math.sqrt(22.5*d.eps*d.bookValue):null);

      setResult({...d,currentPrice:cp,dayChange:dayChg,fiftyTwoWeekHigh:w52H,fiftyTwoWeekLow:w52L,indicators:inds,candlePat,smcSig,strategies:strats,techScore:tP,fundScore:fP,compositeScore:comp,verdict,verdictColor:vCol,piotroski:pio,graham:gn,fib,pivot:piv,chartData,dataSource:yq?"Yahoo Finance + Gemini":"Gemini AI"});
    }catch(err){setError(err.message)}finally{setLoading(false)}
  },[]);

  const fm=(v,d=2)=>v!=null?Number(v).toFixed(d):"—";const fp=v=>v!=null?`${Number(v)>=0?"+":""}${Number(v).toFixed(2)}%`:"—";
  const r=result;

  return(<>
    <Head><title>Equity Analysis Terminal V3</title><meta name="viewport" content="width=device-width,initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/></Head>
    <style jsx global>{`*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0e17;color:#e0e6f0;font-family:'DM Sans',-apple-system,sans-serif}input::placeholder{color:rgba(255,255,255,0.25)}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fi{from{opacity:0;transform:translateY(10px)}to{opacity:1}}.fi{animation:fi .4s ease-out}`}</style>

    <div style={{minHeight:"100vh"}}>
      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#0d1321,#111827)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"16px 24px"}}>
        <div style={{maxWidth:1280,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#00e676,#00bfa5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#0a0e17"}}>₹</div>
              <div><h1 style={{fontSize:16,fontWeight:700,color:"#fff"}}>Equity Analysis Terminal <span style={{fontSize:9,color:"#00e676",fontFamily:"monospace"}}>V3</span></h1></div>
            </div>
            <button onClick={()=>setShowWL(!showWL)} style={{padding:"5px 12px",borderRadius:5,border:"1px solid rgba(255,255,255,0.1)",background:showWL?"rgba(0,230,118,0.1)":"transparent",color:showWL?"#00e676":"rgba(255,255,255,0.5)",fontSize:10,cursor:"pointer"}}>★ Watchlist ({wl.length})</button>
          </div>
          {showWL&&wl.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>{wl.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:5,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)"}}><button onClick={()=>{setQuery(s.n);analyse(s.n)}} style={{background:"none",border:"none",color:"#fff",fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>{s.t}</button><span style={{fontSize:9,color:s.v?.includes("BUY")?"#00e676":"#ffc400"}}>{s.v}</span><button onClick={()=>rmWL(s.t)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:9,cursor:"pointer"}}>✕</button></div>)}</div>}
          <form onSubmit={e=>{e.preventDefault();analyse(query)}} style={{display:"flex",gap:8}}>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Stock name or ticker..." style={{flex:1,padding:"10px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:13,outline:"none",fontFamily:"monospace"}} onFocus={e=>e.target.style.borderColor="#00e676"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}/>
            <button type="submit" disabled={loading||!query.trim()} style={{padding:"10px 22px",borderRadius:8,border:"none",background:loading?"rgba(255,255,255,0.1)":"linear-gradient(135deg,#00e676,#00bfa5)",color:loading?"rgba(255,255,255,0.4)":"#0a0e17",fontSize:13,fontWeight:700,cursor:loading?"not-allowed":"pointer"}}>{loading?"Analysing...":"Analyse →"}</button>
          </form>
          {recent.length>0&&<div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>{recent.map((s,i)=><button key={i} onClick={()=>{setQuery(s);analyse(s)}} style={{padding:"2px 7px",borderRadius:4,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.02)",color:"rgba(255,255,255,0.4)",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>{s}</button>)}</div>}
        </div>
      </div>

      {loading&&<div style={{textAlign:"center",padding:"50px 24px"}}><div style={{width:36,height:36,border:"3px solid rgba(255,255,255,0.06)",borderTopColor:"#00e676",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 14px"}}/><p style={{color:"#00e676",fontSize:12,fontFamily:"monospace"}}>{msg}</p></div>}
      {error&&<div style={{maxWidth:1280,margin:"30px auto",padding:"0 24px"}}><div style={{background:"rgba(255,23,68,0.08)",border:"1px solid rgba(255,23,68,0.2)",borderRadius:10,padding:"14px 18px"}}><p style={{color:"#ff1744",fontSize:12}}>⚠ {error}</p></div></div>}

      {r&&<div className="fi" style={{maxWidth:1280,margin:"0 auto",padding:"20px 24px"}}>
        {/* ── HEADER ── */}
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:12}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:6}}><h2 style={{fontSize:22,fontWeight:800,color:"#fff"}}>{r.stockName||r.ticker}</h2><button onClick={()=>{hasWL(r.ticker)?rmWL(r.ticker):addWL({t:r.ticker,n:r.stockName,v:r.verdict})}} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:hasWL(r.ticker)?"#ffc400":"rgba(255,255,255,0.2)"}}>{hasWL(r.ticker)?"★":"☆"}</button></div>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>{r.ticker} · {r.exchange} · {r.sector} · {r.industry}</p>
            {r.dataSource&&<p style={{fontSize:8,color:"rgba(0,230,118,0.4)",fontFamily:"monospace",marginTop:2}}>Source: {r.dataSource}</p>}
          </div>
          <div style={{textAlign:"right"}}><div style={{fontSize:26,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>₹{fm(r.currentPrice)}</div><div style={{fontSize:12,fontWeight:600,fontFamily:"monospace",color:r.dayChange>=0?"#00e676":"#ff1744"}}>{fp(r.dayChange)} today</div></div>
        </div>

        {/* ── VERDICT ── */}
        <div style={{background:`linear-gradient(135deg,${r.verdictColor}15,${r.verdictColor}08)`,border:`1px solid ${r.verdictColor}30`,borderRadius:12,padding:"14px 22px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
          <div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)",fontFamily:"monospace"}}>AI COMPOSITE VERDICT</div><div style={{fontSize:22,fontWeight:900,color:r.verdictColor}}>{r.verdict}</div></div>
          <div style={{display:"flex",gap:16}}><Gauge value={r.techScore} label="Tech" color={r.techScore>20?"#00e676":r.techScore<-20?"#ff1744":"#ffc400"}/><Gauge value={r.fundScore} label="Fund" color={r.fundScore>20?"#00e676":r.fundScore<-20?"#ff1744":"#ffc400"}/><Gauge value={r.compositeScore} label="Total" color={r.verdictColor}/></div>
        </div>
        <div style={{...CS.card,marginBottom:14}}><SB score={r.techScore} label="Technical"/><SB score={r.fundScore} label="Fundamental"/><SB score={r.compositeScore} label="Composite"/></div>

        {/* ── CHART TOGGLE ── */}
        {r.chartData&&<div style={{marginBottom:14}}><button onClick={()=>setShowChart(!showChart)} style={{padding:"6px 14px",borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:showChart?"rgba(0,230,118,0.1)":"rgba(255,255,255,0.03)",color:showChart?"#00e676":"rgba(255,255,255,0.5)",fontSize:11,cursor:"pointer",marginBottom:8}}>{showChart?"Hide":"Show"} Candlestick Chart</button>
        {showChart&&<div style={{...CS.card,overflowX:"auto"}}><CandleChart data={r.chartData} w={Math.min(900,typeof window!=="undefined"?window.innerWidth-80:700)}/></div>}</div>}

        {/* ── PRICE + MARKET ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:14}}>
          <div style={CS.card}><div style={CS.lb}>PRICE & MARKET</div><Spark data={r.historicalPrices||r.chartData?.map(c=>c.c)} color={r.dayChange>=0?"#00e676":"#ff1744"}/><div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:9,color:"rgba(255,255,255,0.3)",fontFamily:"monospace"}}><span>O:₹{fm(r.open)}</span><span>H:₹{fm(r.dayHigh)}</span><span>L:₹{fm(r.dayLow)}</span><span>PC:₹{fm(r.prevClose)}</span></div>
          {[["52W H",`₹${fm(r.fiftyTwoWeekHigh)}`],["52W L",`₹${fm(r.fiftyTwoWeekLow)}`],["Mkt Cap",r.marketCapLabel||"—"],["Volume",r.volume?Number(r.volume).toLocaleString("en-IN"):"—"],["Beta",fm(r.beta)]].map(([k,v],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={CS.rv}>{v}</span></div>)}</div>

          {/* FUNDAMENTALS */}
          <div style={CS.card}><div style={CS.lb}>FUNDAMENTALS</div>
          {[["P/E",fm(r.pe),r.pe?(r.pe<15?"#00e676":r.pe>40?"#ff1744":"#ffc400"):null],["P/B",fm(r.pb)],["EPS",`₹${fm(r.eps)}`],["ROE",fp(r.roe),r.roe?(r.roe>20?"#00e676":r.roe<10?"#ff1744":"#ffc400"):null],["ROCE",fp(r.roce)],["D/E",fm(r.debtToEquity),r.debtToEquity?(r.debtToEquity<.5?"#00e676":r.debtToEquity>1?"#ff1744":"#ffc400"):null],["Op Margin",fp(r.operatingMargin)],["Net Margin",fp(r.netMargin)],["Div Yield",fp(r.dividendYield)],["PEG",fm(r.peg)]].map(([k,v,c],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={{...CS.rv,color:c||"#fff"}}>{v}</span></div>)}</div>

          {/* GROWTH */}
          <div style={CS.card}><div style={CS.lb}>GROWTH & VALUATION</div>
          {[["Rev YoY",fp(r.revenueGrowthYoY)],["Profit YoY",fp(r.profitGrowthYoY)],["Rev 3Y",fp(r.revenueGrowth3Y)],["Profit 3Y",fp(r.profitGrowth3Y)],["FCF Yield",fp(r.freeCashFlowYield)],["Graham",r.graham?`₹${fm(r.graham)}`:"—"],["Intrinsic",r.intrinsicValueEstimate?`₹${fm(r.intrinsicValueEstimate)}`:"—"],["Target",r.analystTargetPrice?`₹${fm(r.analystTargetPrice)}`:"—"],["Piotroski",`${r.piotroski}/9`],["Current Ratio",fm(r.currentRatio)]].map(([k,v],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={CS.rv}>{v}</span></div>)}</div>
        </div>

        {/* ── ALL TECHNICAL INDICATORS ── */}
        <div style={{...CS.card,marginBottom:14}}><div style={CS.lb}>TECHNICAL INDICATORS ({r.indicators.length})</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>{r.indicators.map((ind,i)=><IC key={i} ind={ind}/>)}</div></div>

        {/* ── STRATEGIES ── */}
        <div style={{...CS.card,marginBottom:14}}><div style={{...CS.lb,color:"#00bcd4"}}>TRADING STRATEGIES</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>{r.strategies.map((s,i)=><IC key={i} ind={s}/>)}</div></div>

        {/* ── PATTERNS + SMC ── */}
        {(r.candlePat.length>0||r.smcSig.length>0)&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12,marginBottom:14}}>
          {r.candlePat.length>0&&<div style={CS.card}><div style={{...CS.lb,color:"#ffc400"}}>CANDLESTICK PATTERNS ({r.candlePat.length})</div><div style={{display:"grid",gap:8}}>{r.candlePat.map((p,i)=><IC key={i} ind={p}/>)}</div></div>}
          {r.smcSig.length>0&&<div style={CS.card}><div style={{...CS.lb,color:"#e040fb"}}>SMART MONEY CONCEPTS ({r.smcSig.length})</div><div style={{display:"grid",gap:8}}>{r.smcSig.map((s,i)=><IC key={i} ind={s}/>)}</div></div>}
        </div>}

        {/* ── SHAREHOLDING ── */}
        {r.promoterHolding!=null&&<div style={{...CS.card,marginBottom:14}}><div style={CS.lb}>SHAREHOLDING</div>
        <div style={{display:"flex",gap:0,height:22,borderRadius:5,overflow:"hidden",marginBottom:10}}>{[{l:"Promoter",v:r.promoterHolding,c:"#00e676"},{l:"FII",v:r.fiiHolding,c:"#448aff"},{l:"DII",v:r.diiHolding,c:"#ffc400"},{l:"Public",v:r.publicHolding,c:"#ff6e40"}].filter(x=>x.v!=null).map((x,i)=><div key={i} style={{width:`${x.v}%`,background:x.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#0a0e17",fontFamily:"monospace"}}>{x.v>8?`${x.v.toFixed(1)}%`:""}</div>)}</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{[{l:"Promoter",v:r.promoterHolding,c:"#00e676",ch:r.promoterHoldingChange},{l:"FII",v:r.fiiHolding,c:"#448aff",ch:r.fiiHoldingChange},{l:"DII",v:r.diiHolding,c:"#ffc400",ch:r.diiHoldingChange},{l:"Public",v:r.publicHolding,c:"#ff6e40"}].filter(x=>x.v!=null).map((x,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:7,height:7,borderRadius:2,background:x.c}}/><span style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{x.l}:{x.v.toFixed(1)}%{x.ch!=null?` (${x.ch>0?"+":""}${x.ch.toFixed(1)}%)`:""}</span></div>)}</div></div>}

        {/* ── NEWS ── */}
        {r.recentNews?.length>0&&<div style={{...CS.card,marginBottom:14}}><div style={CS.lb}>LATEST NEWS ({r.recentNews.length})</div>
        {r.recentNews.map((n,i)=>{const nw=typeof n==="string"?{headline:n}:n;return<div key={i} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>{nw.sentiment&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:nw.sentiment==="positive"?"rgba(0,230,118,0.15)":nw.sentiment==="negative"?"rgba(255,23,68,0.15)":"rgba(255,196,0,0.15)",color:nw.sentiment==="positive"?"#00e676":nw.sentiment==="negative"?"#ff1744":"#ffc400"}}>{nw.sentiment}</span>}{nw.source&&<span style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontFamily:"monospace"}}>{nw.source}</span>}{nw.date&&<span style={{fontSize:8,color:"rgba(255,255,255,0.2)",fontFamily:"monospace"}}>{nw.date}</span>}</div><p style={{fontSize:12,color:"rgba(255,255,255,0.8)",fontWeight:600,lineHeight:1.4}}>{nw.headline}</p>{nw.summary&&<p style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2,lineHeight:1.5}}>{nw.summary}</p>}</div>})}</div>}

        {/* ── SMART MONEY + RISKS/CATALYSTS ── */}
        {r.smartMoneySignals&&<div style={{...CS.card,background:"rgba(68,138,255,0.04)",borderColor:"rgba(68,138,255,0.15)",marginBottom:14}}><div style={{...CS.lb,color:"#448aff"}}>SMART MONEY ACTIVITY</div><p style={{fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.6}}>{r.smartMoneySignals}</p></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          {r.keyRisks?.length>0&&<div style={{...CS.card,background:"rgba(255,23,68,0.04)",borderColor:"rgba(255,23,68,0.12)"}}><div style={{...CS.lb,color:"#ff1744"}}>RISKS</div>{r.keyRisks.map((x,i)=><div key={i} style={{padding:"3px 0",fontSize:11,color:"rgba(255,255,255,0.6)"}}><span style={{color:"#ff1744",marginRight:4}}>✕</span>{x}</div>)}</div>}
          {r.keyCatalysts?.length>0&&<div style={{...CS.card,background:"rgba(0,230,118,0.04)",borderColor:"rgba(0,230,118,0.12)"}}><div style={{...CS.lb,color:"#00e676"}}>CATALYSTS</div>{r.keyCatalysts.map((x,i)=><div key={i} style={{padding:"3px 0",fontSize:11,color:"rgba(255,255,255,0.6)"}}><span style={{color:"#00e676",marginRight:4}}>✦</span>{x}</div>)}</div>}
        </div>

        {/* ── LEVELS ── */}
        {(r.fib||r.pivot)&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:14}}>
          {r.fib&&<div style={CS.card}><div style={{...CS.lb,color:"#e040fb"}}>FIBONACCI (52W)</div>{[["0% High",r.fib.l0],["23.6%",r.fib.l236],["38.2%",r.fib.l382],["50%",r.fib.l500],["61.8%",r.fib.l618],["100% Low",r.fib.l100]].map(([k,v],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={{...CS.rv,color:Math.abs(r.currentPrice-v)/r.currentPrice<.02?"#ffc400":"#fff"}}>₹{v.toFixed(2)}{Math.abs(r.currentPrice-v)/r.currentPrice<.02?" ←":""}</span></div>)}</div>}
          {r.pivot&&<div style={CS.card}><div style={{...CS.lb,color:"#00bcd4"}}>PIVOT POINTS</div>{[["R2",r.pivot.r2],["R1",r.pivot.r1],["Pivot",r.pivot.pp],["S1",r.pivot.s1],["S2",r.pivot.s2]].map(([k,v],i)=><div key={i} style={CS.rw}><span style={CS.rk}>{k}</span><span style={CS.rv}>₹{v.toFixed(2)}</span></div>)}</div>}
        </div>}

        {/* ── PEERS ── */}
        {r.peerComparison?.length>0&&<div style={{...CS.card,marginBottom:14}}><div style={CS.lb}>PEERS</div>{r.peerComparison.map((p,i)=><div key={i} style={CS.rw}><span style={CS.rk}>{p.name}</span><span style={{...CS.rv,fontSize:10}}>P/E:{fm(p.pe)} ROE:{fm(p.roe)}%</span></div>)}</div>}

        {/* ── ANALYST ── */}
        {r.analystConsensus&&<div style={{...CS.card,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}><div><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>CONSENSUS </span><span style={{fontSize:13,fontWeight:700,color:sc(["Strong Buy","Buy"].includes(r.analystConsensus)?"Bullish":"Neutral")}}>{r.analystConsensus}{r.analystCount?` (${r.analystCount})`:""}</span></div>{r.analystTargetPrice&&r.currentPrice&&<div><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>TARGET </span><span style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>₹{fm(r.analystTargetPrice)}</span><span style={{marginLeft:6,fontSize:11,fontFamily:"monospace",color:r.analystTargetPrice>r.currentPrice?"#00e676":"#ff1744"}}>({((r.analystTargetPrice/r.currentPrice-1)*100).toFixed(1)}%)</span></div>}</div>}

        {/* ── RESEARCH LINKS ── */}
        <div style={{...CS.card,marginBottom:14}}><div style={{...CS.lb,color:"#e040fb"}}>RESEARCH & ANALYST REPORTS</div><Links ticker={r.ticker} name={r.stockName}/></div>

        {/* DISCLAIMER */}
        <div style={{background:"rgba(255,196,0,0.04)",border:"1px solid rgba(255,196,0,0.1)",borderRadius:8,padding:"10px 14px",marginBottom:24}}><p style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>⚠ AI-generated. NOT financial advice. Consult SEBI-registered advisor.</p></div>
      </div>}

      {/* EMPTY STATE */}
      {!loading&&!r&&!error&&<div style={{textAlign:"center",padding:"50px 24px"}}><div style={{fontSize:40,marginBottom:12,opacity:.15}}>📊</div><p style={{color:"rgba(255,255,255,0.3)",fontSize:13,maxWidth:420,margin:"0 auto",lineHeight:1.7}}>Live prices + 25+ technical indicators, candlestick patterns, SMC, strategies, fundamentals, news, and research links.</p><div style={{display:"flex",gap:6,justifyContent:"center",marginTop:20,flexWrap:"wrap"}}>{["Reliance","TCS","HDFC Bank","Infosys","ITC","SBI","Tata Motors","Bajaj Finance"].map(s=><button key={s} onClick={()=>{setQuery(s);analyse(s)}} style={{padding:"6px 14px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.5)",fontSize:11,cursor:"pointer"}} onMouseEnter={e=>{e.target.style.borderColor="#00e676";e.target.style.color="#00e676"}} onMouseLeave={e=>{e.target.style.borderColor="rgba(255,255,255,0.08)";e.target.style.color="rgba(255,255,255,0.5)"}}>{s}</button>)}</div></div>}
    </div>
  </>)}
