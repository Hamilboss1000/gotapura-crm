// Importação em massa a partir de Excel/CSV: contactos, organizações, leads e produtos, com mapeamento de colunas.
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'

const TARGETS = {
  contacts: { fields: ['full_name', 'first_name', 'last_name', 'organization_name', 'job_title', 'email', 'phone', 'mobile', 'whatsapp', 'address', 'city', 'province', 'source', 'notes'], dedupe: ['email', 'mobile', 'phone'] },
  organizations: { fields: ['name', 'nif', 'category', 'industry', 'phone', 'email', 'website', 'address', 'city', 'province', 'notes'], dedupe: ['name', 'nif'] },
  leads: { fields: ['name', 'organization_name', 'email', 'phone', 'whatsapp', 'source', 'status', 'interest', 'estimated_value', 'notes'], dedupe: ['email', 'phone'] },
  products: { fields: ['sku', 'name', 'category', 'unit', 'price', 'tax_rate', 'stock', 'description'], dedupe: ['sku'] },
}
const SYN = {
  full_name: ['nome completo', 'full name', 'cliente', 'contacto'], first_name: ['nome', 'primeiro nome', 'first name', 'first'], last_name: ['apelido', 'sobrenome', 'last name', 'surname', 'last'],
  name: ['nome', 'empresa', 'organização', 'organizacao', 'name', 'company', 'razão social', 'produto', 'designação', 'designacao'],
  organization_name: ['empresa', 'organização', 'organizacao', 'company', 'organization', 'entidade'], job_title: ['função', 'funcao', 'cargo', 'job title', 'title'],
  email: ['email', 'e-mail', 'correio', 'mail'], phone: ['telefone', 'phone', 'tel', 'telefone fixo'], mobile: ['telemóvel', 'telemovel', 'mobile', 'celular', 'cell'], whatsapp: ['whatsapp', 'wa'],
  address: ['morada', 'endereço', 'endereco', 'address', 'rua'], city: ['cidade', 'city', 'município', 'municipio'], province: ['província', 'provincia', 'province', 'estado'],
  source: ['origem', 'source', 'fonte'], notes: ['notas', 'observações', 'observacoes', 'notes', 'obs', 'comentários'], nif: ['nif', 'contribuinte', 'tax id', 'nº contribuinte'],
  category: ['categoria', 'category', 'tipo', 'type'], industry: ['sector', 'setor', 'industry', 'ramo', 'actividade', 'atividade'], website: ['website', 'site', 'web', 'url'],
  status: ['estado', 'status'], interest: ['interesse', 'interest', 'produto de interesse'], estimated_value: ['valor', 'value', 'valor estimado', 'estimated value', 'montante'],
  sku: ['sku', 'referência', 'referencia', 'ref', 'código', 'codigo', 'code'], unit: ['unidade', 'unit', 'un'], price: ['preço', 'preco', 'price', 'pvp'], tax_rate: ['iva', 'tax', 'taxa', 'imposto'], stock: ['stock', 'existências', 'existencias', 'qtd', 'quantidade'],
  description: ['descrição', 'descricao', 'description'],
}
const HEAD = { ...{}, first_name: 'Nome', last_name: 'Apelido', name: 'Nome', organization: 'Organização', organization_name: 'Organização', contact: 'Contacto', stage: 'Fase', owner: 'Responsável', assigned: 'Atribuída a', job_title: 'Função', email: 'E-mail', phone: 'Telefone', mobile: 'Telemóvel', whatsapp: 'WhatsApp', address: 'Morada', city: 'Cidade', province: 'Província', country: 'País', source: 'Origem', status: 'Estado', notes: 'Notas', nif: 'NIF', category: 'Categoria', industry: 'Sector', website: 'Website', interest: 'Interesse', estimated_value: 'Valor estimado', value: 'Valor', currency: 'Moeda', probability: 'Probabilidade', expected_close: 'Fecho previsto', title: 'Título', description: 'Descrição', due_date: 'Data limite', due_time: 'Hora', priority: 'Prioridade', sku: 'Referência', unit: 'Unidade', price: 'Preço', tax_rate: 'IVA %', stock: 'Stock', active: 'Activo', number: 'Nº', valid_until: 'Válida até', subtotal: 'Subtotal', tax: 'IVA', total: 'Total', created_at: 'Criado em', updated_at: 'Actualizado em' }
const SKIP = ['id', 'owner_id', 'organization_id', 'contact_id', 'opportunity_id', 'pipeline_id', 'stage_id', 'assigned_to', 'created_by', 'parent_task_id', 'converted_contact_id', 'converted_opportunity_id', 'linked_table', 'linked_id', 'recurrence', 'reminder_at', 'completed_at', 'invoice_external_id', 'lost_reason', 'language']
export function exportRows(rows, name) {
  const out = rows.map((r) => {
    const o = {}
    Object.entries(r).forEach(([k, v]) => {
      if (SKIP.includes(k)) return
      if (k === 'organizations') o[HEAD.organization] = v?.name || ''
      else if (k === 'contacts') o[HEAD.contact] = v ? `${v.first_name || ''} ${v.last_name || ''}`.trim() : ''
      else if (k === 'stages') o[HEAD.stage] = v?.name || ''
      else if (k === 'profiles') o[name === 'tasks' ? HEAD.assigned : HEAD.owner] = v?.full_name || ''
      else if (Array.isArray(v)) o[HEAD[k] || k] = v.join(', ')
      else if (v && typeof v === 'object') Object.entries(v).forEach(([ck, cv]) => { o[ck] = cv })
      else o[HEAD[k] || k] = v ?? ''
    })
    return o
  })
  const ws = XLSX.utils.json_to_sheet(out); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, ws, 'Dados')
  XLSX.writeFile(book, `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const guess = (header, target) => {
  const h = norm(header)
  const candidates = TARGETS[target].fields.filter((f) => f !== 'full_name' || target === 'contacts')
  const exact = candidates.find((f) => (SYN[f] || []).some((s) => norm(s) === h) || norm(f) === h)
  if (exact) return exact
  // Correspondência parcial: vence o sinónimo mais longo (ex.: "organizacao" antes de "nome")
  let best = '', len = 0
  candidates.forEach((f) => (SYN[f] || []).forEach((s) => { const n = norm(s); if (n.length > len && h.includes(n)) { best = f; len = n.length } }))
  return best
}
const LABELS = { full_name: 'Nome completo (separar em nome + apelido)', first_name: 'Nome', last_name: 'Apelido', organization_name: 'Organização (nome)', job_title: 'Função', email: 'E-mail', phone: 'Telefone', mobile: 'Telemóvel', whatsapp: 'WhatsApp', address: 'Morada', city: 'Cidade', province: 'Província', source: 'Origem', notes: 'Notas', name: 'Nome', nif: 'NIF', category: 'Categoria', industry: 'Sector', website: 'Website', status: 'Estado', interest: 'Interesse', estimated_value: 'Valor estimado', sku: 'Referência', unit: 'Unidade', price: 'Preço', tax_rate: 'IVA %', stock: 'Stock', description: 'Descrição' }

export default function Import() {
  const { t } = useT(); const toast = useToast()
  const [target, setTarget] = useState('contacts'); const [wb, setWb] = useState(null); const [sheet, setSheet] = useState(''); const [rows, setRows] = useState([]); const [headers, setHeaders] = useState([])
  const [map, setMap] = useState({}); const [skipDup, setSkipDup] = useState(true); const [busy, setBusy] = useState(false); const [result, setResult] = useState(null)

  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    const data = await f.arrayBuffer(); const book = XLSX.read(data, { type: 'array' })
    setWb(book); loadSheet(book, book.SheetNames[0]); setResult(null)
  }
  const loadSheet = (book, name) => {
    setSheet(name)
    const json = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: '' })
    const hdr = (json[0] || []).map((h) => String(h).trim()); const body = json.slice(1).filter((r) => r.some((c) => String(c).trim() !== ''))
    setHeaders(hdr); setRows(body)
    const m = {}; hdr.forEach((h, i) => { const g = guess(h, target); if (g && !Object.values(m).includes(g)) m[i] = g }); setMap(m)
  }
  useEffect(() => { if (wb) loadSheet(wb, sheet) }, [target])

  const records = useMemo(() => rows.map((r) => {
    const o = {}
    Object.entries(map).forEach(([i, f]) => { if (!f) return; const v = String(r[i] ?? '').trim(); if (v === '') return
      if (f === 'full_name') { const [first, ...rest] = v.split(/\s+/); o.first_name = o.first_name || first; o.last_name = o.last_name || rest.join(' ') }
      else if (['estimated_value', 'price', 'tax_rate', 'stock'].includes(f)) o[f] = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
      else o[f] = v })
    return o
  }).filter((o) => Object.keys(o).length), [rows, map])

  const run = async () => {
    if (!records.length) return
    setBusy(true); setResult(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const cfg = TARGETS[target]
      // Organizações: cria as que não existem, para ligar contactos e organizações pelo nome
      let orgMap = new Map()
      if (target === 'contacts' || target === 'organizations') {
        const { data: orgs } = await supabase.from('organizations').select('id, name'); (orgs || []).forEach((o) => orgMap.set(norm(o.name), o.id))
      }
      if (target === 'contacts') {
        const missing = [...new Set(records.map((r) => r.organization_name).filter((n) => n && !orgMap.has(norm(n))))]
        if (missing.length) { const { data } = await supabase.from('organizations').insert(missing.map((name) => ({ name, category: 'cliente', owner_id: user.id }))).select('id, name'); (data || []).forEach((o) => orgMap.set(norm(o.name), o.id)) }
      }
      // Duplicados: compara com o que já existe na base de dados
      let existing = new Set()
      if (skipDup) {
        const { data } = await supabase.from(target).select(cfg.dedupe.join(','))
        ;(data || []).forEach((x) => cfg.dedupe.forEach((k) => x[k] && existing.add(norm(x[k]))))
      }
      let inserted = 0, skipped = 0; const errors = []
      const payload = []
      for (const r of records) {
        if (skipDup && cfg.dedupe.some((k) => r[k] && existing.has(norm(r[k])))) { skipped++; continue }
        const o = { ...r }
        if (target === 'contacts') { if (o.organization_name) o.organization_id = orgMap.get(norm(o.organization_name)); delete o.organization_name; if (!o.first_name) o.first_name = o.last_name || '—' }
        if (target === 'organizations' || target === 'leads' || target === 'contacts') o.owner_id = user.id
        if (target === 'organizations' && !o.category) o.category = 'cliente'
        if (target === 'leads' && !o.status) o.status = 'novo'
        if (target === 'products') o.active = true
        cfg.dedupe.forEach((k) => r[k] && existing.add(norm(r[k])))
        payload.push(o)
      }
      for (let i = 0; i < payload.length; i += 200) {
        const batch = payload.slice(i, i + 200)
        const { error } = await supabase.from(target).insert(batch)
        if (error) errors.push(`Linhas ${i + 1}–${i + batch.length}: ${error.message}`); else inserted += batch.length
      }
      setResult({ inserted, skipped, errors })
    } catch (e) { toast(t('error') + ': ' + e.message) }
    setBusy(false)
  }
  const template = () => {
    const cols = TARGETS[target].fields.filter((f) => f !== 'full_name').map((f) => LABELS[f])
    const ws = XLSX.utils.aoa_to_sheet([cols]); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, ws, 'Dados'); XLSX.writeFile(book, `modelo-${target}.xlsx`)
  }
  const used = Object.values(map)
  const [exportTable, setExportTable] = useState('contacts'); const [exporting, setExporting] = useState(false)
  const exportAll = async () => {
    setExporting(true)
    try {
      const sel = { contacts: '*, organizations(name), profiles:owner_id(full_name)', organizations: '*, profiles:owner_id(full_name)', leads: '*, profiles:owner_id(full_name)',
        opportunities: '*, stages(name), contacts(first_name,last_name), organizations(name), profiles:owner_id(full_name)', tasks: '*, profiles:assigned_to(full_name)', products: '*', quotes: '*, contacts(first_name,last_name), organizations(name)' }[exportTable]
      const all = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from(exportTable).select(sel).order('created_at').range(from, from + 999)
        if (error) throw error
        all.push(...(data || [])); if (!data || data.length < 1000) break
      }
      exportRows(all, exportTable)
    } catch (e) { toast(t('error') + ': ' + e.message) }
    setExporting(false)
  }
  return (
    <div className="page">
      <div className="page-head"><h1>{t('import')}</h1><div className="spacer" /><button className="btn" onClick={template}>{t('download_template')}</button></div>
      <div className="card row" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>{t('export')}</h2>
        <select className="input" style={{ width: 200 }} value={exportTable} onChange={(e) => setExportTable(e.target.value)}>{['contacts', 'organizations', 'leads', 'opportunities', 'tasks', 'products', 'quotes'].map((k) => <option key={k} value={k}>{t(k)}</option>)}</select>
        <button className="btn primary" disabled={exporting} onClick={exportAll}>{exporting ? t('loading') : t('export_excel')}</button>
        <span className="small muted">Exporta todos os registos para Excel, com os mesmos títulos usados na importação.</span>
      </div>
      <div className="card">
        <div className="row">
          <label className="field"><span>{t('target')}</span><select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>{Object.keys(TARGETS).map((k) => <option key={k} value={k}>{t(k)}</option>)}</select></label>
          <label className="field"><span>{t('import_file')}</span><input className="input" type="file" accept=".xlsx,.xls,.csv" onChange={onFile} /></label>
          {wb && wb.SheetNames.length > 1 && <label className="field"><span>Folha</span><select className="input" value={sheet} onChange={(e) => loadSheet(wb, e.target.value)}>{wb.SheetNames.map((n) => <option key={n}>{n}</option>)}</select></label>}
          <label className="row small" style={{ alignSelf: 'flex-end' }}><input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} /> {t('skip_duplicates')}</label>
        </div>
        <p className="small muted">Aceita Excel (.xlsx, .xls) e CSV. A primeira linha deve conter os títulos das colunas; as colunas são reconhecidas automaticamente e pode corrigir o mapeamento abaixo.</p>
      </div>
      {headers.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <h2>{t('mapping')} <span className="muted small">— {rows.length} linhas</span></h2>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>{t('column')}</th><th>Exemplo</th><th>{t('field')}</th></tr></thead>
            <tbody>{headers.map((h, i) => <tr key={i}><td style={{ fontWeight: 500 }}>{h || `(coluna ${i + 1})`}</td><td className="small muted">{String(rows[0]?.[i] ?? '')}</td>
              <td><select className="input" value={map[i] || ''} onChange={(e) => setMap((m) => ({ ...m, [i]: e.target.value }))}>
                <option value="">{t('ignore')}</option>
                {TARGETS[target].fields.map((f) => <option key={f} value={f} disabled={used.includes(f) && map[i] !== f}>{LABELS[f]}</option>)}
              </select></td></tr>)}</tbody>
          </table></div>
          <h3 style={{ marginTop: 14 }}>{t('preview')}</h3>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>{used.filter(Boolean).map((f) => <th key={f}>{LABELS[f]}</th>)}</tr></thead>
            <tbody>{records.slice(0, 5).map((r, n) => <tr key={n}>{used.filter(Boolean).map((f) => <td key={f} className="small">{f === 'full_name' ? `${r.first_name || ''} ${r.last_name || ''}` : String(r[f] ?? '')}</td>)}</tr>)}</tbody>
          </table></div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={busy || !records.length} onClick={run}>{busy ? t('loading') : `${t('start_import')} (${records.length})`}</button>
            {result && <span className={`chip ${result.errors.length ? 'warn' : 'ok'}`}>{result.inserted} {t('imported')} · {result.skipped} {t('skipped')}</span>}
          </div>
          {result?.errors.map((e, i) => <div key={i} className="notice err small" style={{ marginTop: 6 }}>{e}</div>)}
        </div>
      )}
    </div>
  )
}
