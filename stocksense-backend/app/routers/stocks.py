from fastapi import APIRouter, HTTPException
from app.services.stock_service import (
    build_indicators,
    get_stock_data,
    get_stock_history,
    get_stock_insights,
    get_stock_news,
)
from app.models.schemas import StockResponse

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/{symbol}", response_model=StockResponse)
async def stock_quote(symbol: str):
    """
    Get live price + fundamentals for a single NSE/BSE symbol.
    Example: GET /stocks/RELIANCE
    """
    try:
        data, cached = await get_stock_data(symbol.upper())
        return StockResponse(data=data, cached=cached)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{symbol}/news")
async def stock_news(symbol: str):
    """
    Get latest news headlines for a symbol.
    Example: GET /stocks/TCS/news
    """
    try:
        news = await get_stock_news(symbol.upper())
        return {"symbol": symbol.upper(), "news": news, "count": len(news)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/history")
async def stock_history(symbol: str, period: str = "3mo"):
    """
    Get historical closing prices for charting.
    period options: 1mo, 3mo, 6mo, 1y, 2y, 5y
    Example: GET /stocks/RELIANCE/history?period=3mo
    """
    try:
        candles = await get_stock_history(symbol.upper(), period)
        return {
            "symbol": symbol.upper(),
            "period": period,
            "history": candles,
            "candles": candles,
            "indicators": build_indicators(candles) if candles else {},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/insights")
async def stock_insights(symbol: str):
    """
    Dynamic bull/bear signal based on sentiment, momentum, volume, and relative strength.
    Example: GET /stocks/RELIANCE/insights
    """
    try:
        data = await get_stock_insights(symbol.upper())
        return data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
