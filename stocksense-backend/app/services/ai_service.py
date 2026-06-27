"""
StockSense AI chat service.

Uses OpenAI when OPENAI_API_KEY is configured, with Gemini as a fallback for
older local setups that still use GEMINI_API_KEY.
"""

from openai import OpenAI

from app.config import get_settings
from app.models.schemas import ChatResponse
from app.services.stock_service import get_stock_data, get_stock_news
from app.services.symbol_service import extract_symbols
from app.services.rag_service import check_earnings_loaded, search_chunks

settings = get_settings()

openai_client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
gemini_model = None

# Initialise the fallback even when OpenAI is configured. Previously this only
# happened when OPENAI_API_KEY was empty, so a failed OpenAI request could not
# actually fall back to Gemini.
if settings.gemini_api_key:
    import google.generativeai as genai

    genai.configure(api_key=settings.gemini_api_key)
    gemini_model = genai.GenerativeModel(settings.gemini_model)

SEBI_DISCLAIMER = (
    "For research and educational purposes only. "
    "Not a SEBI-registered investment advisor. "
    "Please consult a qualified financial advisor before investing."
)

SYSTEM_PROMPT = """You are StockSense AI, a knowledgeable stock research assistant specialising in Indian equity markets (NSE and BSE), with the ability to also look up major global stocks (US, UK, and other large exchanges) when asked.

Your role:
- Answer questions about Indian stocks clearly and accurately - this remains your primary focus
- Also answer questions about major global stocks (e.g. Apple, Microsoft, Tesla) when the user asks
- Explain financial metrics in plain language (Hindi or English as preferred by the user)
- Provide context and analysis, not just raw numbers
- Always cite your data source (NSE, BSE, NASDAQ, NYSE, company filings, earnings calls)
- Never make buy/sell recommendations - you provide research, not investment advice
- Always use the correct currency for the stock being discussed (Rs for Indian stocks, $ for US stocks, etc.) - never mix currencies

Rules:
- If asked for a buy/sell recommendation, explain you provide research only
- Always be factual - if you don't have the data, say so clearly
- Format Indian-currency numbers in Indian style: lakhs and crores. Format other currencies in standard international style (K/M/B/T)
- Keep answers concise but complete - 3-5 sentences unless detail is needed
- If the user writes in Hindi, respond in Hindi
- If Live market data contains "Earnings Call Transcripts", use that text to answer questions about earnings calls, revenues, management guidance, or margins. Quote brief excerpts (under 20 words) when helpful, and cite the passages you use by their numbers (e.g., "[Passage 1]", "[Passage 2]").
"""

def detect_intent(message):
    msg = message.lower()
    if any(w in msg for w in ["compare", "vs", "versus", "better", "which is"]):
        return "comparison"
    if any(
        w in msg
        for w in ["news", "latest", "recently", "happened", "why did", "fall", "rise", "crash"]
    ):
        return "news"
    if any(w in msg for w in ["p/e", "pe ratio", "eps", "revenue", "profit", "debt", "roe", "fundamental"]):
        return "fundamentals"
    if any(w in msg for w in ["price", "trading at", "current", "today", "52 week"]):
        return "price"
    return "general"


CURRENCY_PREFIX = {
    "INR": "Rs", "USD": "$", "GBP": "GBP", "EUR": "EUR",
    "JPY": "JPY", "HKD": "HKD", "SGD": "SGD", "AUD": "AUD", "CAD": "CAD",
}


def _money(value, currency):
    prefix = CURRENCY_PREFIX.get(currency, currency or "")
    return f"{prefix} {value:,.2f}"


def _market_cap_str(value, currency):
    if currency == "INR":
        return f"Rs {value / 1e7:.0f} Cr"
    prefix = CURRENCY_PREFIX.get(currency, currency or "")
    if value >= 1e12:
        return f"{prefix} {value / 1e12:.2f}T"
    if value >= 1e9:
        return f"{prefix} {value / 1e9:.2f}B"
    if value >= 1e6:
        return f"{prefix} {value / 1e6:.2f}M"
    return f"{prefix} {value:,.0f}"


def _format_stock_context(stock):
    currency = getattr(stock, "currency", "INR") or "INR"
    exchange = getattr(stock, "exchange", None)

    parts = [
        f"Company: {stock.name} ({stock.symbol})" + (f" — {exchange}" if exchange else ""),
        f"Current price: {_money(stock.price, currency)}",
        f"Change today: {stock.change:+.2f} ({stock.change_pct:+.2f}%)",
        f"Volume: {stock.volume:,}",
    ]
    if stock.pe_ratio:
        parts.append(f"P/E ratio: {stock.pe_ratio:.1f}x")
    if stock.week_52_high and stock.week_52_low:
        parts.append(
            f"52-week range: {_money(stock.week_52_low, currency)} - {_money(stock.week_52_high, currency)}"
        )
    if stock.market_cap:
        parts.append(f"Market cap: {_market_cap_str(stock.market_cap, currency)}")
    return "\n".join(parts)


def _format_news_context(news):
    if not news:
        return "No recent news available."
    return "\n".join(
        f"- [{n.sentiment.upper()}] {n.title} (Source: {n.source})"
        for n in news[:5]
    )


async def _build_context(message, hint_symbol=None):
    symbols = extract_symbols(message)
    if hint_symbol:
        hint_symbol = hint_symbol.upper()
        symbols = [hint_symbol] + [s for s in symbols if s != hint_symbol]

    context_parts = []
    sources = []
    intent = detect_intent(message)

    for symbol in symbols[:2]:
        try:
            stock, _ = await get_stock_data(symbol)
            context_parts.append(f"=== {symbol} Data ===\n{_format_stock_context(stock)}")
            sources.append(f"{symbol} via {stock.source}")

            # RAG integration: check if earnings call data is loaded
            if check_earnings_loaded(symbol):
                chunks = search_chunks(symbol, message)
                if chunks:
                    passage_texts = []
                    for i, c in enumerate(chunks):
                        passage_texts.append(f"[Passage {i+1} — {c['symbol']} {c['quarter']}]\n{c['content']}")
                        sources.append(f"{symbol} {c['quarter']} chunk {c['chunk_index']} (score: {round(c.get('similarity', 0), 3)})")
                    context_parts.append(f"\nEarnings Call Transcripts for {symbol}:\n" + "\n\n---\n\n".join(passage_texts))

            if intent in ("news", "general"):
                news = await get_stock_news(symbol)
                if news:
                    context_parts.append(f"\nRecent news for {symbol}:\n{_format_news_context(news)}")
        except Exception as e:
            context_parts.append(f"Note: {e}")

    return "\n\n".join(context_parts), sources


def _ensure_ai_provider():
    if openai_client or gemini_model:
        return
    raise RuntimeError("Set OPENAI_API_KEY or GEMINI_API_KEY in .env before using chat.")


def _generate_with_gemini(prompt, stream=False):
    if not gemini_model:
        raise RuntimeError("Gemini fallback is not configured.")
    return gemini_model.generate_content(prompt, stream=stream)


async def chat(message, symbol=None, user_id="anonymous", plan="free"):
    _ensure_ai_provider()
    context, sources = await _build_context(message, symbol)

    prompt = SYSTEM_PROMPT + "\n\n"
    if context:
        prompt += f"Live market data:\n{context}\n\n"
    prompt += f"User question: {message}"

    if openai_client:
        try:
            response = openai_client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
            )
            answer = response.choices[0].message.content or ""
            tokens_used = response.usage.total_tokens if response.usage else 0
        except Exception:
            if not gemini_model:
                raise
            response = _generate_with_gemini(prompt)
            answer = response.text or ""
            tokens_used = 0
    else:
        response = _generate_with_gemini(prompt)
        answer = response.text or ""
        tokens_used = 0

    return ChatResponse(
        answer=answer,
        sources=sources,
        disclaimer=SEBI_DISCLAIMER,
        tokens_used=tokens_used,
    )


async def chat_stream(message, symbol=None):
    """Streaming version - yields text chunks for the chat UI."""
    _ensure_ai_provider()
    context, _ = await _build_context(message, symbol)

    prompt = SYSTEM_PROMPT + "\n\n"
    if context:
        prompt += f"Live market data:\n{context}\n\n"
    prompt += f"User question: {message}"

    if openai_client:
        emitted_openai_text = False
        try:
            response = openai_client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
            )
            for chunk in response:
                text = chunk.choices[0].delta.content
                if text:
                    emitted_openai_text = True
                    yield text
            return
        except Exception:
            # Falling back after yielding OpenAI text would duplicate or mix the
            # answer. Retry with Gemini only when OpenAI failed before output.
            if emitted_openai_text or not gemini_model:
                raise

    response = _generate_with_gemini(prompt, stream=True)
    for chunk in response:
        if chunk.text:
            yield chunk.text