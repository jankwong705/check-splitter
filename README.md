# Check Splitter

Split a restaurant/grocery bill by item, with receipt scanning powered by a
multimodal Gemini model. **React + Vite** frontend, **FastAPI (Python)** backend.

Grew out of a Jupyter + ipywidgets prototype (`demo.ipynb`, kept for reference).

## Features

- Assign each item to the people who shared it (none selected = everyone)
- Per-item **taxable** flag, plus bill-level **tax / tip / fees / discount**
- Tax splits proportionally to each person's taxable spend; tip/fees split **equal** or **proportional**
- 📷 **Scan a receipt** → items auto-fill; blurry/uncertain lines are flagged ⚠︎ for you to confirm
- Single-payer mode: tells everyone what they owe the person who paid

## Layout

```
backend/    FastAPI app — models.py, logic.py (split math), ocr.py (Gemini), app.py
frontend/   React + Vite single-page app
demo.ipynb  original ipywidgets prototype (unchanged, kept for reference)
classes.py, members.py, receipt_scan.*   earlier prototype files
```

## Run locally

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # then paste your Gemini key into .env
uvicorn app:app --reload    # http://localhost:8000
```

Get a free Gemini key at https://aistudio.google.com/apikey. **Keep billing
OFF** on the Google project to stay on the free tier. Set `GEMINI_MODEL` in
`.env` to the current Flash model id (verify it in AI Studio — names change).

The app runs without a key; you just can't scan receipts (manual entry still works).

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env         # VITE_API_URL defaults to http://localhost:8000
npm run dev                  # http://localhost:5173
```

## How it works

1. Each receipt line is an `Item` (name, line total, quantity, owed_by, taxable).
2. The receipt is a `Bill` (members, items, tax/tip/fees/discount, payer).
3. The frontend holds the bill in React state; the backend is stateless.
4. **Scan**: `POST /api/ocr` sends the image straight to Gemini, which returns
   structured JSON (items + extras) — OCR and parsing in one call.
5. **Calculate**: `POST /api/calculate` runs the split math in Python and returns
   each person's share and what they owe the payer.

## Deploy

- **Frontend** → GitHub Pages / Netlify / Vercel. `npm run build` → `frontend/dist/`.
  Set `VITE_API_URL` to your deployed backend URL at build time.
- **Backend** → Render / Railway / Fly.io free tier (GitHub Pages can't run Python).
  Set `GEMINI_API_KEY` and `ALLOWED_ORIGINS` (your frontend URL). Start command:
  `uvicorn app:app --host 0.0.0.0 --port $PORT`

> The Gemini API key lives only on the backend — never ship it to the frontend.

## API

| Method | Path             | Body         | Returns                              |
|--------|------------------|--------------|--------------------------------------|
| GET    | `/api/health`    | —            | `{ ok, ocr_configured }`             |
| POST   | `/api/ocr`       | image (form) | parsed items + tax/tip/fees/discount |
| POST   | `/api/calculate` | bill (JSON)  | each person's share + who owes payer |

## Roadmap

- Multi-payer mode
- Rounding reconciliation for penny-perfect totals
- Export settlement summary (Venmo/PayPal-ready)
