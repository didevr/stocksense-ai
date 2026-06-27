"""
StockSense AI — FastAPI backend
Run with: uvicorn app.main:app --reload
Docs at:  http://localhost:8000/docs
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import stocks, chat, earnings, user, auth
from app.config import get_settings
from app.database import Base, engine

# Create SQLite tables on startup
Base.metadata.create_all(bind=engine)

settings = get_settings()

app = FastAPI(
    title="StockSense AI",
    description="AI-powered stock research API for Indian investors",
    version="0.1.0",
)

frontend_url = os.getenv("FRONTEND_URL")
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if frontend_url:
    # Ensure no trailing slashes in CORS origin
    allowed_origins.append(frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(chat.router)
app.include_router(earnings.router)
app.include_router(user.router)
app.include_router(auth.router)


@app.get("/")
async def root():
    return {
        "name": "StockSense AI",
        "status": "running",
        "docs": "/docs",
        "endpoints": [
            "/stocks/{symbol}",
            "/stocks/{symbol}/history",
            "/stocks/{symbol}/news",
            "/stocks/{symbol}/insights",
            "/chat/",
            "/chat/stream",
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
