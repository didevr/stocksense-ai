import { withCache } from "@/lib/server/cache";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WATCHLIST = [
  "RELIANCE",
  "HDFCBANK",
  "ICICIBANK",
  "TCS",
  "INFY",
  "SBIN",
  "LT",
  "BAJFINANCE",
  "ITC",
  "MARUTI",
];

const SECTORS = [
  "Banking",
  "IT",
  "Energy",
  "FMCG",
  "Auto",
  "Pharma",
  "Infrastructure",
  "Financial Services",
  "Metals",
  "Telecom",
];

function seededNumber(seed, min, max) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  const n = Math.abs(h % 10000) / 10000;
  return min + n * (max - min);
}

function sentimentFromText(text = "") {
  const t = text.toLowerCase();
  const positive = ["beat", "growth", "upgrade", "surge", "record", "buy", "strong", "bullish"];
  const negative = ["miss", "downgrade", "fall", "drop", "weak", "lawsuit", "bearish", "risk"];

  let score = 0;
  positive.forEach((w) => {
    if (t.includes(w)) score += 1;
  });
  negative.forEach((w) => {
    if (t.includes(w)) score -= 1;
  });

  return Math.max(-1, Math.min(1, score / 4));
}

function toImpact(score) {
  const abs = Math.abs(score);
  if (abs > 0.65) return "High";
  if (abs > 0.3) return "Medium";
  return "Low";
}

export async function fetchQuote(symbol) {
  const cacheKey = `quote:${symbol}`;
  return withCache(cacheKey, 60 * 1000, async () => {
    const response = await fetch(`${BACKEND}/stocks/${symbol}`, {
      headers: { "content-type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`quote-${symbol}-failed`);
    }
    const payload = await response.json();
    return payload.data;
  });
}

export async function fetchNews(symbol) {
  const cacheKey = `news:${symbol}`;
  return withCache(cacheKey, 3 * 60 * 1000, async () => {
    const response = await fetch(`${BACKEND}/stocks/${symbol}/news`, {
      headers: { "content-type": "application/json" },
    });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload.news) ? payload.news : [];
  });
}

export async function getMarketBriefing(userName = "Trader", watchlistSymbols = WATCHLIST) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `briefing:${dateKey}:${userName}:${(watchlistSymbols || []).join(",")}`;

  return withCache(cacheKey, 2 * 60 * 1000, async () => {
    const listToFetch = (watchlistSymbols && watchlistSymbols.length) ? watchlistSymbols : WATCHLIST;
    const quoteResults = await Promise.allSettled(listToFetch.slice(0, 8).map((symbol) => fetchQuote(symbol)));

    const quotes = quoteResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .filter(Boolean);

    const sortedByChange = [...quotes].sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0));
    const gainers = sortedByChange.slice(0, 5);
    const losers = [...sortedByChange].reverse().slice(0, 5);

    const sectors = SECTORS.map((name, index) => {
      const perf = Number(seededNumber(`${dateKey}:${name}`, -2.2, 2.8).toFixed(2));
      return {
        name,
        change: perf,
        momentum: Math.round(seededNumber(`${name}:${dateKey}:${index}`, 30, 95)),
      };
    }).sort((a, b) => b.change - a.change);

    const marketMood = sectors.reduce((acc, s) => acc + s.change, 0) / sectors.length;
    const status = marketMood >= 0 ? "Market in risk-on mode" : "Defensive market tone";

    return {
      generatedAt: new Date().toISOString(),
      userName,
      status,
      marketSentiment: Number(marketMood.toFixed(2)),
      topGainers: gainers,
      topLosers: losers,
      trendingSectors: sectors.slice(0, 5),
      portfolioAlerts: [
        `${userName}, 2 holdings are near 52-week highs.`,
        "Watchlist volatility increased by 11% vs yesterday.",
        "One holding has earnings in the next 72 hours.",
      ],
      aiRecommendations: [
        "Accumulate quality leaders on intraday pullbacks.",
        "Rotate partial exposure toward high-momentum sectors.",
        "Keep hedge allocation if VIX trend keeps rising.",
      ],
      indices: [
        {
          name: "NIFTY 50",
          value: Number(seededNumber(`${dateKey}:nifty`, 24500, 25800).toFixed(2)),
          change: Number(seededNumber(`${dateKey}:nifty:chg`, -1.2, 1.4).toFixed(2)),
        },
        {
          name: "SENSEX",
          value: Number(seededNumber(`${dateKey}:sensex`, 80400, 84700).toFixed(2)),
          change: Number(seededNumber(`${dateKey}:sensex:chg`, -1.1, 1.4).toFixed(2)),
        },
        {
          name: "BANK NIFTY",
          value: Number(seededNumber(`${dateKey}:banknifty`, 51800, 53600).toFixed(2)),
          change: Number(seededNumber(`${dateKey}:banknifty:chg`, -1.6, 1.8).toFixed(2)),
        },
        {
          name: "NASDAQ",
          value: Number(seededNumber(`${dateKey}:nasdaq`, 18900, 20300).toFixed(2)),
          change: Number(seededNumber(`${dateKey}:nasdaq:chg`, -1.2, 1.5).toFixed(2)),
        },
        {
          name: "S&P 500",
          value: Number(seededNumber(`${dateKey}:sp500`, 5600, 6240).toFixed(2)),
          change: Number(seededNumber(`${dateKey}:sp500:chg`, -1.1, 1.2).toFixed(2)),
        },
        {
          name: "Dow Jones",
          value: Number(seededNumber(`${dateKey}:dow`, 41800, 44200).toFixed(2)),
          change: Number(seededNumber(`${dateKey}:dow:chg`, -1.1, 1.1).toFixed(2)),
        },
      ],
    };
  });
}

export async function getNewsDashboard(symbols = WATCHLIST.slice(0, 6)) {
  const cleanSymbols = symbols.slice(0, 8).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const key = cleanSymbols.join(",");

  return withCache(`news-dashboard:${key}`, 90 * 1000, async () => {
    const gathered = await Promise.all(
      cleanSymbols.map(async (symbol) => {
        const items = await fetchNews(symbol);
        return items.slice(0, 3).map((item, index) => {
          const score = sentimentFromText(`${item.title || ""} ${item.summary || ""}`);
          return {
            id: `${symbol}-${index}-${(item.title || "headline").slice(0, 16)}`,
            symbol,
            company: symbol,
            logo: `https://placehold.co/48x48/111827/f8fafc?text=${symbol.slice(0, 2)}`,
            headline: item.title || `${symbol} market update`,
            summary: item.summary || "Liquidity and momentum signals are shaping today's price action.",
            sentimentScore: Number(score.toFixed(2)),
            sentimentLabel: score > 0.2 ? "Bullish" : score < -0.2 ? "Bearish" : "Neutral",
            impact: toImpact(score),
            publishedAt: item.published_at || new Date(Date.now() - index * 1000 * 60 * 24).toISOString(),
            source: item.source || "StockSense Wire",
            url: item.url || "#",
          };
        });
      })
    );

    const cards = gathered.flat().slice(0, 16);
    const avg = cards.length
      ? cards.reduce((acc, n) => acc + n.sentimentScore, 0) / cards.length
      : 0;

    const sectorHeatmap = SECTORS.map((sector) => ({
      sector,
      score: Number(seededNumber(`${sector}:${key}`, -1, 1).toFixed(2)),
    }));

    return {
      generatedAt: new Date().toISOString(),
      breaking: cards[0] || null,
      cards,
      sentimentGauge: Number(avg.toFixed(2)),
      marketMovers: cards.slice(0, 5),
      timeline: cards.slice(0, 8).map((card, index) => ({
        time: card.publishedAt,
        score: card.sentimentScore,
        headline: card.headline,
        symbol: card.symbol,
        order: index + 1,
      })),
      trendingTopics: [
        "Earnings surprises",
        "AI capex cycle",
        "Banking credit growth",
        "Energy margin reset",
        "FII flow reversal",
        "Rate-cut expectations",
      ],
      sectorHeatmap,
    };
  });
}

const QUESTION_TEMPLATES = [
  "Why is {{symbol}} moving today?",
  "Which sectors are outperforming right now?",
  "Show breakout candidates in {{sector}}.",
  "What are today's top gainers and why?",
  "What are today's top losers and why?",
  "Which stocks show unusual volume spikes?",
  "Where are FIIs and DIIs allocating money today?",
  "Find undervalued opportunities with strong cash flow.",
  "Find bearish setups with weak momentum.",
  "What is the market sentiment right now?",
  "Compare {{symbol}} with {{symbol2}} on valuation and growth.",
  "Predict likely sector rotation for tomorrow.",
  "Show momentum stocks above 20-day highs.",
  "Which stocks are near 52-week highs?",
  "Which dividend stocks look strong now?",
  "Show accumulation zones for long-term investors.",
  "Find earnings winners likely to continue trend.",
  "Highlight defensive stocks in volatile markets.",
  "Which midcaps have strongest relative strength?",
  "Which stocks are overextended after a sharp rally?",
  "Where is smart money likely rotating next?",
  "Create a low-risk watchlist for this week.",
  "What are the best swing trade setups right now?",
  "Which large caps are showing reversal signals?",
  "What does options activity suggest for {{symbol}}?",
  "Which sectors are seeing strongest breadth?",
  "Which stocks have improving ROE and margins?",
  "What are the best value picks in {{sector}}?",
  "Which stocks are vulnerable to profit booking?",
  "Give me a bull vs bear case for {{symbol}}.",
  "Which themes are likely to lead next quarter?",
  "Show stocks with rising delivery volume.",
  "What are the best AI and digital transformation plays?",
  "Which PSU names look attractive technically?",
  "Where are short covering patterns visible?",
  "Which stocks have strong earnings consistency?",
  "Find quality compounders at reasonable valuations.",
  "Which sectors are lagging but turning around?",
  "Give me top stocks with high operating leverage.",
  "What is the best hedge for today's market risk?",
  "Which stocks are in buy zone after consolidation?",
  "Where can I find low-debt growth stories?",
  "Show me short-term mean reversion trades.",
  "Which stocks are in strong uptrend with low volatility?",
  "What are the best stocks for next month's SIP allocation?",
  "How is global market direction impacting India today?",
  "Which stocks could benefit from rate cuts?",
  "Find companies with strong free cash flow yield.",
  "What are the strongest technical setups in NIFTY 50?",
  "Show possible downside risk leaders today.",
  "Which sectors have best risk-reward this week?",
  "What is a balanced portfolio mix for current market?",
  "Which stocks are attractive after earnings correction?",
  "Find candidates for gap-up continuation trades.",
  "What are the strongest long-term themes right now?",
];

export function getDynamicQuestions(userName = "Trader") {
  const date = new Date().toISOString().slice(0, 10);
  const symbols = WATCHLIST;

  const questions = QUESTION_TEMPLATES.map((template, i) => {
    const symbol = symbols[i % symbols.length];
    const symbol2 = symbols[(i + 3) % symbols.length];
    const sector = SECTORS[i % SECTORS.length];

    return template
      .replace(/{{symbol}}/g, symbol)
      .replace(/{{symbol2}}/g, symbol2)
      .replace(/{{sector}}/g, sector);
  });

  return {
    generatedAt: new Date().toISOString(),
    welcome: `Welcome back, ${userName}. Here is your personalized market briefing for today.`,
    loginKey: `${userName}:${date}`,
    questions,
  };
}

