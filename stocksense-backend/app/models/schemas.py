from pydantic import BaseModel
from typing import Optional


class StockData(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_pct: float
    volume: int
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    eps: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None
    revenue_ttm: Optional[float] = None
    net_profit_ttm: Optional[float] = None
    debt_to_equity: Optional[float] = None
    roe: Optional[float] = None
    source: str = "Yahoo Finance"
    exchange: Optional[str] = None     # NSE / BSE / NASDAQ / NYSE / etc.
    currency: str = "INR"              # INR / USD / GBP / EUR / etc.


class NewsItem(BaseModel):
    title: str
    summary: str
    url: str
    sentiment: str  # positive / negative / neutral
    published_at: str
    source: str


class ChatRequest(BaseModel):
    message: str
    symbol: Optional[str] = None   # pre-selected stock if any
    user_id: str = "anonymous"
    plan: str = "free"             # free / pro / analyst


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = []
    disclaimer: str = (
        "For research purposes only. Not SEBI-registered investment advice."
    )
    tokens_used: int = 0


class StockResponse(BaseModel):
    data: StockData
    cached: bool = False