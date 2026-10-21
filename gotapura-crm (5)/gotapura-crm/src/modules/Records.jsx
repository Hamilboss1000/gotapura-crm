// Módulo genérico de registos (Contactos, Organizações, Leads, Produtos) guiado por configuração.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { list, save, remove, profiles, fmtMoney, fmtDate } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import Drawer from '../components/Drawer'
import { Form } from '../components/Fields'
import { dial, isPhoneReady } from '../lib/sip'
import Timeline from '../components/Timeline'
import { exportRows } from './Import'

export const MODULES = {
  contacts: {
    table: 'contacts', titleKey: 'contacts', searchCols: ['first_name', 'last_name', 'email', 'phone', 'mobile'],
    select: '*, organizations(name), profiles:owner_id(full_name)',
    display: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim(),
    columns: [
      { key: 'name', label: 'name', render: (r) => `${r.first_name || ''} ${r.last_name || ''}` },
      { key: 'organization', render: (r) => r.organizations?.name || '' },
      { key: 'phone_n', render: (r) => <Tel n={r.mobile || r.phone} /> },
      { key: 'email', render: (r) => r.email },
      { key: 'city', render: (r) => r.city },
      { key: 'owner', render: (r) => r.profiles?.full_name || '' },
    ],
    fields: [
      { key: 'first_name', required: true }, { key: 'last_name' },
      { key: 'organization_id', label: 'organization', type: 'lookup', lookup: 'organizations' }, { key: 'job_title' },
      { key: 'email', type: 'email' }, { key: 'phone', label: 'phone_n' }, { key: 'mobile' }, { key: 'whatsapp', label: 'whatsapp_n' },
      { key: 'address', span: 2 }, { key: 'city' }, { key: 'province' },
      { key: 'source', type: 'select', options: ['website', 'whatsapp', 'telefone', 'referência', 'feira', 'redes sociais', 'outro'] },
      { key: 'language', type: 'select', options: [{ value: 'pt', label: 'Português' }, { value: 'en', label: 'English' }] },
      { key: 'owner_id', label: 'owner', type: 'person' }, { key: 'notes', type: 'textarea', span: 2 },
    ],
  },
  organizations: {
    table: 'organizations', titleKey: 'organizations', searchCols: ['name', 'nif', 'email', 'phone', 'city'],
    select: '*, profiles:owner_id(full_name)', display: (r) => r.name,
    columns: [
      { key: 'name', render: (r) => r.name }, { key: 'category', render: (r) => r.category && <span className="chip grey">{r.category}</span> },
      { key: 'phone_n', render: (r) => <Tel n={r.phone} /> }, { key: 'email', render: (r) => r.email },
      { key: 'city', render: (r) => r.city }, { key: 'owner', render: (r) => r.profiles?.full_name || '' },
    ],
    fields: [
      { key: 'name', required: true }, { key: 'nif' },
      { key: 'category', type: 'select', options: ['cliente', 'potencial', 'fornecedor', 'parceiro'] }, { key: 'industry' },
      { key: 'phone', label: 'phone_n' }, { key: 'email', type: 'email' }, { key: 'website', label: 'website_n' }, { key: 'owner_id', label: 'owner', type: 'person' },
      { key: 'address', span: 2 }, { key: 'city' }, { key: 'province' }, { key: 'notes', type: 'textarea', span: 2 },
    ],
  },
  leads: {
    table: 'leads', titleKey: 'leads', searchCols: ['name', 'organization_name', 'email', 'phone'],
    select: '*, profiles:owner_id(full_name)', display: (r) => r.name,
    columns: [
      { key: 'name', render: (r) => r.name }, { key: 'organization', render: (r) => r.organization_name },
      { key: 'status', render: (r) => <span className={`chip ${r.status === 'convertido' ? 'ok' : r.status === 'perdido' ? 'danger' : ''}`}>{r.status}</span> },
      { key: 'source', render: (r) => r.source }, { key: 'phone_n', render: (r) => <Tel n={r.phone} /> },
      { key: 'estimated_value', render: (r) => fmtMoney(r.estimated_value) }, { key: 'owner', render: (r) => r.profiles?.full_name || '' },
    ],
    fields: [
      { key: 'name', required: true }, { key: 'organization_name', label: 'organization' },
      { key: 'email', type: 'email' }, { key: 'phone', label: 'phone_n' }, { key: 'whatsapp', label: 'whatsapp_n' },
      { key: 'source', type: 'select', options: ['website', 'whatsapp', 'telefone', 'referência', 'feira', 'redes sociais', 'outro'] },
      { key: 'status', type: 'select', options: ['novo', 'contactado', 'qualificado', 'convertido', 'perdido'] },
      { key: 'interest', type: 'select', options: ['filtro doméstico', 'purificador', 'osmose inversa', 'sistema industrial', 'recargas/consumíveis', 'manutenção', 'outro'] },
      { key: 'estimated_value', type: 'number' }, { key: 'owner_id', label: 'owner', type: 'person' },
      { key: 'notes', type: 'textarea', span: 2 },
    ],
  },
  products: {
    table: 'products', titleKey: 'products', searchCols: ['name', 'sku', 'category'], select: '*', display: (r) => r.name,
    columns: [
      { key: 'sku', render: (r) => r.sku }, { key: 'name', render: (r) => r.name }, { key: 'category', render: (r) => r.category },
      { key: 'price', render: (r) => fmtMoney(r.price, r.currency) }, { key: 'stock', render: (r) => r.stock ?? '' },
      { key: 'active', render: (r) => <span className={`chip ${r.active ? 'ok' : 'grey'}`}>{r.active ? '●' : '○'}</span> },
    ],
    fields: [
      { key: 'sku' }, { key: 'name', required: true },
      { key: 'category', type: 'select', options: ['equipamento', 'filtro', 'recarga', 'consumível', 'serviço'] }, { key: 'unit' },
      { key: 'price', type: 'number' }, { key: 'tax', label: 'tax', type: 'number' }, { key: 'stock', type: 'number' }, { key: 'active', type: 'checkbox' },
      { key: 'description', type: 'textarea', span: 2 },
    ],
  },
}

export function Tel({ n }) {
  const { t } = useT()
  if (!n) return null
  return <span className="tel" title={t('call')} onClick={(e) => { e.stopPropagation(); isPhoneReady() ? dial(n) : window.open(`tel:${n}`) }}>{n}</span>
}

export default function Records({ module }) {
  const cfg = MODULES[module]
  const { t } = useT()
  const toast = useToast()
  const nav = useNavigate()
  const { id } = useParams()
  const [rows, setRows] = useState([])
  const [people, setPeople] = useState([])
  const [orgs, setOrgs] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setRows(await list(cfg.table, { select: cfg.select, search, searchCols: cfg.searchCols })) } catch (e) { toast(t('error') + ': ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [module, search])
  useEffect(() => { profiles().then(setPeople); list('organizations', { order: 'name', asc: true }).then((o) => setOrgs(o.map((x) => ({ id: x.id, label: x.name })))) }, [])
  useEffect(() => { if (id && rows.length) { const r = rows.find((x) => x.id === id); if (r) setEditing(r) } }, [id, rows])

  const clean = (r) => { const o = { ...r }; delete o.organizations; delete o.profiles; if (module === 'products' && 'tax' in o) { o.tax_rate = o.tax; delete o.tax } return o }
  const onSave = async () => {
    try { await save(cfg.table, clean(editing)); toast(t('saved')); setEditing(null); nav(`/${module}`); load() } catch (e) { toast(t('error') + ': ' + e.message) }
  }
  const onDelete = async () => {
    if (!confirm(t('confirm_delete'))) return
    try { await remove(cfg.table, editing.id); setEditing(null); nav(`/${module}`); load() } catch (e) { toast(t('error') + ': ' + e.message) }
  }
  const convertLead = async () => {
    const l = editing
    const [first, ...rest] = (l.name || '').split(' ')
    let org = null
    if (l.organization_name) org = await save('organizations', { name: l.organization_name, category: 'potencial', owner_id: l.owner_id })
    const c = await save('contacts', { first_name: first, last_name: rest.join(' '), email: l.email, phone: l.phone, whatsapp: l.whatsapp, source: l.source, owner_id: l.owner_id, organization_id: org?.id, notes: l.notes })
    const { data: st } = await supabase.from('stages').select('id, pipeline_id').eq('pipeline_id', '11111111-1111-1111-1111-111111111111').order('position').limit(1).single()
    const o = await save('opportunities', { name: `${l.interest || 'Oportunidade'} — ${l.name}`, pipeline_id: st?.pipeline_id, stage_id: st?.id, contact_id: c.id, organization_id: org?.id, value: l.estimated_value, owner_id: l.owner_id })
    await save('leads', { id: l.id, status: 'convertido', converted_contact_id: c.id, converted_opportunity_id: o.id })
    toast(t('saved')); setEditing(null); nav('/opportunities')
  }
  const options = useMemo(() => ({ organizations: orgs }), [orgs])
  const editValues = editing && module === 'products' ? { ...editing, tax: editing.tax_rate } : editing

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t(cfg.titleKey)}</h1><span className="muted">{rows.length}</span><div className="spacer" />
        <input className="input" style={{ width: 260 }} placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn" onClick={() => exportRows(rows, module)}>{t('export_excel')}</button>
        <button className="btn primary" onClick={() => setEditing({})}>+ {t('new')}</button>
      </div>
      {loading ? <p className="muted">{t('loading')}</p> : rows.length === 0 ? <div className="empty">{t('empty')}</div> : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr>{cfg.columns.map((c) => <th key={c.key}>{t(c.label || c.key)}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="click" onClick={() => setEditing(r)}>{cfg.columns.map((c) => <td key={c.key}>{c.render(r)}</td>)}</tr>)}</tbody>
        </table></div>
      )}
      {editing && (
        <Drawer title={editing.id ? cfg.display(editing) : t('new')} onClose={() => { setEditing(null); nav(`/${module}`) }}
          footer={<>
            {editing.id && <button className="btn danger" onClick={onDelete}>{t('delete')}</button>}
            {module === 'leads' && editing.id && editing.status !== 'convertido' && <button className="btn aqua" onClick={convertLead}>{t('convert')} →</button>}
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={() => setEditing(null)}>{t('cancel')}</button>
            <button className="btn primary" onClick={onSave}>{t('save')}</button>
          </>}>
          <Form fields={cfg.fields} values={editValues} people={people} options={options} onChange={(k, v) => setEditing((e) => ({ ...e, [k]: v }))} />
          {editing.id && module !== 'products' && <Timeline table={cfg.table} id={editing.id} contactId={module === 'contacts' ? editing.id : null} />}
        </Drawer>
      )}
    </div>
  )
}
