// Projectos (instalações, manutenções, obras) ligados a clientes e oportunidades.
import { useEffect, useState } from 'react'
import { list, save, remove, profiles, fmtDate } from '../lib/api'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import Drawer from '../components/Drawer'
import { Form } from '../components/Fields'
import Timeline from '../components/Timeline'
import TagInput from '../components/TagInput'
import CustomFields from '../components/CustomFields'

export default function Projects() {
  const { t } = useT(); const toast = useToast()
  const [rows, setRows] = useState([]); const [people, setPeople] = useState([]); const [contacts, setContacts] = useState([]); const [orgs, setOrgs] = useState([]); const [editing, setEditing] = useState(null)
  const load = async () => setRows(await list('projects', { select: '*, organizations(name), contacts(first_name,last_name), profiles:owner_id(full_name)' }))
  useEffect(() => { load(); profiles().then(setPeople)
    list('contacts', { order: 'first_name', asc: true }).then((c) => setContacts(c.map((x) => ({ id: x.id, label: `${x.first_name} ${x.last_name || ''}` }))))
    list('organizations', { order: 'name', asc: true }).then((o) => setOrgs(o.map((x) => ({ id: x.id, label: x.name })))) }, [])
  const fields = [
    { key: 'name', required: true, span: 2 },
    { key: 'organization_id', label: 'organization', type: 'lookup', lookup: 'organizations' }, { key: 'contact_id', label: 'contacts', type: 'lookup', lookup: 'contacts' },
    { key: 'status', type: 'select', options: ['em curso', 'concluído', 'cancelado', 'suspenso'] }, { key: 'owner_id', label: 'owner', type: 'person' },
    { key: 'start_date', label: 'today', type: 'date' }, { key: 'due_date', type: 'date' }, { key: 'notes', type: 'textarea', span: 2 },
  ]
  const onSave = async () => { const o = { ...editing }; delete o.organizations; delete o.contacts; delete o.profiles; try { await save('projects', o); toast(t('saved')); setEditing(null); load() } catch (e) { toast(t('error') + ': ' + e.message) } }
  return (
    <div className="page">
      <div className="page-head"><h1>{t('projects')}</h1><div className="spacer" /><button className="btn primary" onClick={() => setEditing({ status: 'em curso' })}>+ {t('new')}</button></div>
      {rows.length === 0 ? <div className="empty">{t('empty')}</div> : (
        <table className="tbl"><thead><tr><th>{t('name')}</th><th>{t('organization')}</th><th>{t('status')}</th><th>{t('due_date')}</th><th>{t('owner')}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="click" onClick={() => setEditing(r)}><td style={{ fontWeight: 500 }}>{r.name}</td><td>{r.organizations?.name}</td><td><span className={`chip ${r.status === 'concluído' ? 'ok' : r.status === 'cancelado' ? 'danger' : ''}`}>{r.status}</span></td><td>{fmtDate(r.due_date)}</td><td>{r.profiles?.full_name}</td></tr>)}</tbody></table>
      )}
      {editing && <Drawer title={editing.id ? editing.name : t('new')} onClose={() => setEditing(null)}
        footer={<>{editing.id && <button className="btn danger" onClick={async () => { if (confirm(t('confirm_delete'))) { await remove('projects', editing.id); setEditing(null); load() } }}>{t('delete')}</button>}<div style={{ flex: 1 }} /><button className="btn" onClick={() => setEditing(null)}>{t('cancel')}</button><button className="btn primary" onClick={onSave}>{t('save')}</button></>}>
        <Form fields={fields} values={editing} people={people} options={{ contacts, organizations: orgs }} onChange={(k, v) => setEditing((e) => ({ ...e, [k]: v }))} />
        <label className="field"><span>{t('tags')}</span><TagInput value={editing.tags || []} onChange={(v) => setEditing((e) => ({ ...e, tags: v }))} /></label>
        <CustomFields module="projects" value={editing.custom} onChange={(v) => setEditing((e) => ({ ...e, custom: v }))} />
        {editing.id && <Timeline table="projects" id={editing.id} contactId={editing.contact_id} />}
      </Drawer>}
    </div>
  )
}
