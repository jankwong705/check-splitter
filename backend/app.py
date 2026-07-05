"""FastAPI backend for check-splitter.

Stateless design: the React frontend holds the bill and calls:
  POST /api/ocr        -> upload a receipt image, get parsed items back
  POST /api/calculate  -> send the whole bill, get each person's share + who pays the payer
  GET  /api/health     -> liveness check
"""
import os

from dotenv import load_dotenv
load_dotenv()  # read backend/.env if present

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import Bill, CalculateResult, OcrResult
from logic import compute_payments_to_payer
import ocr

app = FastAPI(title="check-splitter API")

# Allow the Vite dev server + any deployed frontend origins you list in
# ALLOWED_ORIGINS (comma-separated). Defaults cover local dev.
_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"ok": True, "ocr_configured": bool(os.environ.get("GEMINI_API_KEY"))}


@app.post("/api/calculate", response_model=CalculateResult)
def calculate(bill: Bill):
    if not bill.members:
        raise HTTPException(400, "Add at least one member.")
    if not bill.items:
        raise HTTPException(400, "Add at least one item.")
    for it in bill.items:
        for m in it.owed_by:
            if m not in bill.members:
                raise HTTPException(400, f"Item '{it.item_name}' owed by unknown member '{m}'.")
    if bill.payer_paid_everything and not bill.payer:
        raise HTTPException(400, "Select a payer.")

    owed, payer, payments = compute_payments_to_payer(bill)
    return CalculateResult(
        owed=owed,
        payer=payer,
        payments=payments,
        grand_total=round(sum(owed.values()), 2),
    )


@app.post("/api/ocr", response_model=OcrResult)
async def scan_receipt(file: UploadFile = File(...)):
    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(503, "OCR not configured: set GEMINI_API_KEY.")
    mime = file.content_type or "image/jpeg"
    if not mime.startswith("image/"):
        raise HTTPException(400, "Upload an image file.")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file.")
    try:
        return ocr.parse_receipt(data, mime)
    except Exception as e:  # surface a clean error to the frontend
        raise HTTPException(502, f"OCR failed: {e}")
