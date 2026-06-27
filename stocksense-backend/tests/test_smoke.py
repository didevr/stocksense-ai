"""
Quick smoke test — run before starting the server.
Usage: python tests/test_smoke.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.stock_service import get_stock_data, get_stock_news
from app.services.ai_service import detect_intent, extract_symbols, chat


async def test_intent_detection():
    print("\n--- Intent detection ---")
    cases = [
        ("What is TCS price today?", "price"),
        ("Why did ZOMATO fall last week?", "news"),
        ("Compare HDFCBANK vs ICICIBANK P/E", "comparison"),
        ("What is Infosys revenue?", "fundamentals"),
    ]
    for msg, expected in cases:
        result = detect_intent(msg)
        status = "✓" if result == expected else "✗"
        print(f"  {status} '{msg[:40]}' → {result} (expected: {expected})")


async def test_symbol_extraction():
    print("\n--- Symbol extraction ---")
    cases = [
        "Compare RELIANCE vs TCS stock",
        "Why did ZOMATO crash today?",
        "What is HDFCBANK PE ratio?",
    ]
    for msg in cases:
        syms = extract_symbols(msg)
        print(f"  '{msg}' → {syms}")


async def test_stock_fetch():
    print("\n--- Stock data fetch (requires API keys) ---")
    symbol = "RELIANCE"
    try:
        data, cached = await get_stock_data(symbol)
        print(f"  ✓ {data.symbol}: ₹{data.price} ({data.change_pct:+.2f}%) [cached={cached}]")
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        print("    (Set ALPHA_VANTAGE_API_KEY in .env and try again)")


async def test_chat():
    print("\n--- Chat (requires OPENAI_API_KEY in .env) ---")
    try:
        resp = await chat("What is the 52-week range of Reliance?", symbol="RELIANCE")
        print(f"  ✓ Answer: {resp.answer[:120]}...")
        print(f"    Sources: {resp.sources}")
        print(f"    Tokens: {resp.tokens_used}")
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        print("    (Set OPENAI_API_KEY in .env and try again)")


if __name__ == "__main__":
    print("StockSense AI — smoke tests")
    print("=" * 40)
    asyncio.run(test_intent_detection())
    asyncio.run(test_symbol_extraction())
    asyncio.run(test_stock_fetch())
    asyncio.run(test_chat())
    print("\nDone. Start server with: uvicorn app.main:app --reload")
