

# Bill Split Widget (Jupyter Prototype)

A lightweight Jupyter + ipywidgets prototype for splitting grocery/restaurant receipts with friends/ roommates. Supports manual entry (items, quantity, who owes), extras (tax/tip/fees), a single-payer mode, and per-item weighted splits. Built to validate splitting logic before developing full app UI.

## Demo (local)
This project runs as an interactive Jupyter widget.  
Open `demo.ipynb`, run all cells, then use the UI to add members, add items, adjust splits, and calculate totals.


## Key Features
- **Manual receipt entry**: item name, unit price, quantity, and who owes each item
- **Single payer mode**: one person pays up front, app calculates who pays them back
- **Extras**: tax, tip, fees with **equal** or **proportional** splitting
- **Weighted splits (per item)**: adjust shares for items like groceries (e.g., chicken) and save the split
- **Receipt total check**: enter the receipt total and see if it matches the computed total
- **Save / Load progress**: persist your current bill to JSON so you don’t need to re-enter data

## Example Demo Bill (JSON)
A sample saved bill is included for quick testing:

- `demo_data/my_demo_bill.json`

You can load it in the notebook (after running the helper cells) using:
- Click **Load** in the widget UI  
or
- Run: `bill = load_bill("demo_data/my_demo_bill.json")` then `refresh()`

## How It Works (high level)
1. Each receipt line is stored as an `Item` (name, line total, quantity, owed_by, optional weights).
2. The full receipt is stored as a `Bill` (members, items, tax/tip/fees, payer).
3. Totals are computed by:
   - splitting each item across the people who owe it (equal or weighted if enabled)
   - adding tax/tip/fees either equally or proportional to item subtotals
4. In single payer mode, everyone pays the payer their computed owed amount.

## Run Locally
1. Clone the repo
2. Start Jupyter:
    ''' bash
    jupyter notebook
3. Open `demo.ipynb` and **Run All**


## Roadmap
- Receipt scanning (OCR) → auto-populate items + item_id
- Multi-payer mode
- Better rounding/reconciliation for perfect totals
- Export settlement summary (Venmo/PayPal-ready)



