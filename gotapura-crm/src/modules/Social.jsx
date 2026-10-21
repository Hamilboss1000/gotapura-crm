// Redes sociais: calendário de publicações em PT/EN, agendamento e publicação via Edge Function.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { list, save, remove, fmtDateTime } from '../lib/api'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'

const CHANNELS = ['facebook', 'instagram', 'linkedin', 'tiktok']
export default function Social() {
  const { t } = useT(); const toast = useToast()
  const [rows, setRows] = useState([]); const [p, setP] = useState({ channel: 'facebook', content: '', language: 'pt', scheduled_at: '', media_url: '' })
  const load = async () => setRows(await list('social_posts', { order: 'scheduled_at' }))
  useEffect(() => { load() }, [])
  const add = async (status) => {
    if (!p.content.trim()) return
    await save('social_posts', { ...p, scheduled_at: p.scheduled_at || null, status }); setP({ ...p, content: '' }); load()
    if (status === 'publicada') toast(t('saved'))
  }
  const publishNow = async (r) => { const { error } = await supabase.functions.invoke('social-publish', { body: { id: r.id } }); toast(error ? t('error') + ': ' + error.message : t('saved')); load() }
  return (
    <div className="page">
      <div className="page-head"><h1>{t('social')}</h1></div>
      <div className="grid2">
        <div className="card"><h2>{t('new')}</h2>
          <div className="grid2">
            <label className="field"><span>{t('channel')}</span><select className="input" value={p.channel} onChange={(e) => setP({ ...p, channel: e.target.value })}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field"><span>{t('language')}</span><select className="input" value={p.language} onChange={(e) => setP({ ...p, language: e.target.value })}><option value="pt">Português</option><option value="en">English</option></select></label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span>{t('content')}</span><textarea className="input" value={p.content} onChange={(e) => setP({ ...p, content: e.target.value })} /></label>
            <label className="field"><span>Imagem/vídeo (URL)</span><input className="input" value={p.media_url} onChange={(e) => setP({ ...p, media_url: e.target.value })} /></label>
            <label className="field"><span>{t('scheduled_at')}</span><input className="input" type="datetime-local" value={p.scheduled_at} onChange={(e) => setP({ ...p, scheduled_at: e.target.value })} /></label>
          </div>
          <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={() => add('rascunho')}>{t('save')}</button><button className="btn primary" onClick={() => add('agendada')}>{t('schedule')}</button></div>
        </div>
        <div className="card"><h2>{t('social')}</h2>
          {rows.length === 0 && <p className="muted">—</p>}
          {rows.map((r) => <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row"><span className="chip">{r.channel}</span><span className="chip grey">{r.language}</span><span className={`chip ${r.status === 'publicada' ? 'ok' : r.status === 'falhada' ? 'danger' : r.status === 'agendada' ? 'warn' : 'grey'}`}>{r.status}</span><span className="small muted">{fmtDateTime(r.scheduled_at)}</span><div style={{ flex: 1 }} />
              {r.status !== 'publicada' && <button className="btn sm" onClick={() => publishNow(r)}>{t('publish')}</button>}<button className="btn sm danger" onClick={async () => { await remove('social_posts', r.id); load() }}>×</button></div>
            <div className="small" style={{ marginTop: 4 }}>{r.content}</div>{r.error && <div className="small" style={{ color: 'var(--danger)' }}>{r.error}</div>}
          </div>)}
        </div>
      </div>
    </div>
  )
}
