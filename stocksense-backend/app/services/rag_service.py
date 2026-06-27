"""
StockSense RAG — Earnings call PDF ingestion + retrieval (FastAPI refactored version)
"""

import os
import json
import argparse
import io
# pyrefly: ignore [missing-import]
import pdfplumber
from openai import OpenAI
# pyrefly: ignore [missing-import]
from supabase import create_client, Client
from app.config import get_settings

EMBED_MODEL  = "text-embedding-3-small"   # 1536-dim, very cheap
CHAT_MODEL   = "gpt-4o-mini"
TOP_K        = 5

_openai_client = None
_supabase_client = None


def get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        settings = get_settings()
        _openai_client = OpenAI(api_key=settings.openai_api_key)
    return _openai_client


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_key:
            raise ValueError("Supabase keys are missing from configuration (.env).")
        _supabase_client = create_client(settings.supabase_url, settings.supabase_key)
    return _supabase_client


def extract_pdf_text(pdf_file) -> str:
    """Extract text from a file path or file-like object."""
    parts = []
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(t.strip())
    return "\n\n".join(parts)


def chunk_text(text: str, chunk_chars: int = 1600, overlap: int = 200) -> list[str]:
    chunks, start = [], 0
    while start < len(text):
        end   = start + chunk_chars
        chunk = text[start:end]
        lp    = chunk.rfind(". ")
        if lp > chunk_chars // 2:
            chunk = chunk[:lp + 1]
            end   = start + lp + 1
        chunks.append(chunk.strip())
        start = end - overlap
    return [c for c in chunks if len(c) > 100]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed using text-embedding-3-small."""
    client = get_openai_client()
    result = client.embeddings.create(input=texts, model=EMBED_MODEL)
    return [d.embedding for d in result.data]


def embed_query(query: str) -> list[float]:
    client = get_openai_client()
    result = client.embeddings.create(input=[query], model=EMBED_MODEL)
    return result.data[0].embedding


def store_chunks(symbol: str, quarter: str, chunks: list[str], embeddings: list[list[float]]) -> int:
    supabase = get_supabase_client()
    # Delete older chunks for this symbol and quarter to prevent duplication
    supabase.table("earnings_chunks").delete() \
        .eq("symbol", symbol.upper()).eq("quarter", quarter).execute()

    rows = [
        {"symbol": symbol.upper(), "quarter": quarter,
         "chunk_index": i, "content": chunk, "embedding": emb}
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]
    inserted = 0
    for i in range(0, len(rows), 50):
        supabase.table("earnings_chunks").insert(rows[i:i+50]).execute()
        inserted += len(rows[i:i+50])
    return inserted


def check_earnings_loaded(symbol: str) -> bool:
    """Check if there is any earnings data loaded for a symbol."""
    try:
        supabase = get_supabase_client()
        result = supabase.table("earnings_chunks") \
            .select("id", count="exact") \
            .eq("symbol", symbol.upper()) \
            .limit(1) \
            .execute()
        count = result.count if hasattr(result, "count") else len(result.data or [])
        if count is None:
            count = len(result.data or [])
        return count > 0
    except Exception:
        return False


def list_loaded_quarters(symbol: str) -> list[str]:
    """List loaded quarters for a symbol."""
    try:
        supabase = get_supabase_client()
        result = supabase.table("earnings_chunks") \
            .select("quarter") \
            .eq("symbol", symbol.upper()) \
            .execute()
        quarters = set(row["quarter"] for row in (result.data or []))
        return sorted(list(quarters))
    except Exception:
        return []


def ingest_pdf_bytes(symbol: str, quarter: str, pdf_bytes: bytes) -> int:
    """Ingest a PDF from raw bytes."""
    pdf_file = io.BytesIO(pdf_bytes)
    text = extract_pdf_text(pdf_file)
    if not text.strip():
        raise ValueError("Could not extract any text from PDF. It might be scanned or empty.")
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("The extracted text is too short to generate chunks.")
    embeddings = embed_texts(chunks)
    count = store_chunks(symbol, quarter, chunks, embeddings)
    return count


def ingest_pdf(symbol: str, quarter: str, pdf_path: str) -> None:
    text      = extract_pdf_text(pdf_path)
    chunks    = chunk_text(text)
    embeddings = embed_texts(chunks)
    count     = store_chunks(symbol, quarter, chunks, embeddings)
    print(f"Done — {count} chunks stored.")


def search_chunks(symbol: str, query: str) -> list[dict]:
    supabase = get_supabase_client()
    qvec   = embed_query(query)
    result = supabase.rpc("search_earnings_chunks", {
        "query_embedding": qvec,
        "filter_symbol":   symbol.upper(),
        "match_count":     TOP_K,
    }).execute()
    return result.data or []


def answer_with_rag(symbol: str, quarter: str, user_question: str) -> dict:
    client = get_openai_client()
    chunks = search_chunks(symbol, user_question)
    if not chunks:
        return {"answer": f"No earnings data found for {symbol}. Ingest the PDF first.", "sources": []}

    context = "\n\n---\n\n".join(
        f"[Passage {i+1} — {c['symbol']} {c['quarter']}]\n{c['content']}"
        for i, c in enumerate(chunks)
    )
    prompt = (
        f"Answer using ONLY the earnings call passages below.\n"
        f"Quote relevant parts (under 20 words). Cite passage numbers.\n"
        f"If the answer isn't there, say so.\n\n"
        f"Passages:\n{context}\n\n"
        f"Question: {user_question}"
    )
    resp = client.chat.completions.create(
        model=CHAT_MODEL, max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return {
        "answer":  resp.choices[0].message.content,
        "sources": [{"symbol": c["symbol"], "quarter": c["quarter"],
                     "chunk": c["chunk_index"], "score": round(c.get("similarity", 0), 3),
                     "preview": c["content"][:120] + "..."} for c in chunks],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub    = parser.add_subparsers(dest="cmd")
    ing    = sub.add_parser("ingest")
    ing.add_argument("--symbol", required=True)
    ing.add_argument("--quarter", required=True)
    ing.add_argument("--pdf", required=True)
    srch   = sub.add_parser("search")
    srch.add_argument("--symbol", required=True)
    srch.add_argument("--query",  required=True)
    args   = parser.parse_args()

    if args.cmd == "ingest":
        ingest_pdf(args.symbol, args.quarter, args.pdf)
    elif args.cmd == "search":
        r = answer_with_rag(args.symbol, "", args.query)
        print("\nAnswer:", r["answer"])
        for s in r["sources"]:
            print(f"  [{s['symbol']} {s['quarter']} chunk {s['chunk']}] score={s['score']}")
    else:
        parser.print_help()
