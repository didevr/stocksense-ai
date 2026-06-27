# StockSense AI — Backend

FastAPI backend for AI-powered Indian stock research.

## Setup

```bash
# 1. Clone and enter directory
cd stocksense

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your API keys (see below)

# 5. Run smoke tests
python tests/test_smoke.py

# 6. Start server
uvicorn app.main:app --reload
```

Open **http://localhost:8000/docs** for the interactive API docs.

## API Keys needed

| Key | Where to get | Cost |
|-----|-------------|------|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Pay per use (~₹0.05/query) |
| `ALPHA_VANTAGE_API_KEY` | alphavantage.co | Free: 25 req/day |
| `REDIS_URL` | Local Redis or Upstash | Free tier available |
| `SUPABASE_URL` + `SUPABASE_KEY` | supabase.com | Free tier |

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stocks/{symbol}` | Live price + fundamentals |
| GET | `/stocks/{symbol}/news` | Latest news with sentiment |
| POST | `/chat/` | Ask AI a question (full response) |
| POST | `/chat/stream` | Streaming AI response |
| GET | `/health` | Health check |

## Example requests

```bash
# Get stock data
curl http://localhost:8000/stocks/RELIANCE

# Get news
curl http://localhost:8000/stocks/TCS/news

# Ask AI (non-streaming)
curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message": "Why did Zomato fall last week?", "symbol": "ZOMATO", "plan": "pro"}'

# Streaming (for real-time chat UI)
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Compare HDFCBANK vs ICICIBANK PE ratio"}'
```

## Project structure

```
stocksense/
├── app/
│   ├── main.py              # FastAPI app + routes
│   ├── config.py            # Settings (env vars)
│   ├── models/
│   │   └── schemas.py       # Pydantic models
│   ├── routers/
│   │   ├── stocks.py        # /stocks endpoints
│   │   └── chat.py          # /chat endpoints
│   └── services/
│       ├── stock_service.py # NSE + Alpha Vantage + Redis cache
│       └── ai_service.py    # Claude API + prompt engine
├── tests/
│   └── test_smoke.py        # Quick sanity tests
├── requirements.txt
└── .env.example
```

## Next steps (Week 3+)

- Add Supabase auth middleware (validate JWT on each request)
- Add per-user query quota enforcement (Redis counter)
- Add RAG layer with pgvector for earnings call search
- Connect Razorpay webhook to update user plan in Supabase
