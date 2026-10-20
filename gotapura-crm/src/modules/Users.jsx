// Administração de utilizadores (ilimitados): funções, departamentos e extensões telefónicas.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'

const ROLES = ['admin', 'manager', 'agent', 'viewer']
const DEPTS = ['administrativo', 'apoio ao cliente', 'comercial', 'técnico', 'direcção']

export default function Users() {
  const { t } = useT(); const toast = useToast()
  const [rows, setRows] = useState([])
  const load = async () => { const { data } = await supabase.from('profiles').select('*').order('full_name'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const upd = async (id, patch) => { const { error } = await supabase.from('profiles').update(patch).eq('id', id); if (error) toast(t('error') + ': ' + error.message); else load() }
  return (
    <div className="page">
      <div className="page-head"><h1>{t('users')}</h1><span className="muted">{rows.length}</span></div>
      <div className="notice" style={{ marginBottom: 14 }}>{t('invite_hint')}</div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('role')}</th><th>{t('department')}</th><th>{t('extension')}</th><th>{t('active')}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}>
          <td><input className="input" defaultValue={r.full_name || ''} onBlur={(e) => e.target.value !== r.full_name && upd(r.id, { full_name: e.target.value })} /></td>
          <td className="small">{r.email}</td>
          <td><select className="input" value={r.role} onChange={(e) => upd(r.id, { role: e.target.value })}>{ROLES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></td>
          <td><select className="input" value={r.department || ''} onChange={(e) => upd(r.id, { department: e.target.value || null })}><option value="">—</option>{DEPTS.map((x) => <option key={x}>{x}</option>)}</select></td>
          <td><input className="input" style={{ width: 90 }} defaultValue={r.extension || ''} onBlur={(e) => e.target.value !== (r.extension || '') && upd(r.id, { extension: e.target.value || null })} /></td>
          <td><input type="checkbox" checked={r.active} onChange={(e) => upd(r.id, { active: e.target.checked })} /></td>
        </tr>)}</tbody>
      </table></div>
    </div>
  )
}
