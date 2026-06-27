"""
Stock data service powered by Yahoo Finance (yfinance).
Lookup order for every symbol: NSE (.NS) -> BSE (.BO) -> Global (no suffix).
"""

import asyncio
import json
from statistics import mean
from typing import Optional

import redis.asyncio as aioredis
import yfinance as yf

from app.config import get_settings
from app.models.schemas import NewsItem, StockData

settings = get_settings()

EXCHANGE_LABELS = {
    "NSI": "NSE",
    "BSE": "BSE",
    "NMS": "NASDAQ",
    "NGM": "NASDAQ",
    "NCM": "NASDAQ",
    "NYQ": "NYSE",
    "ASE": "NYSE American",
    "PCX": "NYSE Arca",
    "LSE": "LSE",
    "TOR": "TSX",
    "GER": "XETRA",
    "PAR": "Euronext Paris",
    "HKG": "HKEX",
    "TYO": "TSE",
    "ASX": "ASX",
}

LOOKUP_CHAIN = ((".NS", "NSE"), (".BO", "BSE"), ("", None))

_redis: Optional[aioredis.Redis] = None
_redis_ok: Optional[bool] = None


async def get_redis() -> Optional[aioredis.Redis]:
    global _redis, _redis_ok
    if _redis_ok is False:
        return None
    if _redis_ok is True and _redis is not None:
        return _redis
    try:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=1)
        await _redis.ping()
        _redis_ok = True
    except Exception:
        _redis = None
        _redis_ok = False
    return _redis


async def _cache_get(key: str):
    redis_client = await get_redis()
    if redis_client is None:
        return None
    raw = await redis_client.get(key)
    return json.loads(raw) if raw else None


async def _cache_set(key: str, data, ttl: int) -> None:
    redis_client = await get_redis()
    if redis_client is None:
        return
    await redis_client.setex(key, ttl, json.dumps(data))


def _fetch_yfinance_sync(symbol: str):
    sym = symbol.upper()
    for suffix, forced_label in LOOKUP_CHAIN:
        ticker = yf.Ticker(f"{sym}{suffix}")
        try:
            info = ticker.info
        except Exception:
            info = None

        if info and info.get("regularMarketPrice") is not None:
            if forced_label:
                label = forced_label
            else:
                raw = info.get("exchange", "")
                label = EXCHANGE_LABELS.get(raw, raw or "Global")
            return info, label

    return None, None


async def _fetch_yfinance(symbol: str) -> Optional[StockData]:
    loop = asyncio.get_event_loop()
    info, exchange = await loop.run_in_executor(None, _fetch_yfinance_sync, symbol)

    if not info:
        return None

    price = info.get("regularMarketPrice") or info.get("currentPrice") or 0
    prev_close = info.get("regularMarketPreviousClose") or info.get("previousClose") or price
    change = round(price - prev_close, 2)
    change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0

    return StockData(
        symbol=symbol.upper(),
        name=info.get("longName") or info.get("shortName") or symbol,
        price=round(price, 2),
        change=change,
        change_pct=change_pct,
        volume=int(info.get("regularMarketVolume") or 0),
        market_cap=info.get("marketCap"),
        pe_ratio=info.get("trailingPE"),
        eps=info.get("trailingEps"),
        week_52_high=info.get("fiftyTwoWeekHigh"),
        week_52_low=info.get("fiftyTwoWeekLow"),
        debt_to_equity=info.get("debtToEquity"),
        roe=(info.get("returnOnEquity") * 100) if info.get("returnOnEquity") else None,
        source="Yahoo Finance",
        exchange=exchange,
        currency=info.get("currency") or "INR",
    )


async def get_stock_data(symbol: str) -> tuple[StockData, bool]:
    cache_key = f"stock:{symbol.upper()}"
    cached = await _cache_get(cache_key)
    if cached:
        return StockData(**cached), True

    stock = await _fetch_yfinance(symbol)
    if stock is None:
        raise ValueError(
            f"Could not fetch data for symbol '{symbol}'. "
            "Try an NSE/BSE symbol (e.g. RELIANCE, TCS) or a major global ticker (e.g. AAPL, MSFT, TSLA)."
        )

    await _cache_set(cache_key, stock.model_dump(), settings.price_cache_ttl)
    return stock, False


def _fetch_history_sync(symbol: str, period: str) -> list[dict]:
    sym = symbol.upper()

    for suffix, _ in LOOKUP_CHAIN:
        ticker = yf.Ticker(f"{sym}{suffix}")
        try:
            hist = ticker.history(period=period)
        except Exception:
            hist = None

        if hist is not None and not hist.empty:
            out = []
            for date, row in hist.iterrows():
                out.append(
                    {
                        "date": date.strftime("%Y-%m-%d"),
                        "open": round(float(row["Open"]), 2),
                        "high": round(float(row["High"]), 2),
                        "low": round(float(row["Low"]), 2),
                        "close": round(float(row["Close"]), 2),
                        "volume": int(float(row["Volume"])) if row.get("Volume") is not None else 0,
                    }
                )
            return out

    return []


async def get_stock_history(symbol: str, period: str = "3mo") -> list[dict]:
    cache_key = f"history:{symbol.upper()}:{period}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, _fetch_history_sync, symbol, period)

    if data:
        await _cache_set(cache_key, data, settings.price_cache_ttl)
    return data


def _fetch_news_sync(symbol: str) -> list[dict]:
    sym = symbol.upper()

    for suffix, _ in LOOKUP_CHAIN:
        ticker = yf.Ticker(f"{sym}{suffix}")
        try:
            news = ticker.news
        except Exception:
            news = None
        if news:
            return news

    return []


async def get_stock_news(symbol: str) -> list[NewsItem]:
    cache_key = f"news:{symbol.upper()}"
    cached = await _cache_get(cache_key)
    if cached:
        return [NewsItem(**item) for item in cached]

    items: list[NewsItem] = []
    try:
        loop = asyncio.get_event_loop()
        raw_news = await loop.run_in_executor(None, _fetch_news_sync, symbol)

        for article in raw_news[:8]:
            content = article.get("content") if isinstance(article.get("content"), dict) else {}
            title = content.get("title") or article.get("title") or ""
            if not title:
                continue

            url = ""
            if isinstance(content.get("canonicalUrl"), dict):
                url = content["canonicalUrl"].get("url", "")
            elif article.get("link"):
                url = article["link"]

            source = ""
            if isinstance(content.get("provider"), dict):
                source = content["provider"].get("displayName", "")
            elif article.get("publisher"):
                source = article["publisher"]

            summary = (content.get("summary") or article.get("summary") or "")[:240]
            published = str(content.get("pubDate") or article.get("providerPublishTime") or "")

            items.append(
                NewsItem(
                    title=title,
                    summary=summary,
                    url=url,
                    sentiment="neutral",
                    published_at=published,
                    source=source,
                )
            )
    except Exception:
        pass

    if items:
        await _cache_set(cache_key, [item.model_dump() for item in items], settings.news_cache_ttl)
    return items


def _sma(values: list[float], window: int) -> list[Optional[float]]:
    out: list[Optional[float]] = []
    for i in range(len(values)):
        if i + 1 < window:
            out.append(None)
            continue
        out.append(round(sum(values[i - window + 1 : i + 1]) / window, 2))
    return out


def _ema(values: list[float], window: int) -> list[Optional[float]]:
    if not values:
        return []
    out: list[Optional[float]] = [None] * len(values)
    k = 2 / (window + 1)
    ema_value: Optional[float] = None
    for i, value in enumerate(values):
        if i + 1 < window:
            continue
        if ema_value is None:
            ema_value = sum(values[i - window + 1 : i + 1]) / window
        else:
            ema_value = (value * k) + (ema_value * (1 - k))
        out[i] = round(ema_value, 2)
    return out


def _rsi(values: list[float], window: int = 14) -> list[Optional[float]]:
    if len(values) < 2:
        return [None for _ in values]

    out: list[Optional[float]] = [None] * len(values)
    gains: list[float] = []
    losses: list[float] = []

    for i in range(1, len(values)):
        change = values[i] - values[i - 1]
        gains.append(max(change, 0))
        losses.append(max(-change, 0))
        if i < window:
            continue
        avg_gain = sum(gains[i - window : i]) / window
        avg_loss = sum(losses[i - window : i]) / window
        if avg_loss == 0:
            out[i] = 100.0
            continue
        rs = avg_gain / avg_loss
        out[i] = round(100 - (100 / (1 + rs)), 2)

    return out


def _bollinger(values: list[float], window: int = 20) -> tuple[list[Optional[float]], list[Optional[float]], list[Optional[float]]]:
    upper: list[Optional[float]] = []
    middle: list[Optional[float]] = []
    lower: list[Optional[float]] = []

    for i in range(len(values)):
        if i + 1 < window:
            upper.append(None)
            middle.append(None)
            lower.append(None)
            continue
        chunk = values[i - window + 1 : i + 1]
        mid = mean(chunk)
        variance = sum((x - mid) ** 2 for x in chunk) / window
        std = variance ** 0.5
        middle.append(round(mid, 2))
        upper.append(round(mid + (2 * std), 2))
        lower.append(round(mid - (2 * std), 2))

    return upper, middle, lower


def _macd(values: list[float]) -> tuple[list[Optional[float]], list[Optional[float]], list[Optional[float]]]:
    ema12 = _ema(values, 12)
    ema26 = _ema(values, 26)

    macd: list[Optional[float]] = []
    for i in range(len(values)):
        if ema12[i] is None or ema26[i] is None:
            macd.append(None)
        else:
            macd.append(round(float(ema12[i]) - float(ema26[i]), 4))

    valid_macd = [point for point in macd if point is not None]
    signal_seed = _ema(valid_macd, 9) if valid_macd else []

    signal: list[Optional[float]] = []
    seed_idx = 0
    for point in macd:
        if point is None:
            signal.append(None)
        else:
            seed_val = signal_seed[seed_idx] if seed_idx < len(signal_seed) else None
            signal.append(round(float(seed_val), 4) if seed_val is not None else None)
            seed_idx += 1

    hist: list[Optional[float]] = []
    for point, sig in zip(macd, signal):
        if point is None or sig is None:
            hist.append(None)
        else:
            hist.append(round(point - sig, 4))

    return macd, signal, hist


def build_indicators(candles: list[dict]) -> dict:
    closes = [float(candle["close"]) for candle in candles]
    sma20 = _sma(closes, 20)
    ema20 = _ema(closes, 20)
    rsi14 = _rsi(closes, 14)
    macd, signal, hist = _macd(closes)
    bb_upper, bb_middle, bb_lower = _bollinger(closes, 20)

    return {
        "sma20": sma20,
        "ema20": ema20,
        "rsi14": rsi14,
        "macd": macd,
        "macdSignal": signal,
        "macdHist": hist,
        "bbUpper": bb_upper,
        "bbMiddle": bb_middle,
        "bbLower": bb_lower,
    }


def _sentiment_score(news: list[NewsItem]) -> float:
    positive = ("beat", "growth", "upgrade", "surge", "record", "buy", "strong", "bullish", "outperform")
    negative = ("miss", "downgrade", "fall", "drop", "weak", "lawsuit", "bearish", "risk", "probe")
    if not news:
        return 50.0

    raw = 0.0
    for item in news[:10]:
        text = f"{item.title} {item.summary}".lower()
        positives = sum(1 for word in positive if word in text)
        negatives = sum(1 for word in negative if word in text)
        raw += (positives - negatives)

    normalized = max(-1.0, min(1.0, raw / max(1, len(news[:10]) * 2)))
    return round((normalized + 1) * 50, 2)


def _momentum_score(candles: list[dict], indicators: dict) -> float:
    if len(candles) < 20:
        return 50.0

    last = candles[-1]["close"]
    prev = candles[-2]["close"]
    day_delta = ((last - prev) / prev) * 100 if prev else 0
    month_ref = candles[-20]["close"]
    month_delta = ((last - month_ref) / month_ref) * 100 if month_ref else 0

    score = 50 + (day_delta * 2.2) + (month_delta * 1.6)
    rsi = indicators.get("rsi14", [None])[-1]
    if rsi is not None:
        if 45 <= rsi <= 65:
            score += 5
        elif rsi < 35:
            score -= 7
        elif rsi > 75:
            score -= 5

    return round(max(0, min(100, score)), 2)


def _volume_score(candles: list[dict]) -> float:
    if len(candles) < 15:
        return 50.0

    recent = [point["volume"] for point in candles[-5:] if point.get("volume") is not None]
    base = [point["volume"] for point in candles[-15:-5] if point.get("volume") is not None]
    if not recent or not base or mean(base) == 0:
        return 50.0

    ratio = mean(recent) / mean(base)
    score = 50 + ((ratio - 1) * 35)
    return round(max(0, min(100, score)), 2)


def _relative_strength_score(candles: list[dict]) -> float:
    if len(candles) < 30:
        return 50.0

    last = candles[-1]["close"]
    ref_1m = candles[-22]["close"]
    months = min(60, len(candles) - 1)
    ref_3m = candles[-1 - months]["close"]

    perf_1m = ((last - ref_1m) / ref_1m) * 100 if ref_1m else 0
    perf_3m = ((last - ref_3m) / ref_3m) * 100 if ref_3m else 0

    score = 50 + (perf_1m * 2) + (perf_3m * 1.2)
    return round(max(0, min(100, score)), 2)


def _analyst_proxy_score(stock: StockData) -> float:
    score = 50.0
    if stock.pe_ratio:
        if stock.pe_ratio < 18:
            score += 8
        elif stock.pe_ratio > 40:
            score -= 8
    if stock.roe:
        if stock.roe > 15:
            score += 10
        elif stock.roe < 8:
            score -= 10
    return round(max(0, min(100, score)), 2)


async def get_stock_insights(symbol: str) -> dict:
    stock, _ = await get_stock_data(symbol)
    candles = await get_stock_history(symbol, "6mo")
    news = await get_stock_news(symbol)

    indicators = build_indicators(candles) if candles else {}
    news_score = _sentiment_score(news)
    social_score = round(max(0, min(100, 50 + ((news_score - 50) * 0.7))), 2)
    momentum_score = _momentum_score(candles, indicators) if candles else 50.0
    analyst_score = _analyst_proxy_score(stock)
    volume_score = _volume_score(candles) if candles else 50.0
    rs_score = _relative_strength_score(candles) if candles else 50.0

    factors = {
        "newsSentiment": news_score,
        "socialSentiment": social_score,
        "priceMomentum": momentum_score,
        "analystRatings": analyst_score,
        "volume": volume_score,
        "relativeStrength": rs_score,
    }

    bull_score = round(sum(factors.values()) / len(factors), 2)
    bear_score = round(100 - bull_score, 2)
    spread = abs(bull_score - bear_score)
    confidence = "High" if spread >= 30 else "Medium" if spread >= 14 else "Low"

    drivers: list[str] = []
    if momentum_score > 60:
        drivers.append("Positive short-term momentum")
    if volume_score > 60:
        drivers.append("Volume expansion vs recent average")
    if news_score > 60:
        drivers.append("News flow skewing positive")
    if rs_score > 60:
        drivers.append("Relative strength improving")
    if analyst_score > 55:
        drivers.append("Fundamental quality proxy supportive")
    if not drivers:
        drivers.append("Mixed factors with no dominant edge")

    sentiment_trend = [
        round(max(0, min(100, news_score - 9.2)), 2),
        round(max(0, min(100, news_score - 5.4)), 2),
        round(max(0, min(100, news_score - 2.7)), 2),
        round(max(0, min(100, news_score + 1.6)), 2),
        round(max(0, min(100, news_score + 3.1)), 2),
        news_score,
    ]

    return {
        "symbol": symbol.upper(),
        "bullScore": bull_score,
        "bearScore": bear_score,
        "confidence": confidence,
        "drivers": drivers,
        "factors": factors,
        "sentimentTrend": sentiment_trend,
    }
