
// server/index.js
import express from "express";
import fetch from "node-fetch";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

const {
  SCHWAB_CLIENT_ID,
  SCHWAB_CLIENT_SECRET,
  SCHWAB_REDIRECT_URI,
  SCHWAB_REFRESH_TOKEN,
  PORT = 8080,
} = process.env;

if (!SCHWAB_CLIENT_ID || !SCHWAB_CLIENT_SECRET || !SCHWAB_REDIRECT_URI || !SCHWAB_REFRESH_TOKEN) {
  console.error("Missing Schwab OAuth env vars. See .env.example");
  process.exit(1);
}

let cachedAccessToken = null;
let accessTokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && now < accessTokenExpiresAt - 15_000) {
    return cachedAccessToken;
  }

  // OAuth2 token refresh (per Schwab docs)
  // POST https://api.schwabapi.com/v1/oauth/token  (path/name may vary)
  // form: grant_type=refresh_token&refresh_token=...&client_id=...&redirect_uri=...
  const tokenUrl = "https://api.schwabapi.com/v1/oauth/token"; // adjust if your app shows a different host/path
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: SCHWAB_REFRESH_TOKEN,
    client_id: SCHWAB_CLIENT_ID,
    redirect_uri: SCHWAB_REDIRECT_URI,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${SCHWAB_CLIENT_ID}:${SCHWAB_CLIENT_SECRET}`).toString("base64"),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  // access tokens often ~30 minutes; honor returned expires_in if present
  accessTokenExpiresAt = Date.now() + ((data.expires_in ?? 1700) * 1000);
  return cachedAccessToken;
}

// Helpers to hit Market Data endpoints
async function schwabGet(pathname, params) {
  const token = await getAccessToken();
  const url = new URL(`https://api.schwabapi.com${pathname}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${pathname} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

// Compute N-day averages (closes & volume)
function calcAverages(candles, N) {
  const recent = candles.slice(-N);
  const avgClose =
    recent.reduce((sum, c) => sum + (c.close ?? c.closePrice ?? 0), 0) / (recent.length || 1);
  const avgVol = recent.reduce((sum, c) => sum + (c.volume ?? 0), 0) / (recent.length || 1);
  return { avgClose, avgVol };
}

// API: /api/metrics?symbol=AAPL
app.get("/api/metrics", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "").toString().toUpperCase();
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    // 1) Quote (for today's price & volume)
    // Commonly: GET /marketdata/v1/quotes?symbols=AAPL
    const quotes = await schwabGet("/marketdata/v1/quotes", { symbols: symbol });
    const quote = quotes?.[symbol] || quotes?.quotes?.[0] || quotes; // normalize in case response is array/object
    const todayPrice =
      quote?.lastPrice ?? quote?.mark ?? quote?.regularMarketLastPrice ?? quote?.close ?? null;
    const todayVolume = quote?.totalVolume ?? quote?.volume ?? null;

    // 2) Price history (daily candles) – pull 30 days for all calcs
    // Commonly: GET /marketdata/v1/pricehistory?symbol=AAPL&periodType=day&period=30&frequencyType=daily&frequency=1
    const history = await schwabGet("/marketdata/v1/pricehistory", {
      symbol,
      periodType: "day",
      period: 30,
      frequencyType: "daily",
      frequency: 1,
      needExtendedHoursData: false,
    });

    const candles = history?.candles ?? history?.data?.candles ?? [];
    if (!todayPrice || !todayVolume || candles.length === 0) {
      return res.status(502).json({ error: "Incomplete market data", raw: { quotes, history } });
    }

    // Compute 10/20/30-day ratios
    const N = [10, 20, 30].map((n) => {
      const { avgClose, avgVol } = calcAverages(candles, n);
      return {
        window: n,
        avgClose: Number(avgClose.toFixed(4)),
        avgVolume: Math.round(avgVol),
        priceRatio: Number((todayPrice / avgClose).toFixed(4)),
        volumeRatio: Number((todayVolume / avgVol).toFixed(4)),
      };
    });

    res.json({
      symbol,
      todayPrice,
      todayVolume,
      metrics: N,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Serve built frontend on Render (after vite build)
const __dirnameResolved = path.resolve();
const staticDir = path.join(__dirnameResolved, "web", "dist");
app.use(express.static(staticDir));
app.get("*", (_, resp) => resp.sendFile(path.join(staticDir, "index.html")));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
