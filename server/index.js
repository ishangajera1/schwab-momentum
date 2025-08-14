import express from "express";
import fetch from "node-fetch";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const {
  SCHWAB_CLIENT_ID,
  SCHWAB_CLIENT_SECRET,
  SCHWAB_REDIRECT_URI,
  SCHWAB_REFRESH_TOKEN,
  PORT = process.env.PORT || 10000,
} = process.env;

let cachedAccessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiry - 15000) {
    return cachedAccessToken;
  }

  const res = await fetch("https://api.schwabapi.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${SCHWAB_CLIENT_ID}:${SCHWAB_CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: SCHWAB_REFRESH_TOKEN,
      client_id: SCHWAB_CLIENT_ID,
      redirect_uri: SCHWAB_REDIRECT_URI,
    }),
  });

  if (!res.ok) throw new Error("Token refresh failed");
  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in ?? 1700) * 1000;
  return cachedAccessToken;
}

async function schwabGet(pathname, params) {
  const token = await getAccessToken();
  const url = new URL(`https://api.schwabapi.com${pathname}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Schwab API error: ${res.status}`);
  return res.json();
}

function calcAvg(candles, n) {
  const slice = candles.slice(-n);
  const avgClose = slice.reduce((sum, c) => sum + (c.close ?? 0), 0) / slice.length;
  const avgVol = slice.reduce((sum, c) => sum + (c.volume ?? 0), 0) / slice.length;
  return { avgClose, avgVol };
}

app.get("/api/metrics", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    const quotes = await schwabGet("/marketdata/v1/quotes", { symbols: symbol });
    const q = quotes[symbol] || {};
    const todayPrice = q.lastPrice ?? q.mark;
    const todayVolume = q.totalVolume ?? q.volume;

    const history = await schwabGet("/marketdata/v1/pricehistory", {
      symbol,
      periodType: "day",
      period: "30",
      frequencyType: "daily",
      frequency: "1",
    });

    const candles = history.candles ?? [];
    const metrics = [10, 20, 30].map(n => {
      const { avgClose, avgVol } = calcAvg(candles, n);
      return {
        days: n,
        avgClose,
        avgVol,
        priceRatio: todayPrice / avgClose,
        volumeRatio: todayVolume / avgVol,
      };
    });

    res.json({ symbol, todayPrice, todayVolume, metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// serve frontend
const __dirnameResolved = path.resolve();
app.use(express.static(path.join(__dirnameResolved, "web", "dist")));
app.get("*", (_, r) => r.sendFile(path.join(__dirnameResolved, "web", "dist", "index.html")));

app.listen(PORT, () => console.log(`Server on ${PORT}`));
