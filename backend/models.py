"""Pydantic data models for the check-splitter API.

Mirrors the dataclasses in classes.py / demo.ipynb, with two additions the
receipts-in-the-wild use case needs:
  - Item.taxable  -> some items aren't taxed
  - Item.unclear  -> OCR flags a line it wasn't confident about
  - Bill.discount -> receipt-level discount
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class Item(BaseModel):
    item_name: str
    item_price: float  # LINE total (unit price * quantity)
    owed_by: List[str] = Field(default_factory=list)
    quantity: int = 1
    payer: str = ""
    item_id: Optional[str] = None
    taxable: bool = True     # False -> excluded from proportional tax
    unclear: bool = False    # True -> OCR was uncertain; UI should ask user to confirm


class Bill(BaseModel):
    members: List[str] = Field(default_factory=list)
    items: List[Item] = Field(default_factory=list)
    tax: float = 0.0
    tip: float = 0.0
    fees: float = 0.0
    discount: float = 0.0                 # positive number = amount taken off the bill
    extras_split_mode: str = "equal"      # "equal" | "proportional"
    payer_paid_everything: bool = True
    payer: Optional[str] = None
    bill_name: Optional[str] = None


# ---- API response shapes ----

class CalculateResult(BaseModel):
    owed: dict                 # member -> their share of the bill
    payer: Optional[str]       # who fronted the money (None if not set)
    payments: dict             # member -> amount they owe the payer
    grand_total: float


class OcrResult(BaseModel):
    items: List[Item]
    tax: float = 0.0
    tip: float = 0.0
    fees: float = 0.0
    discount: float = 0.0
    bill_name: Optional[str] = None
    notes: Optional[str] = None   # free-text from the model (e.g. "totals didn't add up")
