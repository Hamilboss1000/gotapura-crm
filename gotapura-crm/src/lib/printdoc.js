// Gera a versão imprimível (PDF via "Guardar como PDF" do navegador) de cotações e facturas pró-forma.
const esc = (s = '') => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export function openPrintDocument({ kind, company, quote, items, customer, fmtMoney, lang = 'pt' }) {
  const L = lang === 'en'
    ? { quote: 'QUOTATION', proforma: 'PRO-FORMA INVOICE', invoice: 'INVOICE', number: 'No.', date: 'Date', valid: 'Valid until', client: 'Client', nif: 'Tax ID', desc: 'Description', qty: 'Qty', unit: 'Unit price', vat: 'VAT', total: 'Total', subtotal: 'Subtotal', notes: 'Notes', print: 'Print / Save as PDF', legal: 'Pro-forma document for information only: it is not a tax invoice. The tax invoice is issued by AGT-certified software.' }
    : { quote: 'COTAÇÃO', proforma: 'FACTURA PRÓ-FORMA', invoice: 'FACTURA', number: 'N.º', date: 'Data', valid: 'Válida até', client: 'Cliente', nif: 'NIF', desc: 'Descrição', qty: 'Qtd.', unit: 'Preço unit.', vat: 'IVA', total: 'Total', subtotal: 'Subtotal', notes: 'Notas', print: 'Imprimir / Guardar como PDF', legal: 'Documento pró-forma, apenas informativo: não constitui factura fiscal. A factura é emitida por software certificado pela AGT.' }
  const title = kind === 'proforma' ? L.proforma : kind === 'invoice' ? L.invoice : L.quote
  const cur = quote.currency || 'AOA'
  const lines = items.map((i) => { const s = Number(i.quantity || 0) * Number(i.unit_price || 0); return { ...i, sub: s, vat: s * Number(i.tax_rate || 0) / 100 } })
  const subtotal = lines.reduce((a, l) => a + l.sub, 0); const vat = lines.reduce((a, l) => a + l.vat, 0)
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${title} ${quote.number || ''}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#13232E;margin:0;padding:32px;font-size:13px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0B3C5D;padding-bottom:16px;margin-bottom:20px}
  .head img{max-height:70px;max-width:220px} .co{font-size:12px;color:#4A5B66;line-height:1.5} .co b{color:#0B3C5D;font-size:16px}
  h1{margin:0 0 6px;font-size:22px;color:#0B3C5D;text-align:right} .meta{text-align:right;font-size:12px;color:#4A5B66;line-height:1.6}
  .client{background:#F3F7F9;border-radius:8px;padding:12px 14px;margin-bottom:18px;line-height:1.5}
  table{width:100%;border-collapse:collapse;margin-bottom:14px} th{background:#0B3C5D;color:#fff;text-align:left;padding:8px 10px;font-size:12px} td{padding:8px 10px;border-bottom:1px solid #DCE5EA;vertical-align:top}
  .r{text-align:right} .totals{margin-left:auto;width:300px} .totals td{padding:5px 10px;border:0} .totals .g td{font-weight:bold;font-size:15px;border-top:2px solid #0B3C5D;color:#0B3C5D}
  .notes{white-space:pre-wrap;color:#4A5B66;font-size:12px;margin-top:16px} .legal{font-size:11px;color:#8A98A1;margin-top:24px;border-top:1px solid #DCE5EA;padding-top:8px}
  .bar{position:fixed;top:0;left:0;right:0;background:#0B3C5D;color:#fff;padding:10px 16px;display:flex;gap:10px;align-items:center} .bar button{background:#1FA2C6;color:#fff;border:0;padding:8px 14px;border-radius:6px;font-size:14px;cursor:pointer}
  @media print{.bar{display:none}body{padding:0}}
</style></head><body>
<div class="bar"><button onclick="window.print()">${L.print}</button><span style="font-size:12px">Na janela de impressão escolha "Guardar como PDF".</span></div>
<div style="height:48px"></div>
<div class="head">
  <div class="co">${company.logo_url ? `<img src="${esc(company.logo_url)}" alt=""><br>` : ''}<b>${esc(company.name)}</b><br>${esc(company.tagline || '')}<br>${esc(company.address || '')}<br>${company.nif ? L.nif + ': ' + esc(company.nif) + '<br>' : ''}${esc(company.phone || '')} ${company.email ? '· ' + esc(company.email) : ''}</div>
  <div><h1>${title}</h1><div class="meta">${L.number} ${esc(quote.number || '—')}<br>${L.date}: ${new Date(quote.created_at || Date.now()).toLocaleDateString('pt-PT')}${quote.valid_until ? '<br>' + L.valid + ': ' + new Date(quote.valid_until).toLocaleDateString('pt-PT') : ''}</div></div>
</div>
<div class="client"><b>${L.client}</b><br>${esc(customer.name || '')}${customer.nif ? '<br>' + L.nif + ': ' + esc(customer.nif) : ''}${customer.address ? '<br>' + esc(customer.address) : ''}${customer.contact ? '<br>' + esc(customer.contact) : ''}${customer.email ? '<br>' + esc(customer.email) : ''}${customer.phone ? ' · ' + esc(customer.phone) : ''}</div>
<table><thead><tr><th>${L.desc}</th><th class="r">${L.qty}</th><th class="r">${L.unit}</th><th class="r">${L.vat}</th><th class="r">${L.total}</th></tr></thead>
<tbody>${lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="r">${Number(l.quantity)}</td><td class="r">${fmtMoney(l.unit_price, cur)}</td><td class="r">${Number(l.tax_rate || 0)}%</td><td class="r">${fmtMoney(l.sub, cur)}</td></tr>`).join('')}</tbody></table>
<table class="totals"><tr><td>${L.subtotal}</td><td class="r">${fmtMoney(subtotal, cur)}</td></tr><tr><td>${L.vat}</td><td class="r">${fmtMoney(vat, cur)}</td></tr><tr class="g"><td>${L.total}</td><td class="r">${fmtMoney(subtotal + vat, cur)}</td></tr></table>
${quote.notes ? `<div class="notes"><b>${L.notes}</b><br>${esc(quote.notes)}</div>` : ''}
${company.quote_footer ? `<div class="notes">${esc(company.quote_footer)}</div>` : ''}
${kind === 'proforma' ? `<div class="legal">${L.legal}</div>` : ''}
</body></html>`
  const w = window.open('', '_blank'); if (!w) return
  w.document.open(); w.document.write(html); w.document.close()
}
