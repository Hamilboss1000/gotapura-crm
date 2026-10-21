// Tarefas com recorrência (diária, dias úteis, semanal, mensal, anual), lembretes e atribuição.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { list, save, remove, profiles, fmtDate, today } from '../lib/api'
import { FREQ_LABELS, describeRecurrence } from '../lib/recurrence'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import Drawer from '../components/Drawer'
import { Form } from '../components/Fields'

export default function Tasks({ user }) {
  const { t } = useT(); const toast = useToast()
  const [rows, setRows] = useState([]); const [people, setPeople] = useState([]); const [editing, setEditing] = useState(null)
  const [scope, setScope] = useState('mine'); const [showDone, setShowDone] = useState(false)

  const load = async () => {
    const filters = [] ; if (scope === 'mine') filters.push(['assigned_to', 'eq', user.id]); if (!showDone) filters.push(['status', 'in', ['pendente', 'em curso']])
    setRows(await list('tasks', { select: '*, profiles:assigned_to(full_name)', order: 'due_date', asc: true, filters }))
  }
  useEffect(() => { load() }, [scope, showDone]); useEffect(() => { profiles().then(setPeople) }, [])

  const fields = [
    { key: 'title', required: true, span: 2 },
    { key: 'due_date', type: 'date' }, { key: 'due_time', type: 'time' },
    { key: 'priority', type: 'select', options: ['baixa', 'normal', 'alta', 'urgente'] },
    { key: 'category', type: 'select', options: ['chamada', 'reunião', 'email', 'visita', 'entrega', 'manutenção', 'cobrança', 'outro'] },
    { key: 'assigned_to', type: 'person' }, { key: 'status', type: 'select', options: ['pendente', 'em curso', 'concluida', 'cancelada'] },
    { key: 'description', type: 'textarea', span: 2 },
  ]
  const rec = editing?.recurrence || { freq: 'none' }
  const setRec = (patch) => setEditing((e) => ({ ...e, recurrence: { ...(e.recurrence || { freq: 'none' }), ...patch } }))
  const onSave = async () => {
    const o = { ...editing }; delete o.profiles
    if (!o.assigned_to) o.assigned_to = user.id
    try { await save('tasks', o); toast(t('saved')); setEditing(null); load() } catch (e) { toast(t('error') + ': ' + e.message) }
  }
  const complete = async (r, e) => { e.stopPropagation(); await supabase.from('tasks').update({ status: 'concluida' }).eq('id', r.id); load() }
  const onDelete = async () => { if (confirm(t('confirm_delete'))) { await remove('tasks', editing.id); setEditing(null); load() } }
  const cls = (r) => r.status === 'concluida' ? 'ok' : r.due_date && r.due_date < today() ? 'danger' : r.due_date === today() ? 'warn' : 'grey'

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('tasks')}</h1><div className="spacer" />
        <div className="tabs" style={{ margin: 0, border: 0 }}><button className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>{t('mine')}</button><button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>{t('all')}</button></div>
        <label className="row small"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> {t('done')}</label>
        <button className="btn primary" onClick={() => setEditing({ due_date: today(), priority: 'normal', status: 'pendente', assigned_to: user.id, recurrence: { freq: 'none', interval: 1 } })}>+ {t('new')}</button>
      </div>
      {rows.length === 0 ? <div className="empty">{t('empty')}</div> : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th></th><th>{t('title')}</th><th>{t('due_date')}</th><th>{t('priority')}</th><th>{t('category')}</th><th>{t('recurrence')}</th><th>{t('assigned_to')}</th><th>{t('status')}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="click" onClick={() => setEditing(r)}>
            <td>{r.status !== 'concluida' && <button className="btn sm" title={t('mark_done')} onClick={(e) => complete(r, e)}>✓</button>}</td>
            <td style={{ fontWeight: 500 }}>{r.title}{r.parent_task_id && <span className="muted small"> ↻</span>}</td>
            <td><span className={`chip ${cls(r)}`}>{fmtDate(r.due_date)}{r.due_time ? ' ' + r.due_time.slice(0, 5) : ''}</span></td>
            <td>{r.priority}</td><td>{r.category}</td><td className="small">{describeRecurrence(r.recurrence)}</td><td>{r.profiles?.full_name}</td><td>{r.status}</td>
          </tr>)}</tbody>
        </table></div>
      )}
      {editing && (
        <Drawer title={editing.id ? editing.title : t('new')} onClose={() => setEditing(null)}
          footer={<>{editing.id && <button className="btn danger" onClick={onDelete}>{t('delete')}</button>}<div style={{ flex: 1 }} /><button className="btn" onClick={() => setEditing(null)}>{t('cancel')}</button><button className="btn primary" onClick={onSave}>{t('save')}</button></>}>
          <Form fields={fields} values={editing} people={people} onChange={(k, v) => setEditing((e) => ({ ...e, [k]: v }))} />
          <div className="card">
            <h3>{t('recurrence')}</h3>
            <div className="grid3">
              <label className="field"><span>{t('recurrence')}</span><select className="input" value={rec.freq} onChange={(e) => setRec({ freq: e.target.value })}>{Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              {rec.freq !== 'none' && rec.freq !== 'weekdays' && <label className="field"><span>{t('interval')}</span><input className="input" type="number" min="1" value={rec.interval || 1} onChange={(e) => setRec({ interval: Number(e.target.value) })} /></label>}
              {rec.freq !== 'none' && <label className="field"><span>{t('until')}</span><input className="input" type="date" value={rec.until || ''} onChange={(e) => setRec({ until: e.target.value || null })} /></label>}
            </div>
            {rec.freq !== 'none' && <p className="small muted">{describeRecurrence(rec)} — ao concluir, a ocorrência seguinte é criada automaticamente.</p>}
          </div>
        </Drawer>
      )}
    </div>
  )
}
