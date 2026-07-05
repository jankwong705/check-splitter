import { useState } from "react";
import { calculate, scanReceipt } from "./api.js";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const emptyBill = {
  members: [],
  items: [],
  tax: 0,
  tip: 0,
  fees: 0,
  discount: 0,
  extras_split_mode: "equal",
  payer_paid_everything: true,
  payer: null,
  bill_name: null,
};

const STEPS = ["Members", "Scan", "Assign", "Results"];

export default function App() {
  const [bill, setBill] = useState(emptyBill);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  const patch = (p) => setBill((b) => ({ ...b, ...p }));

  // ---- members ----
  const [memberInput, setMemberInput] = useState("");
  const [memberErr, setMemberErr] = useState("");
  function addMember() {
    const name = memberInput.trim().replace(/\b\w/g, (c) => c.toUpperCase());
    if (!name) {
      setMemberErr("Enter a name.");
      return;
    }
    if (bill.members.includes(name)) {
      setMemberErr(`${name} is already added.`);
      return;
    }
    patch({ members: [...bill.members, name] });
    setMemberInput("");
    setMemberErr("");
  }
  function removeMember(name) {
    setBill((b) => ({
      ...b,
      members: b.members.filter((m) => m !== name),
      items: b.items.map((it) => ({
        ...it,
        owed_by: it.owed_by.filter((m) => m !== name),
      })),
      payer: b.payer === name ? null : b.payer,
    }));
  }

  // ---- items ----
  const blankItem = { item_name: "", unit_price: 0, quantity: 1, owed_by: [], taxable: true };
  const [draft, setDraft] = useState(blankItem);
  const [itemErr, setItemErr] = useState({}); // { name?: true, price?: true }

  function toggleDraftOwed(name) {
    setDraft((d) => ({
      ...d,
      owed_by: d.owed_by.includes(name)
        ? d.owed_by.filter((m) => m !== name)
        : [...d.owed_by, name],
    }));
  }
  function addItem() {
    const errs = {};
    if (!draft.item_name.trim()) errs.name = true;
    if (!(draft.unit_price > 0)) errs.price = true;
    if (Object.keys(errs).length) {
      setItemErr(errs);
      return;
    }
    setItemErr({});
    const owed = draft.owed_by.length ? draft.owed_by : [...bill.members];
    const item = {
      item_name: draft.item_name.trim(),
      item_price: Number((draft.unit_price * draft.quantity).toFixed(2)),
      quantity: draft.quantity,
      owed_by: owed,
      taxable: draft.taxable,
      unclear: false,
    };
    patch({ items: [...bill.items, item] });
    setDraft(blankItem);
  }
  function removeItem(idx) {
    patch({ items: bill.items.filter((_, i) => i !== idx) });
  }
  function setItemOwed(idx, name) {
    setBill((b) => {
      const items = b.items.map((it, i) => {
        if (i !== idx) return it;
        const owed_by = it.owed_by.includes(name)
          ? it.owed_by.filter((m) => m !== name)
          : [...it.owed_by, name];
        return { ...it, owed_by };
      });
      return { ...b, items };
    });
  }

  // ---- receipt scan ----
  async function onScan(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setScanning(true);
    try {
      const r = await scanReceipt(file);
      const items = (r.items || []).map((it) => ({
        item_name: it.item_name,
        item_price: it.item_price,
        quantity: it.quantity || 1,
        owed_by: [], // user assigns
        taxable: it.taxable !== false,
        unclear: !!it.unclear,
      }));
      patch({
        items: [...bill.items, ...items],
        tax: r.tax || bill.tax,
        tip: r.tip || bill.tip,
        fees: r.fees || bill.fees,
        discount: r.discount || bill.discount,
        bill_name: r.bill_name || bill.bill_name,
      });
      if (r.notes) setError(`Scan note: ${r.notes}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  // ---- calculate ----
  async function onCalculate() {
    setError("");
    setResult(null);
    try {
      const res = await calculate(bill);
      setResult(res);
      setStep(3);
    } catch (err) {
      setError(err.message);
    }
  }

  function reset() {
    setBill(emptyBill);
    setResult(null);
    setError("");
    setDraft(blankItem);
    setStep(0);
  }

  // ---- step guards ----
  const canLeaveMembers = bill.members.length > 0 && (!bill.payer_paid_everything || bill.payer);
  const canLeaveScan = bill.items.length > 0;
  const allAssigned = bill.items.every((it) => it.owed_by.length > 0);

  function next() {
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="app">
      <header className="head">
        <h1>Check Splitter</h1>
        {bill.bill_name && <p className="muted">{bill.bill_name}</p>}
      </header>

      <nav className="steps" aria-label="Progress">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
          >
            <span className="dot">{i < step ? "✓" : i + 1}</span>
            <span className="label">{label}</span>
          </div>
        ))}
      </nav>

      {error && <div className="banner">{error}</div>}

      {/* ---- STEP 1: MEMBERS ---- */}
      {step === 0 && (
        <section className="pane">
          <h2>Who's splitting?</h2>
          <div className="row">
            <input
              className={memberErr ? "invalid" : ""}
              value={memberInput}
              placeholder="Add a name"
              onChange={(e) => { setMemberInput(e.target.value); setMemberErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
            />
            <button onClick={addMember}>Add</button>
          </div>
          {memberErr && <p className="field-err">{memberErr}</p>}
          <div className="chips">
            {bill.members.map((m) => (
              <span className="chip" key={m}>
                {m} <button onClick={() => removeMember(m)}>×</button>
              </span>
            ))}
            {!bill.members.length && <span className="muted">No one yet.</span>}
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={bill.payer_paid_everything}
              onChange={(e) => patch({ payer_paid_everything: e.target.checked })}
            />
            One person paid the whole bill
          </label>
          {bill.payer_paid_everything && (
            <select
              value={bill.payer || ""}
              onChange={(e) => patch({ payer: e.target.value || null })}
            >
              <option value="">Who paid?</option>
              {bill.members.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}

          <div className="nav">
            <span />
            <button className="primary" onClick={next} disabled={!canLeaveMembers}>
              Next
            </button>
          </div>
        </section>
      )}

      {/* ---- STEP 2: SCAN / ADD ITEMS ---- */}
      {step === 1 && (
        <section className="pane">
          <h2>Add the receipt</h2>
          <label className="scan">
            <input type="file" accept="image/*" onChange={onScan} disabled={scanning} />
            {scanning ? "Scanning receipt…" : "📷 Scan a receipt"}
          </label>

          <p className="muted center">or add items by hand</p>

          <div className="itemform">
            <input
              className={itemErr.name ? "invalid" : ""}
              placeholder="Item name"
              value={draft.item_name}
              onChange={(e) => { setDraft({ ...draft, item_name: e.target.value }); setItemErr({ ...itemErr, name: false }); }}
            />
            <input
              className={itemErr.price ? "invalid" : ""}
              type="number" step="0.01" min="0" placeholder="Unit $"
              value={draft.unit_price || ""}
              onChange={(e) => { setDraft({ ...draft, unit_price: parseFloat(e.target.value) || 0 }); setItemErr({ ...itemErr, price: false }); }}
            />
            <input
              type="number" min="1" placeholder="Qty"
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: parseInt(e.target.value) || 1 })}
            />
            <label className="inline">
              <input
                type="checkbox"
                checked={draft.taxable}
                onChange={(e) => setDraft({ ...draft, taxable: e.target.checked })}
              />
              taxable
            </label>
            <button onClick={addItem} disabled={!bill.members.length}>Add item</button>
          </div>
          {(itemErr.name || itemErr.price) && (
            <p className="field-err">
              {itemErr.name && itemErr.price
                ? "Enter an item name and a price above 0."
                : itemErr.name
                ? "Enter an item name."
                : "Enter a price above 0."}
            </p>
          )}

          <table className="items">
            <tbody>
              {bill.items.map((it, i) => (
                <tr key={i} className={it.unclear ? "unclear" : ""}>
                  <td>
                    {it.item_name} {it.quantity > 1 && <span className="muted">×{it.quantity}</span>}
                    {it.unclear && <span className="flag" title="OCR unsure — please check"> ⚠︎</span>}
                    {!it.taxable && <span className="muted"> (no tax)</span>}
                  </td>
                  <td className="num">{money(it.item_price)}</td>
                  <td><button onClick={() => removeItem(i)}>×</button></td>
                </tr>
              ))}
              {!bill.items.length && (
                <tr><td className="muted">No items yet.</td></tr>
              )}
            </tbody>
          </table>

          <div className="nav">
            <button onClick={back}>Back</button>
            <button className="primary" onClick={next} disabled={!canLeaveScan}>
              Next
            </button>
          </div>
        </section>
      )}

      {/* ---- STEP 3: ASSIGN ---- */}
      {step === 2 && (
        <section className="pane">
          <h2>Who ordered what?</h2>
          <p className="muted">Tap a name to assign the item to them.</p>
          <div className="legend">
            <span className="assign"><button className="on" type="button" tabIndex={-1}>✓ assigned</button></span>
            <span className="assign"><button type="button" tabIndex={-1}>not assigned</button></span>
          </div>
          <table className="items">
            <tbody>
              {bill.items.map((it, i) => (
                <tr key={i} className={it.owed_by.length ? "" : "unassigned"}>
                  <td>
                    {it.item_name}{" "}
                    <span className="muted num">{money(it.item_price)}</span>
                  </td>
                  <td className="assign">
                    {bill.members.map((m) => {
                      const on = it.owed_by.includes(m);
                      return (
                        <button
                          key={m}
                          className={on ? "on" : ""}
                          aria-pressed={on}
                          onClick={() => setItemOwed(i, m)}
                        >
                          {on ? "✓ " : ""}{m}
                        </button>
                      );
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* extras */}
          <details className="extras-box">
            <summary>Tax, tip &amp; fees</summary>
            <div className="extras">
              {["tax", "tip", "fees", "discount"].map((k) => (
                <label key={k} className="inline">
                  {k}
                  <input
                    type="number" step="0.01" min="0"
                    value={bill[k] || ""}
                    onChange={(e) => patch({ [k]: parseFloat(e.target.value) || 0 })}
                  />
                </label>
              ))}
            </div>
            <label className="inline">
              Tip/fees split:
              <select
                value={bill.extras_split_mode}
                onChange={(e) => patch({ extras_split_mode: e.target.value })}
              >
                <option value="equal">equal</option>
                <option value="proportional">proportional</option>
              </select>
            </label>
          </details>

          <div className="nav">
            <button onClick={back}>Back</button>
            <button className="primary" onClick={onCalculate} disabled={!allAssigned}>
              See results
            </button>
          </div>
          {!allAssigned && <p className="muted center small">Assign every item to continue.</p>}
        </section>
      )}

      {/* ---- STEP 4: RESULTS ---- */}
      {step === 3 && result && (
        <section className="pane result">
          <h2>Total {money(result.grand_total)}</h2>
          {result.payer && <p className="muted">Everyone owes {result.payer}</p>}
          <table>
            <thead>
              <tr><th>Person</th><th className="num">Share</th>{result.payer && <th className="num">Owes</th>}</tr>
            </thead>
            <tbody>
              {bill.members.map((m) => (
                <tr key={m}>
                  <td>{m}{m === result.payer && " (paid)"}</td>
                  <td className="num">{money(result.owed[m])}</td>
                  {result.payer && (
                    <td className="num owes">{m === result.payer ? "—" : money(result.payments[m])}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="nav">
            <button onClick={back}>Back</button>
            <button className="primary" onClick={reset}>New bill</button>
          </div>
        </section>
      )}
    </div>
  );
}
