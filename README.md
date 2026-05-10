# Equity Analysis Terminal

AI-powered comprehensive stock analysis for all BSE and NSE listed equities.  
**Powered by Google Gemini 2.0 Flash (FREE tier) with Google Search grounding.**

## What It Does

Enter any Indian stock name or ticker and get:
- **Live price data** pulled via Google Search grounding in real-time
- **10 technical indicators**: RSI, MACD, Bollinger Bands, Stochastic, ATR, SMA 20/50/200, Volume Ratio, 52-week range
- **Fundamental metrics**: P/E, P/B, EPS, PEG, ROE, ROCE, D/E, margins, growth rates, FCF yield
- **Shareholding pattern**: Promoter, FII, DII, Public — with visual bar
- **Smart Money signals**: Bulk deals, insider activity, institutional flows
- **Recent news headlines**
- **Key risks and catalysts**
- **AI Composite Verdict**: Strong Buy → Strong Sell with Technical (45%) + Fundamental (55%) scoring

---

## Deploy to Vercel (5 minutes, completely FREE)

### Prerequisites
1. A **GitHub account** — [Sign up free](https://github.com/join)
2. A **Vercel account** — [Sign up free](https://vercel.com/signup) (connect with GitHub)
3. A **Google Gemini API key (FREE)** — [Get one here](https://aistudio.google.com/app/apikey)

### How to get your FREE Gemini API key

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Select any Google Cloud project (or create one — it's free)
5. Copy the key — it starts with `AIzaSy...`

**Free tier limits (more than enough for personal use):**
- 15 requests per minute
- 1,000,000 tokens per day
- 1,500 requests per day
- No credit card required

### Step-by-Step Deployment

#### 1. Push code to GitHub

Create a new repo on GitHub (e.g. `stock-terminal`), then:

```bash
cd stock-terminal
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stock-terminal.git
git push -u origin main
```

#### 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your `stock-terminal` repo
4. Under **Environment Variables**, add:
   - Name: `GEMINI_API_KEY`
   - Value: your API key from above (starts with `AIzaSy...`)
5. Click **Deploy**

That's it. Vercel builds it in ~60 seconds and gives you a live URL like:
```
https://stock-terminal-abc123.vercel.app
```

Share that link with anyone — they just open it and start analysing stocks. No API key needed on their end.

#### 3. Custom domain (optional)

In Vercel dashboard → Settings → Domains → Add your own domain like `stocks.yourdomain.com`.

---

## Run Locally (for development)

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/stock-terminal.git
cd stock-terminal

# Install dependencies
npm install

# Set your API key
cp .env.example .env.local
# Edit .env.local and paste your Gemini API key

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

```
stock-terminal/
├── pages/
│   ├── index.js          ← Frontend UI (Next.js React page)
│   └── api/
│       └── analyse.js    ← Secure backend (Gemini API — key stays on server)
├── package.json
├── next.config.js
├── .env.example
├── .gitignore
└── README.md
```

- **Frontend** (`pages/index.js`): Full analysis dashboard — search, indicators, charts, verdicts.
- **Backend** (`pages/api/analyse.js`): Server-side proxy that calls Google Gemini with Search grounding. Your API key never reaches the browser.

---

## Cost

**$0.** Everything is free:
- Vercel hosting: Free tier (100GB bandwidth/month)
- Google Gemini API: Free tier (1,500 requests/day)
- No credit card required anywhere

---

## Disclaimer

This tool is for informational and educational purposes only. It does NOT constitute financial or investment advice. Always consult a SEBI-registered financial advisor before making investment decisions.
