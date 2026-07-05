"""Receipt OCR via a multimodal Gemini model.

We send the receipt image straight to the model (no separate OCR step) and ask
for strict JSON matching our schema. The prompt handles the messy real-world
cases: unclear items, items that aren't taxed, and discounts.

Env vars:
  GEMINI_API_KEY  (required)
  GEMINI_MODEL    (optional) - defaults to "gemini-2.5-flash".
                  Set this to whichever Flash model you want to use; verify the
                  exact model id in Google AI Studio, since names change.
"""
import os
import json

from google import genai
from google.genai import types

from models import OcrResult

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

PROMPT = """You are a receipt parser for a bill-splitting app.
Read the receipt image and return ONLY JSON matching the provided schema.

Rules:
- items: one entry per line item actually purchased. item_price is the LINE
  total (unit price x quantity), not the unit price. Include quantity.
- If a line is blurry, cut off, or you are not confident about the name or
  price, still include your best guess but set "unclear": true.
- taxable: set false for clearly non-taxed items (many groceries, some drinks).
  If you can't tell, default to true.
- tax, tip, fees: pull these from the receipt totals section. Use 0 if absent.
- discount: if the receipt shows a discount/coupon/promo, put the POSITIVE
  amount taken off here. Use 0 if none.
- Do NOT put tax, tip, fees, or discounts into the items list.
- Leave owed_by as an empty list (the user assigns people later).
- bill_name: the store/merchant name if visible.
- notes: if the line items don't reconcile with the printed total, or anything
  looks off, say so briefly here. Otherwise leave empty.
"""


def parse_receipt(image_bytes: bytes, mime_type: str) -> OcrResult:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=DEFAULT_MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=OcrResult,
            temperature=0.0,
        ),
    )

    # The SDK can hand back a parsed object; fall back to raw text if not.
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, OcrResult):
        return parsed
    return OcrResult(**json.loads(response.text))
