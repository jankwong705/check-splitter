const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* non-JSON error */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function calculate(bill) {
  const res = await fetch(`${BASE}/api/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bill),
  });
  return handle(res);
}

export async function scanReceipt(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/ocr`, { method: "POST", body: form });
  return handle(res);
}

export async function health() {
  const res = await fetch(`${BASE}/api/health`);
  return handle(res);
}
