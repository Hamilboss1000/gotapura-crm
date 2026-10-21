import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { useSettings } from '../lib/settings'
import PhoneWidget from '../modules/Phone'

const NAV = [
  ['', ['dashboard', '/'], ['leads', '/leads'], ['contacts', '/contacts'], ['organizations', '/organizations'], ['opportunities', '/opportunities'], ['projects', '/projects'], ['tasks', '/tasks']],
  ['comercial', ['products', '/products'], ['quotes', '/quotes'], ['documents', '/documents'], ['import', '/import']],
  ['comunicação', ['whatsapp', '/whatsapp'], ['social', '/social'], ['website', '/website']],
  ['sistema', ['automations', '/automations'], ['integrations', '/integrations'], ['users', '/users'], ['settings', '/settings']],
]

export function Brand({ dark }) {
  const { company } = useSettings()
  return <div className="brand" style={dark ? undefined : { color: 'var(--deep)', paddingLeft: 0 }}>
    {company.logo_url ? <img src={company.logo_url} alt={company.name} /> : <><span className="drop" /> {company.name}</>}
  </div>
}

export default function Layout({ profile }) {
  const { t, lang, setLang } = useT(); const nav = useNavigate()
  const [open, setOpen] = useState(false); const [notes, setNotes] = useState([])
  useEffect(() => {
    const load = async () => { const { data } = await supabase.from('notifications').select('*').eq('read', false).order('created_at', { ascending: false }).limit(10); setNotes(data || []) }
    load(); const ch = supabase.channel('notif').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, load).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])
  const dismiss = async (n) => { await supabase.from('notifications').update({ read: true }).eq('id', n.id); setNotes((xs) => xs.filter((x) => x.id !== n.id)); if (n.link) nav(n.link) }
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <Brand dark />
        {NAV.map(([g, ...items]) => <div key={g}>{g && <div className="group">{g}</div>}{items.filter(([k]) => !(['users', 'integrations', 'automations'].includes(k) && !['admin', 'manager'].includes(profile?.role))).map(([k, to]) => <NavLink key={k} to={to} end={to === '/'}>{t(k)}</NavLink>)}</div>)}
        <div className="foot">{profile?.full_name}<br /><span>{t(profile?.role)}</span>{profile?.extension && <span> · {t('extension')} {profile.extension}</span>}</div>
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="btn ghost" onClick={() => setOpen(!open)}>☰</button><div className="spacer" />
          {notes.length > 0 && <details style={{ position: 'relative' }}><summary className="btn" style={{ listStyle: 'none' }}>🔔 {notes.length}</summary>
            <div className="card" style={{ position: 'absolute', right: 0, top: 40, width: 320, zIndex: 10 }}>{notes.map((n) => <div key={n.id} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => dismiss(n)}><strong>{n.title}</strong><br />{n.body}</div>)}</div></details>}
          <PhoneWidget profile={profile} />
          <select className="input" style={{ width: 'auto' }} value={lang} onChange={(e) => setLang(e.target.value)}><option value="pt">PT</option><option value="en">EN</option></select>
          <button className="btn" onClick={() => supabase.auth.signOut()}>{t('logout')}</button>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
