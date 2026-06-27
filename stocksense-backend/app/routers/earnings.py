from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from app.services.rag_service import ingest_pdf_bytes, check_earnings_loaded, list_loaded_quarters

router = APIRouter(prefix="/stocks", tags=["earnings"])


@router.post("/{symbol}/earnings")
async def upload_earnings(symbol: str, quarter: str = Form(...), file: UploadFile = File(...)):
    """
    Ingest an earnings call transcript PDF for a stock.
    Example: POST /stocks/INFY/earnings
    Form body:
      quarter: Q4FY25
      file: [binary PDF data]
    """
    # Restrict to PDF only
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files (.pdf) are supported for earnings transcripts."
        )

    # Size check: 10MB limit (10 * 1024 * 1024)
    MAX_SIZE = 10 * 1024 * 1024
    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the size limit of 10MB. Uploaded size: {len(file_bytes) / 1024 / 1024:.2f}MB"
        )

    try:
        chunks_count = ingest_pdf_bytes(symbol.upper(), quarter.upper(), file_bytes)
        return {
            "symbol": symbol.upper(),
            "quarter": quarter.upper(),
            "filename": file.filename,
            "chunks_ingested": chunks_count,
            "status": "success",
            "message": f"Successfully ingested {chunks_count} passages from '{file.filename}'."
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest transcript: {str(e)}")


@router.get("/{symbol}/earnings/status")
async def get_earnings_status(symbol: str):
    """
    Check if a stock symbol has any earnings data loaded and which quarters are available.
    Example: GET /stocks/INFY/earnings/status
    """
    symbol_upper = symbol.upper()
    loaded = check_earnings_loaded(symbol_upper)
    quarters = list_loaded_quarters(symbol_upper) if loaded else []
    return {
        "symbol": symbol_upper,
        "loaded": loaded,
        "quarters": quarters
    }
