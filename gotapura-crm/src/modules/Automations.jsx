// Editor de automações: quando [tabela] [é criado/actualizado] e [condições] → [acções]. Executadas na base de dados.
import { useEffect, useState } from 'react'
import { list, save, remove, profiles, fmtDateTime } from '../lib/api'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import Drawer from '../components/Drawer'

const TABLES = ['leads', 'contacts', 'organizations', 'opportunities', 'tasks', 'projects']
const FIELDS = { leads: ['status', 'source', 'interest', 'owner_id', 'estimated_value'], contacts: ['city', 'source', 'owner_id'], organizations: ['category', 'city', 'owner_id'],
  opportunities: ['status', 'stage_id', 'value', 'owner_id', 'expected_close'], tasks: ['status', 'priority', 'category', 'assigned_to'], projects: ['status', 'owner_id'] }
const OPS = ['eq', 'neq', 'contains', 'empty', 'not_empty', 'changed']
const ACTIONS = ['create_task', 'set_field', 'notify', 'log_activity']

export default function Automations() {
  const { t } = useT(); const toast = useToast()
  const [rows, setRows] = useState([]); const [logs, setLogs] = useState([]); const [people, setPeople] = useState([]); const [editing, setEditing] = useState(null)
  const load = async () => { setRows(await list('automations')); setLogs(await list('automation_logs', { select: '*, automations(name)', limit: 30 })) }
  useEffect(() => { load(); profiles().then(setPeople) }, [])
  const onSave = async () => { try { await save('automations', editing); toast(t('saved')); setEditing(null); load() } catch (e) { toast(t('error') + ': ' + e.message) } }
  const upd = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const updArr = (k, i, patch) => upd(k, editing[k].map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const delArr = (k, i) => upd(k, editing[k].filter((_, j) => j !== i))
  return (
    <div className="page">
      <div className="page-head"><h1>{t('automations')}</h1><div className="spacer" /><button className="btn primary" onClick={() => setEditing({ name: '', trigger_table: 'leads', trigger_event: 'update', conditions: [], actions: [], active: true })}>+ {t('new')}</button></div>
      {rows.length === 0 ? <div className="empty">{t('empty')}</div> : (
        <table className="tbl"><thead><tr><th>{t('name')}</th><th>{t('trigger')}</th><th>{t('conditions')}</th><th>{t('actions')}</th><th>{t('active')}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="click" onClick={() => setEditing(r)}>
            <td style={{ fontWeight: 500 }}>{r.name}</td><td>{t(r.trigger_table)} {t(r.trigger_event === 'insert' ? 'on_insert' : 'on_update')}</td>
            <td className="small">{r.conditions.map((c, i) => <div key={i}>{c.field} {c.op} {c.value}</div>)}</td>
            <td className="small">{r.actions.map((a, i) => <div key={i}>{a.type}{a.title ? ': ' + a.title : a.message ? ': ' + a.message : a.field ? `: ${a.field} = ${a.value}` : ''}</div>)}</td>
            <td><span className={`chip ${r.active ? 'ok' : 'grey'}`}>{r.active ? '●' : '○'}</span></td></tr>)}</tbody></table>
      )}
      <div className="card" style={{ marginTop: 16 }}><h2>{t('run_log')}</h2>
        {logs.map((l) => <div key={l.id} className="small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}><span className={`chip ${l.ok ? 'ok' : 'danger'}`}>{l.ok ? 'OK' : 'ERRO'}</span> {l.automations?.name} · {l.record_table} <span className="muted">· {fmtDateTime(l.created_at)} {l.detail}</span></div>)}
        {logs.length === 0 && <p className="muted">—</p>}</div>
      {editing && (
        <Drawer title={editing.id ? editing.name : t('new')} onClose={() => setEditing(null)}
          footer={<>{editing.id && <button className="btn danger" onClick={async () => { if (confirm(t('confirm_delete'))) { await remove('automations', editing.id); setEditing(null); load() } }}>{t('delete')}</button>}<div style={{ flex: 1 }} /><button className="btn" onClick={() => setEditing(null)}>{t('cancel')}</button><button className="btn primary" onClick={onSave}>{t('save')}</button></>}>
          <label className="field"><span>{t('name')}</span><input className="input" value={editing.name} onChange={(e) => upd('name', e.target.value)} /></label>
          <div className="row"><span>{t('when')}</span>
            <select className="input" style={{ width: 180 }} value={editing.trigger_table} onChange={(e) => upd('trigger_table', e.target.value)}>{TABLES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select>
            <select className="input" style={{ width: 160 }} value={editing.trigger_event} onChange={(e) => upd('trigger_event', e.target.value)}><option value="insert">{t('on_insert')}</option><option value="update">{t('on_update')}</option></select>
            <label className="row small"><input type="checkbox" checked={editing.active} onChange={(e) => upd('active', e.target.checked)} /> {t('active')}</label></div>
          <div className="card"><h3>{t('conditions')}</h3>
            {editing.conditions.map((c, i) => <div key={i} className="row" style={{ marginBottom: 6 }}>
              <select className="input" style={{ width: 150 }} value={c.field} onChange={(e) => updArr('conditions', i, { field: e.target.value })}>{(FIELDS[editing.trigger_table] || []).map((f) => <option key={f}>{f}</option>)}</select>
              <select className="input" style={{ width: 120 }} value={c.op} onChange={(e) => updArr('conditions', i, { op: e.target.value })}>{OPS.map((o) => <option key={o}>{o}</option>)}</select>
              {!['empty', 'not_empty', 'changed'].includes(c.op) && <input className="input" style={{ width: 160 }} value={c.value || ''} onChange={(e) => updArr('conditions', i, { value: e.target.value })} />}
              <button className="btn sm" onClick={() => delArr('conditions', i)}>×</button></div>)}
            <button className="btn sm" onClick={() => upd('conditions', [...editing.conditions, { field: FIELDS[editing.trigger_table][0], op: 'eq', value: '' }])}>+ {t('add_condition')}</button></div>
          <div className="card"><h3>{t('actions')}</h3>
            {editing.actions.map((a, i) => <div key={i} className="card" style={{ marginBottom: 8, background: '#F8FBFC' }}>
              <div className="row"><select className="input" style={{ width: 160 }} value={a.type} onChange={(e) => updArr('actions', i, { type: e.target.value })}>{ACTIONS.map((x) => <option key={x}>{x}</option>)}</select><div style={{ flex: 1 }} /><button className="btn sm" onClick={() => delArr('actions', i)}>×</button></div>
              {a.type === 'create_task' && <div className="grid2" style={{ marginTop: 8 }}>
                <label className="field"><span>{t('title')}</span><input className="input" value={a.title || ''} onChange={(e) => updArr('actions', i, { title: e.target.value })} /></label>
                <label className="field"><span>{t('due_date')} (+dias)</span><input className="input" type="number" value={a.days ?? 1} onChange={(e) => updArr('actions', i, { days: Number(e.target.value) })} /></label>
                <label className="field"><span>{t('priority')}</span><select className="input" value={a.priority || 'normal'} onChange={(e) => updArr('actions', i, { priority: e.target.value })}>{['baixa', 'normal', 'alta', 'urgente'].map((p) => <option key={p}>{p}</option>)}</select></label>
                <label className="field"><span>{t('assigned_to')}</span><select className="input" value={a.assign || 'owner'} onChange={(e) => updArr('actions', i, { assign: e.target.value })}><option value="owner">{t('owner')}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label></div>}
              {a.type === 'set_field' && <div className="grid2" style={{ marginTop: 8 }}>
                <label className="field"><span>{t('field')}</span><select className="input" value={a.field || ''} onChange={(e) => updArr('actions', i, { field: e.target.value })}><option value="">—</option>{(FIELDS[editing.trigger_table] || []).map((f) => <option key={f}>{f}</option>)}</select></label>
                <label className="field"><span>{t('value')}</span><input className="input" value={a.value || ''} onChange={(e) => updArr('actions', i, { value: e.target.value })} /></label></div>}
              {(a.type === 'notify' || a.type === 'log_activity') && <div className="grid2" style={{ marginTop: 8 }}>
                <label className="field" style={{ gridColumn: 'span 2' }}><span>{t('message')}</span><input className="input" value={a.message || ''} onChange={(e) => updArr('actions', i, { message: e.target.value })} /></label>
                {a.type === 'notify' && <label className="field"><span>{t('assigned_to')}</span><select className="input" value={a.to || 'owner'} onChange={(e) => updArr('actions', i, { to: e.target.value })}><option value="owner">{t('owner')}</option><option value="admins">{t('admin')}</option><option value="all">{t('all')}</option></select></label>}</div>}
            </div>)}
            <button className="btn sm" onClick={() => upd('actions', [...editing.actions, { type: 'create_task', title: '', days: 1, assign: 'owner' }])}>+ {t('add_action')}</button></div>
        </Drawer>
      )}
    </div>
  )
}
