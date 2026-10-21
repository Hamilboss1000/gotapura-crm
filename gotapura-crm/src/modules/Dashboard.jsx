import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtDate, fmtDateTime, today } from '../lib/api'
import { useSettings } from '../lib/settings'
import { useT } from '../lib/i18n'

export default function Dashboard({ user, profile }) {
  const { t } = useT(); const { fmtMoney, toBase } = useSettings()
  const [s, setS] = useState({ open: 0, value: 0, leads: 0, overdue: 0, todayN: 0, won: 0, lost: 0, byStage: [], bySource: [] })
  const [tasks, setTasks] = useState([]); const [acts, setActs] = useState([])
  useEffect(() => { (async () => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString()
    const [o, l, tk, a, st] = await Promise.all([
      supabase.from('opportunities').select('id, value, currency, status, stage_id'),
      supabase.from('leads').select('id, source, created_at').gte('created_at', since),
      supabase.from('tasks').select('*').eq('assigned_to', user.id).in('status', ['pendente', 'em curso']).order('due_date').limit(8),
      supabase.from('activities').select('*, profiles:user_id(full_name)').order('occurred_at', { ascending: false }).limit(8),
      supabase.from('stages').select('id, name, position').order('position'),
    ])
    const opps = o.data || []; const open = opps.filter((x) => x.status === 'aberta'); const tks = tk.data || []
    const bySrc = {}; (l.data || []).forEach((x) => { bySrc[x.source || '—'] = (bySrc[x.source || '—'] || 0) + 1 })
    setS({ open: open.length, value: open.reduce((a, x) => a + toBase(x.value, x.currency), 0), leads: (l.data || []).length,
      overdue: tks.filter((x) => x.due_date && x.due_date < today()).length, todayN: tks.filter((x) => x.due_date === today()).length,
      won: opps.filter((x) => x.status === 'ganha').length, lost: opps.filter((x) => x.status === 'perdida').length,
      byStage: (st.data || []).map((x) => ({ name: x.name, n: open.filter((y) => y.stage_id === x.id).length, v: open.filter((y) => y.stage_id === x.id).reduce((a, y) => a + toBase(y.value, y.currency), 0) })),
      bySource: Object.entries(bySrc).sort((a, b) => b[1] - a[1]) })
    setTasks(tks); setActs(a.data || [])
  })() }, [])
  const rate = s.won + s.lost ? Math.round((100 * s.won) / (s.won + s.lost)) : 0
  const max = Math.max(1, ...s.byStage.map((x) => x.v))
  return (
    <div className="page">
      <div className="page-head"><h1>{t('dashboard')}</h1><span className="muted">{profile?.full_name} · {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <div className="grid4">
        <div className="stat"><div className="n">{s.open}</div><div className="l">{t('open_opps')}</div></div>
        <div className="stat"><div className="n">{fmtMoney(s.value)}</div><div className="l">{t('pipeline_value')}</div></div>
        <div className="stat"><div className="n">{s.leads}</div><div className="l">{t('new_leads')}</div></div>
        <div className="stat"><div className="n">{rate}%</div><div className="l">{t('rate')} · {s.won} {t('won').toLowerCase()} / {s.lost} {t('lost').toLowerCase()}</div></div>
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <h2>{t('my_tasks')} <span className="chip warn">{s.todayN} {t('today').toLowerCase()}</span> <span className="chip danger">{s.overdue} {t('overdue').toLowerCase()}</span></h2>
          {tasks.length === 0 ? <p className="muted">—</p> : tasks.map((x) => <div key={x.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span className={`chip ${x.due_date < today() ? 'danger' : x.due_date === today() ? 'warn' : 'grey'}`}>{fmtDate(x.due_date)}</span><Link to="/tasks" style={{ textDecoration: 'none', color: 'inherit' }}>{x.title}</Link></div>)}
        </div>
        <div className="card">
          <h2>{t('by_stage')}</h2>
          {s.byStage.map((x) => <div key={x.name} style={{ marginBottom: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span>{x.name} <span className="muted small">{x.n}</span></span><span className="small">{fmtMoney(x.v)}</span></div>
            <div style={{ height: 6, background: '#EAF1F5', borderRadius: 3 }}><div style={{ width: `${(100 * x.v) / max}%`, height: 6, background: 'var(--aqua)', borderRadius: 3 }} /></div>
          </div>)}
          <h2 style={{ marginTop: 16 }}>{t('by_source')}</h2>
          <div className="row">{s.bySource.map(([k, v]) => <span key={k} className="chip">{k}: {v}</span>)}{s.bySource.length === 0 && <span className="muted">—</span>}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h2>{t('recent')}</h2>
        {acts.map((x) => <div key={x.id} className="small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)' }}><span className="chip grey">{x.kind}</span> {x.subject || x.body} <span className="muted">· {x.profiles?.full_name} · {fmtDateTime(x.occurred_at)}</span></div>)}
        {acts.length === 0 && <p className="muted">—</p>}
      </div>
    </div>
  )
}
