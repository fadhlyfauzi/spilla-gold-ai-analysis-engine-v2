# SPILLA GOLD Analysis Engine v3.6.2

Institutional Multi-Factor XAU/USD (Gold) Quantitative Terminal powered by Google Gemini 3.6 Flash.

---

## 🏛️ System Architecture

```text
Collectors (14 Data Streams)
       │
       ▼
Analysis Engine (Multi-Timeframe & Macro Correlation)
       │
       ▼
Scoring Engine (Fundamental, Technical, Sentiment, Risk)
       │
       ▼
AI Engine (Gemini 3.6 Flash Synced Reasoning)
       │
       ▼
Recommendation Engine (Entry, SL, TP1, TP2, R:R Optimization)
       │
       ▼
Express REST API (/api/dashboard, /api/health, etc.)
       │
       ▼
React 19 Terminal Workstation Interface
```

---

## 📡 REST API Specification

The backend exposes clean REST endpoints consumed directly by the React workstation:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Railway deployment health check |
| `/api/dashboard` | `GET` | Aggregated dashboard summary & live scores |
| `/api/fundamental` | `GET` | Macro data (Fed rates, CPI, TIPS real yields, DXY, GDP) |
| `/api/technical` | `GET` | Technical indicators (RSI, MACD, EMAs, Pivots, ATR) |
| `/api/sentiment` | `GET` | COT net long positions, ETF flows, retail ratio |
| `/api/risk` | `GET` | Risk score, volatility, spread, event proximity |
| `/api/recommendation` | `GET` | Full trade setup with AI reasoning summary |
| `/api/history` | `GET` | Historical analysis log and trade performance records |
| `/api/news` | `GET` | Realtime breaking gold and macroeconomic news stream |
| `/api/calendar` | `GET` | High-impact economic calendar events |
| `/api/system` | `GET` | System diagnostics, uptime, and collector status |

---

## 🚀 Railway Deployment Guide

### Step 1: Connect Repository to Railway
1. Push this repository to GitHub or connect directly in **Railway** (`railway.app`).
2. Click **New Project** -> **Deploy from GitHub repo**.

### Step 2: Provision PostgreSQL Database (Optional but Recommended)
1. In your Railway project, click **+ New** -> **Database** -> **PostgreSQL**.
2. Railway will automatically set the `DATABASE_URL` variable in your service.

### Step 3: Configure Environment Variables
In Railway -> Service Settings -> **Variables**, set:

```env
PORT=3000
NODE_ENV=production
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### Step 4: Deploy
Railway will automatically detect the `Dockerfile` and `railway.json`, execute:
1. `npm ci`
2. `npx prisma generate`
3. `npm run build`
4. Automated database schema sync via `prisma db push`
5. Launch `node dist/server.cjs` on `0.0.0.0:${PORT}`

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Production build and test run
npm run build
npm start
```

---

## 🛡️ License & Compliance

Institutional Gold Quantitative Workstation - SPILLA GOLD Engine © 2026.
