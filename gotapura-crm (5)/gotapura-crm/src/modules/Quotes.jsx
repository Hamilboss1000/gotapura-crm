// Cotações com linhas de produtos, IVA e envio para o software de facturação certificado (Edge Function).
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { list, save, remove, fmtMoney, fmtDate } from '../lib/api'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import Drawer from '../components/Drawer'
import { Form } from '../components/Fields'

export default function Quotes() {
  const { t } = useT(); const toast = useToast()
  const [rows, setRows] = useState([]); const [products, setProducts] = useState([]); const [contacts, setContacts] = useState([]); const [orgs, setOrgs] = useState([]); const [opps, setOpps] = useState([])
  const [editing, setEditing] = useState(null); const [items, setItems] = useState([])
  const load = async () => setRows(await list('quotes', { select: '*, contacts(first_name,last_name), organizations(name)' }))
  useEffect(() => { load()
    list('products', { order: 'name', asc: true, filters: [['active', 'eq', true]] }).then(setProducts)
    list('contacts', { order: 'first_name', asc: true }).then((c) => setContacts(c.map((x) => ({ id: x.id, label: `${x.first_name} ${x.last_name || ''}` }))))
    list('organizations', { order: 'name', asc: true }).then((o) => setOrgs(o.map((x) => ({ id: x.id, label: x.name }))))
    list('opportunities', { order: 'name', asc: true, filters: [['status', 'eq', 'aberta']] }).then((o) => setOpps(o.map((x) => ({ id: x.id, label: x.name })))) }, [])
  const open = async (r) => { setEditing(r); const { data } = r.id ? await supabase.from('quote_items').select('*').eq('quote_id', r.id).order('position') : { data: [] }; setItems(data || []) }
  const fields = [
    { key: 'contact_id', label: 'contacts', type: 'lookup', lookup: 'contacts' }, { key: 'organization_id', label: 'organization', type: 'lookup', lookup: 'organizations' },
    { key: 'opportunity_id', label: 'opportunities', type: 'lookup', lookup: 'opportunities' }, { key: 'valid_until', type: 'date' },
    { key: 'status', type: 'select', options: ['rascunho', 'enviada', 'aceite', 'rejeitada', 'facturada'] },
    { key: 'language', type: 'select', options: [{ value: 'pt', label: 'Português' }, { value: 'en', label: 'English' }] },
    { key: 'notes', type: 'textarea', span: 2 },
  ]
  const totals = items.reduce((a, i) => { const s = Number(i.quantity || 0) * Number(i.unit_price || 0); return { sub: a.sub + s, tax: a.tax + s * Number(i.tax_rate || 0) / 100 } }, { sub: 0, tax: 0 })
  const addItem = (p) => setItems((xs) => [...xs, { product_id: p?.id || null, description: p?.name || '', quantity: 1, unit_price: p?.price || 0, tax_rate: p?.tax_rate ?? 14, position: xs.length }])
  const onSave = async () => {
    try {
      const q = { ...editing }; delete q.contacts; delete q.organizations
      const saved = await save('quotes', { ...q, subtotal: totals.sub, tax: totals.tax, total: totals.sub + totals.tax })
      await supabase.from('quote_items').delete().eq('quote_id', saved.id)
      if (items.length) await supabase.from('quote_items').insert(items.map((i, n) => ({ ...i, id: undefined, quote_id: saved.id, position: n })))
      toast(t('saved')); setEditing(null); load()
    } catch (e) { toast(t('error') + ': ' + e.message) }
  }
  const toInvoicing = async () => { const { error } = await supabase.functions.invoke('invoicing-sync', { body: { quote_id: editing.id } }); toast(error ? t('error') + ': ' + error.message : t('saved')); load() }
  return (
    <div className="page">
      <div className="page-head"><h1>{t('quotes')}</h1><div className="spacer" /><button className="btn primary" onClick={() => open({ status: 'rascunho', language: 'pt', currency: 'AOA' })}>+ {t('new')}</button></div>
      {rows.length === 0 ? <div className="empty">{t('empty')}</div> : (
        <table className="tbl"><thead><tr><th>#</th><th>{t('contacts')}</th><th>{t('organization')}</th><th>{t('status')}</th><th>{t('until')}</th><th>{t('total')}</th><th>Factura</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="click" onClick={() => open(r)}><td>{r.number}</td><td>{r.contacts ? `${r.contacts.first_name} ${r.contacts.last_name || ''}` : ''}</td><td>{r.organizations?.name}</td>
            <td><span className={`chip ${r.status === 'aceite' || r.status === 'facturada' ? 'ok' : r.status === 'rejeitada' ? 'danger' : ''}`}>{r.status}</span></td><td>{fmtDate(r.valid_until)}</td><td>{fmtMoney(r.total, r.currency)}</td><td className="small">{r.invoice_external_id || '—'}</td></tr>)}</tbody></table>
      )}
      {editing && (
        <Drawer title={editing.id ? `${t('quotes')} #${editing.number}` : t('new')} onClose={() => setEditing(null)}
          footer={<>{editing.id && <button className="btn danger" onClick={async () => { if (confirm(t('confirm_delete'))) { await remove('quotes', editing.id); setEditing(null); load() } }}>{t('delete')}</button>}
            {editing.id && editing.status === 'aceite' && <button className="btn aqua" onClick={toInvoicing}>{t('send_to_invoicing')}</button>}<div style={{ flex: 1 }} />
            <button className="btn" onClick={() => setEditing(null)}>{t('cancel')}</button><button className="btn primary" onClick={onSave}>{t('save')}</button></>}>
          <Form fields={fields} values={editing} options={{ contacts, organizations: orgs, opportunities: opps }} onChange={(k, v) => setEditing((e) => ({ ...e, [k]: v }))} />
          <div className="card"><h3>{t('quote_items')}</h3>
            <table className="tbl"><thead><tr><th>{t('description')}</th><th style={{ width: 70 }}>{t('quantity')}</th><th style={{ width: 110 }}>{t('unit_price')}</th><th style={{ width: 70 }}>{t('tax')}</th><th>{t('subtotal')}</th><th></th></tr></thead>
              <tbody>{items.map((i, n) => <tr key={n}>
                <td><input className="input" value={i.description} onChange={(e) => setItems((xs) => xs.map((x, j) => j === n ? { ...x, description: e.target.value } : x))} /></td>
                <td><input className="input" type="number" value={i.quantity} onChange={(e) => setItems((xs) => xs.map((x, j) => j === n ? { ...x, quantity: e.target.value } : x))} /></td>
                <td><input className="input" type="number" value={i.unit_price} onChange={(e) => setItems((xs) => xs.map((x, j) => j === n ? { ...x, unit_price: e.target.value } : x))} /></td>
                <td><input className="input" type="number" value={i.tax_rate} onChange={(e) => setItems((xs) => xs.map((x, j) => j === n ? { ...x, tax_rate: e.target.value } : x))} /></td>
                <td>{fmtMoney(Number(i.quantity) * Number(i.unit_price))}</td><td><button className="btn sm" onClick={() => setItems((xs) => xs.filter((_, j) => j !== n))}>×</button></td></tr>)}</tbody></table>
            <div className="row" style={{ marginTop: 8 }}>
              <select className="input" style={{ width: 260 }} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); if (p) addItem(p); e.target.value = '' }}><option value="">+ {t('products')}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmtMoney(p.price)}</option>)}</select>
              <button className="btn sm" onClick={() => addItem(null)}>+ Linha livre</button><div style={{ flex: 1 }} />
              <div className="small" style={{ textAlign: 'right' }}>{t('subtotal')}: {fmtMoney(totals.sub)}<br />IVA: {fmtMoney(totals.tax)}<br /><strong>{t('total')}: {fmtMoney(totals.sub + totals.tax)}</strong></div>
            </div>
            <p className="small muted">{t('invoicing_hint')}</p>
          </div>
        </Drawer>
      )}
    </div>
  )
}
