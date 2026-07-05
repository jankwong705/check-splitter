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

export default function App() {
  const [bill, setBill] = useState(emptyBill);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  const patch = (p) => setBill((b) => ({ ...b, ...p }));

  // ---- members ----
  const [memberInput, setMemberInput] = useState("");
  function addMember() {
    const name = memberInput.trim().replace(/\b\w/g, (c) => c.toUpperCase());
    if (!name || bill.members.includes(name)) return;
    patch({ members: [...bill.members, name] });
    setMemberInput("");
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

  function toggleDraftOwed(name) {
    setDraft((d) => ({
      ...d,
      owed_by: d.owed_by.includes(name)
        ? d.owed_by.filter((m) => m !== name)
        : [...d.owed_by, name],
    }));
  }
  function addItem() {
    if (!bill.members.length || !draft.item_name.trim() || draft.unit_price <= 0) return;
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
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="wrap">
      <h1>🧾 Check Splitter</h1>
      {bill.bill_name && <p className="muted">{bill.bill_name}</p>}
      {error && <div className="banner">{error}</div>}

      {/* 1. Members */}
      <section>
        <h2>1 · Members</h2>
        <div className="row">
          <input
            value={memberInput}
            placeholder="Add a name"
            onChange={(e) => setMemberInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
          />
          <button onClick={addMember}>Add</button>
        </div>
        <div className="chips">
          {bill.members.map((m) => (
            <span className="chip" key={m}>
              {m} <button onClick={() => removeMember(m)}>×</button>
            </span>
          ))}
          {!bill.members.length && <span className="muted">No members yet.</span>}
        </div>
      </section>

      {/* 2. Payer */}
      <section>
        <h2>2 · Who paid?</h2>
        <label className="row">
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
            <option value="">(select payer)</option>
            {bill.members.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </section>

      {/* 3. Items */}
      <section>
        <h2>3 · Items</h2>
        <label className="scan">
          <input type="file" accept="image/*" onChange={onScan} disabled={scanning} />
          {scanning ? "Scanning receipt…" : "📷 Scan a receipt (auto-fill items)"}
        </label>

        <div className="itemform">
          <input
            placeholder="Item name"
            value={draft.item_name}
            onChange={(e) => setDraft({ ...draft, item_name: e.target.value })}
          />
          <input
            type="number" step="0.01" min="0" placeholder="Unit $"
            value={draft.unit_price || ""}
            onChange={(e) => setDraft({ ...draft, unit_price: parseFloat(e.target.value) || 0 })}
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
        <div className="owedpick">
          <span className="muted">Owed by (none = everyone):</span>
          {bill.members.map((m) => (
            <label key={m} className="inline">
              <input
                type="checkbox"
                checked={draft.owed_by.includes(m)}
                onChange={() => toggleDraftOwed(m)}
              />
              {m}
            </label>
          ))}
        </div>

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
                <td className="assign">
                  {bill.members.map((m) => (
                    <button
                      key={m}
                      className={it.owed_by.includes(m) ? "on" : ""}
                      onClick={() => setItemOwed(i, m)}
                    >
                      {m}
                    </button>
                  ))}
                </td>
                <td><button onClick={() => removeItem(i)}>×</button></td>
              </tr>
            ))}
            {!bill.items.length && (
              <tr><td className="muted">No items yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* 4. Extras + calculate */}
      <section>
        <h2>4 · Extras</h2>
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
        <div className="row">
          <button className="primary" onClick={onCalculate}>Calculate</button>
        </div>
      </section>

      {result && (
        <section className="result">
          <h2>Result — total {money(result.grand_total)}</h2>
          <table>
            <thead>
              <tr><th>Person</th><th>Share</th>{result.payer && <th>Owes {result.payer}</th>}</tr>
            </thead>
            <tbody>
              {bill.members.map((m) => (
                <tr key={m}>
                  <td>{m}{m === result.payer && " (paid)"}</td>
                  <td className="num">{money(result.owed[m])}</td>
                  {result.payer && (
                    <td className="num">{m === result.payer ? "—" : money(result.payments[m])}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
