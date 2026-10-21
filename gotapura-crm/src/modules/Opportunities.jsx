// Pipeline de vendas em Kanban, com arrastar e largar entre fases.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { list, save, remove, profiles, fmtDate } from '../lib/api'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import Drawer from '../components/Drawer'
import { Form } from '../components/Fields'
import Timeline from '../components/Timeline'
import TagInput from '../components/TagInput'
import CustomFields from '../components/CustomFields'
import { useSettings } from '../lib/settings'
import { exportRows } from './Import'

const PIPELINE = '11111111-1111-1111-1111-111111111111'

export default function Opportunities() {
  const { t } = useT(); const toast = useToast(); const { currencies, base, fmtMoney, toBase } = useSettings()
  const [stages, setStages] = useState([]); const [rows, setRows] = useState([])
  const [people, setPeople] = useState([]); const [contacts, setContacts] = useState([]); const [orgs, setOrgs] = useState([])
  const [editing, setEditing] = useState(null); const [over, setOver] = useState(null); const [view, setView] = useState('kanban')

  const load = async () => {
    const { data: st } = await supabase.from('stages').select('*').eq('pipeline_id', PIPELINE).order('position')
    setStages(st || [])
    setRows(await list('opportunities', { select: '*, contacts(first_name,last_name), organizations(name), profiles:owner_id(full_name)', order: 'updated_at' }))
  }
  useEffect(() => { load(); profiles().then(setPeople)
    list('contacts', { order: 'first_name', asc: true }).then((c) => setContacts(c.map((x) => ({ id: x.id, label: `${x.first_name} ${x.last_name || ''}` }))))
    list('organizations', { order: 'name', asc: true }).then((o) => setOrgs(o.map((x) => ({ id: x.id, label: x.name })))) }, [])

  const fields = [
    { key: 'name', required: true, span: 2 },
    { key: 'stage_id', label: 'stage', type: 'select', options: stages.map((s) => ({ value: s.id, label: s.name })) },
    { key: 'value', type: 'number' }, { key: 'currency', type: 'select', options: currencies.map((c) => ({ value: c.code, label: `${c.code} (${c.symbol})` })) },
    { key: 'contact_id', label: 'contacts', type: 'lookup', lookup: 'contacts' }, { key: 'organization_id', label: 'organization', type: 'lookup', lookup: 'organizations' },
    { key: 'expected_close', type: 'date' }, { key: 'probability', type: 'number' },
    { key: 'owner_id', label: 'owner', type: 'person' },
    { key: 'status', type: 'select', options: ['aberta', 'ganha', 'perdida', 'suspensa'] },
    { key: 'notes', type: 'textarea', span: 2 },
  ]
  const moveTo = async (opp, stage) => {
    const status = stage.is_won ? 'ganha' : stage.is_lost ? 'perdida' : 'aberta'
    await save('opportunities', { id: opp.id, stage_id: stage.id, status, probability: stage.probability }); load()
  }
  const onSave = async () => {
    const o = { ...editing }; delete o.contacts; delete o.organizations; delete o.profiles
    if (!o.pipeline_id) o.pipeline_id = PIPELINE
    if (!o.stage_id) o.stage_id = stages[0]?.id
    try { await save('opportunities', o); toast(t('saved')); setEditing(null); load() } catch (e) { toast(t('error') + ': ' + e.message) }
  }
  const onDelete = async () => { if (confirm(t('confirm_delete'))) { await remove('opportunities', editing.id); setEditing(null); load() } }
  const totals = useMemo(() => {
    const open = rows.filter((r) => r.status === 'aberta')
    return { open: open.length, value: open.reduce((s, r) => s + toBase(r.value, r.currency), 0), won: rows.filter((r) => r.status === 'ganha').length, lost: rows.filter((r) => r.status === 'perdida').length }
  }, [rows])

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('opportunities')}</h1>
        <span className="chip">{totals.open} {t('open_opps').toLowerCase()} · {fmtMoney(totals.value)}</span>
        <span className="chip ok">{totals.won} {t('won').toLowerCase()}</span><span className="chip danger">{totals.lost} {t('lost').toLowerCase()}</span>
        <div className="spacer" />
        <div className="tabs" style={{ margin: 0, border: 0 }}><button className={view === 'kanban' ? 'on' : ''} onClick={() => setView('kanban')}>Kanban</button><button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>Lista</button></div>
        <button className="btn" onClick={() => exportRows(rows, 'opportunities')}>{t('export_excel')}</button>
        <button className="btn primary" onClick={() => setEditing({ status: 'aberta', currency: base.code, tags: [], custom: {} })}>+ {t('new')}</button>
      </div>
      {view === 'kanban' ? (
        <div className="kanban">
          {stages.map((s) => {
            const cards = rows.filter((r) => r.stage_id === s.id)
            const sum = cards.reduce((a, r) => a + toBase(r.value, r.currency), 0)
            return (
              <div key={s.id} className={`col ${over === s.id ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(s.id) }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { e.preventDefault(); setOver(null); const o = rows.find((r) => r.id === e.dataTransfer.getData('id')); if (o && o.stage_id !== s.id) moveTo(o, s) }}>
                <h3 className={s.is_won ? 'won' : s.is_lost ? 'lost' : ''}><span>{s.name} <span className="muted small">{cards.length}</span></span><span className="small muted">{fmtMoney(sum)}</span></h3>
                {cards.map((r) => (
                  <div key={r.id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('id', r.id)} onClick={() => setEditing(r)}>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="small muted">{r.organizations?.name || (r.contacts ? `${r.contacts.first_name} ${r.contacts.last_name || ''}` : '')}</div>
                    <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}><span className="v">{fmtMoney(r.value, r.currency)}</span><span className="small muted">{fmtDate(r.expected_close)}</span></div>
                    {r.profiles?.full_name && <div className="small muted">{r.profiles.full_name}</div>}
                  </div>
                ))}
              </div>)
          })}
        </div>
      ) : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>{t('name')}</th><th>{t('stage')}</th><th>{t('organization')}</th><th>{t('value')}</th><th>{t('expected_close')}</th><th>{t('owner')}</th><th>{t('status')}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="click" onClick={() => setEditing(r)}>
            <td>{r.name}</td><td>{stages.find((s) => s.id === r.stage_id)?.name}</td><td>{r.organizations?.name}</td><td>{fmtMoney(r.value, r.currency)}</td><td>{fmtDate(r.expected_close)}</td><td>{r.profiles?.full_name}</td><td><span className={`chip ${r.status === 'ganha' ? 'ok' : r.status === 'perdida' ? 'danger' : ''}`}>{r.status}</span></td></tr>)}</tbody>
        </table></div>
      )}
      {editing && (
        <Drawer title={editing.id ? editing.name : t('new')} onClose={() => setEditing(null)}
          footer={<>{editing.id && <button className="btn danger" onClick={onDelete}>{t('delete')}</button>}<div style={{ flex: 1 }} /><button className="btn" onClick={() => setEditing(null)}>{t('cancel')}</button><button className="btn primary" onClick={onSave}>{t('save')}</button></>}>
          <Form fields={fields} values={editing} people={people} options={{ contacts, organizations: orgs }} onChange={(k, v) => setEditing((e) => ({ ...e, [k]: v }))} />
          <label className="field"><span>{t('tags')}</span><TagInput value={editing.tags || []} onChange={(v) => setEditing((e) => ({ ...e, tags: v }))} /></label>
          <CustomFields module="opportunities" value={editing.custom} onChange={(v) => setEditing((e) => ({ ...e, custom: v }))} />
          {editing.id && <Timeline table="opportunities" id={editing.id} contactId={editing.contact_id} />}
        </Drawer>
      )}
    </div>
  )
}
