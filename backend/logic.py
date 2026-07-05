"""Split math. Stateless: takes a Bill, returns numbers.

Ported from demo.ipynb's compute_owed_subtotals / compute_payments_to_payer,
extended to handle per-item `taxable` and a bill-level `discount`.
"""
from typing import Tuple, Optional, Dict
from models import Bill


def _round_cents(x: float) -> float:
    return round(x + 1e-9, 2)


def compute_owed_subtotals(bill: Bill) -> Dict[str, float]:
    """Return {member: total_owed} including their share of extras/discount."""
    members = bill.members
    owed = {m: 0.0 for m in members}
    # Track the taxable-only subtotal per member for proportional tax.
    taxable_base = {m: 0.0 for m in members}

    for it in bill.items:
        group = it.owed_by if it.owed_by else members
        if not group:
            continue
        share = it.item_price / len(group)
        for m in group:
            if m in owed:
                owed[m] += share
                if it.taxable:
                    taxable_base[m] += share

    # Tax splits proportionally to each member's TAXABLE spend (that's how real
    # receipts work). Tip/fees follow extras_split_mode. Discount reduces the
    # bill proportionally to each member's overall spend.
    tax = float(bill.tax)
    tip_fees = float(bill.tip) + float(bill.fees)
    discount = float(bill.discount)

    if members:
        # --- tax (proportional to taxable spend) ---
        if tax > 0:
            tb = sum(taxable_base.values())
            if tb <= 1e-9:
                per = tax / len(members)
                for m in members:
                    owed[m] += per
            else:
                for m in members:
                    owed[m] += tax * (taxable_base[m] / tb)

        # --- tip + fees ---
        if tip_fees > 0:
            if bill.extras_split_mode == "proportional":
                base = sum(owed.values())
                if base <= 1e-9:
                    per = tip_fees / len(members)
                    for m in members:
                        owed[m] += per
                else:
                    snapshot = dict(owed)
                    for m in members:
                        owed[m] += tip_fees * (snapshot[m] / base)
            else:  # equal
                per = tip_fees / len(members)
                for m in members:
                    owed[m] += per

        # --- discount (proportional to spend so far) ---
        if discount > 0:
            base = sum(owed.values())
            if base > 1e-9:
                snapshot = dict(owed)
                for m in members:
                    owed[m] -= discount * (snapshot[m] / base)

    return {m: _round_cents(v) for m, v in owed.items()}


def compute_payments_to_payer(
    bill: Bill,
) -> Tuple[Dict[str, float], Optional[str], Dict[str, float]]:
    """Return (owed, payer, payments) where payments[m] is what m owes the payer."""
    owed = compute_owed_subtotals(bill)
    payer = bill.payer
    if not payer:
        return owed, None, {}
    payments = {m: (0.0 if m == payer else owed[m]) for m in owed}
    return owed, payer, payments
