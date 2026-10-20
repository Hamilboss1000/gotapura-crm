// Envia uma cotação aceite para o software de facturação certificado (AGT) e guarda a referência da factura.
// O payload é genérico; adapte `toProvider` ao fornecedor escolhido (Primavera, PHC, Moloni, Odoo, …).
import { db, json, integration } from "../_shared/db.ts";

function toProvider(provider: string, q: Record<string, unknown>, items: Record<string, unknown>[], cfg: Record<string, string>) {
  const lines = items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price), tax_rate: Number(i.tax_rate) }));
  switch ((provider || "").toLowerCase()) {
    case "odoo":   return { path: "/api/invoices", body: { partner_name: q.customer, lines, ref: `COT-${q.number}` } };
    case "moloni": return { path: "/v1/invoices/insert", body: { customer_name: q.customer, products: lines, document_set: cfg.series } };
    default:       return { path: "/invoices", body: { customer: q.customer, series: cfg.series, currency: q.currency, lines, external_ref: `COT-${q.number}` } };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const { quote_id } = await req.json();
    const cfg = await integration("invoicing");
    const { data: q } = await db.from("quotes").select("*, contacts(first_name,last_name,email,phone), organizations(name,nif)").eq("id", quote_id).single();
    const { data: items } = await db.from("quote_items").select("*").eq("quote_id", quote_id).order("position");
    if (!q) throw new Error("Cotação não encontrada");
    const customer = q.organizations?.name ?? `${q.contacts?.first_name ?? ""} ${q.contacts?.last_name ?? ""}`.trim();
    const { path, body } = toProvider(cfg.provider, { ...q, customer }, items ?? [], cfg);
    const r = await fetch(`${cfg.base_url}${path}`, { method: "POST", headers: { Authorization: `Bearer ${cfg.api_key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.message ?? out.error ?? `HTTP ${r.status}`);
    const external_id = out.id ?? out.invoice_id ?? out.document_id ?? String(Date.now());
    await db.from("invoices").insert({ quote_id, contact_id: q.contact_id, organization_id: q.organization_id, external_id, number: out.number ?? out.name, provider: cfg.provider, issued_at: new Date().toISOString().slice(0, 10), total: q.total, pdf_url: out.pdf_url, raw: out });
    await db.from("quotes").update({ status: "facturada", invoice_external_id: external_id }).eq("id", quote_id);
    return json({ ok: true, external_id });
  } catch (e) { return json({ error: String(e) }, 400); }
});
