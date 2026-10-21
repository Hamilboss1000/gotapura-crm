// Administração de utilizadores (ilimitados): criar, editar, definir função/permissões, palavra-passe, desactivar e eliminar.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import Drawer from '../components/Drawer'

const ROLES = ['admin', 'manager', 'agent', 'viewer']
const DEPTS = ['administrativo', 'apoio ao cliente', 'comercial', 'técnico', 'direcção']

export default function Users({ profile }) {
  const { t } = useT(); const toast = useToast()
  const [rows, setRows] = useState([]); const [editing, setEditing] = useState(null); const [busy, setBusy] = useState(false)
  const load = async () => { const { data } = await supabase.from('profiles').select('*').order('full_name'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const call = async (body) => {
    const { data, error } = await supabase.functions.invoke('admin-users', { body })
    if (error || data?.error) throw new Error(data?.error || error.message || 'admin-users')
    return data
  }
  const onSave = async () => {
    setBusy(true)
    try {
      if (editing.id) {
        const { id, email, created_at, new_password, ...rest } = editing
        const { error } = await supabase.from('profiles').update(rest).eq('id', id); if (error) throw error
        if (editing.new_password) await call({ action: 'set_password', id, password: editing.new_password })
      } else {
        await call({ action: 'create', ...editing, password: editing.new_password })
      }
      toast(t('saved')); setEditing(null); load()
    } catch (e) { toast(t('error') + ': ' + (e.message.includes('admin-users') || e.message.includes('Failed') ? t('fn_missing') : e.message)) }
    setBusy(false)
  }
  const onDelete = async () => {
    if (!confirm(t('confirm_delete_user'))) return
    try { await call({ action: 'delete', id: editing.id }); toast(t('saved')); setEditing(null); load() } catch (e) { toast(t('error') + ': ' + (e.message.includes('Failed') ? t('fn_missing') : e.message)) }
  }
  const u = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const canAdmin = profile?.role === 'admin'
  return (
    <div className="page">
      <div className="page-head"><h1>{t('users')}</h1><span className="muted">{rows.length}</span><div className="spacer" />
        {canAdmin && <button className="btn primary" onClick={() => setEditing({ role: 'agent', active: true, language: 'pt' })}>+ {t('new_user')}</button>}</div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('role')}</th><th>{t('department')}</th><th>{t('job_title')}</th><th>{t('extension')}</th><th>{t('active')}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className="click" onClick={() => setEditing(r)}>
          <td style={{ fontWeight: 500 }}>{r.full_name}</td><td className="small">{r.email}</td>
          <td><span className={`chip ${r.role === 'admin' ? 'ok' : r.role === 'viewer' ? 'grey' : ''}`}>{t(r.role)}</span></td>
          <td>{r.department}</td><td>{r.job_title}</td><td>{r.extension}</td><td>{r.active ? '●' : '○'}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="small muted" style={{ marginTop: 10 }}>{t('users_hint')}</p>
      {editing && (
        <Drawer title={editing.id ? editing.full_name || editing.email : t('new_user')} onClose={() => setEditing(null)}
          footer={<>{editing.id && canAdmin && editing.id !== profile.id && <button className="btn danger" onClick={onDelete}>{t('delete')}</button>}<div style={{ flex: 1 }} />
            <button className="btn" onClick={() => setEditing(null)}>{t('cancel')}</button><button className="btn primary" disabled={busy} onClick={onSave}>{busy ? t('loading') : t('save')}</button></>}>
          <div className="grid2">
            <label className="field"><span>{t('fullname')} *</span><input className="input" value={editing.full_name || ''} onChange={(e) => u('full_name', e.target.value)} /></label>
            <label className="field"><span>{t('email')} *</span><input className="input" type="email" disabled={!!editing.id} value={editing.email || ''} onChange={(e) => u('email', e.target.value)} /></label>
            <label className="field"><span>{editing.id ? t('new_password') : t('password') + ' *'}</span><input className="input" type="password" placeholder={editing.id ? '(manter)' : ''} value={editing.new_password || ''} onChange={(e) => u('new_password', e.target.value)} /></label>
            <label className="field"><span>{t('role')}</span><select className="input" disabled={!canAdmin} value={editing.role} onChange={(e) => u('role', e.target.value)}>{ROLES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></label>
            <label className="field"><span>{t('department')}</span><select className="input" value={editing.department || ''} onChange={(e) => u('department', e.target.value || null)}><option value="">—</option>{DEPTS.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field"><span>{t('job_title')}</span><input className="input" value={editing.job_title || ''} onChange={(e) => u('job_title', e.target.value)} /></label>
            <label className="field"><span>{t('phone_n')}</span><input className="input" value={editing.phone || ''} onChange={(e) => u('phone', e.target.value)} /></label>
            <label className="field"><span>{t('mobile')}</span><input className="input" value={editing.mobile || ''} onChange={(e) => u('mobile', e.target.value)} /></label>
            <label className="field"><span>{t('extension')}</span><input className="input" value={editing.extension || ''} onChange={(e) => u('extension', e.target.value || null)} /></label>
            <label className="field"><span>{t('active')}</span><input type="checkbox" disabled={!canAdmin} checked={!!editing.active} onChange={(e) => u('active', e.target.checked)} /></label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span>{t('notes')}</span><textarea className="input" value={editing.notes || ''} onChange={(e) => u('notes', e.target.value)} /></label>
          </div>
          <div className="notice small">
            <strong>{t('admin')}</strong>: tudo · <strong>{t('manager')}</strong>: cria, edita, elimina, automações e integrações · <strong>{t('agent')}</strong>: cria e edita, não elimina · <strong>{t('viewer')}</strong>: só consulta
          </div>
        </Drawer>
      )}
    </div>
  )
}
