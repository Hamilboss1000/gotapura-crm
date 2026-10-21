import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'

export default function Auth() {
  const { t, lang, setLang } = useT()
  const [mode, setMode] = useState('in'); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [name, setName] = useState(''); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true); setMsg(null)
    const r = mode === 'in' ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw, options: { data: { full_name: name } } })
    if (r.error) setMsg({ err: true, text: r.error.message })
    else if (mode === 'up' && !r.data.session) setMsg({ text: lang === 'pt' ? 'Conta criada. Verifique o e-mail para confirmar.' : 'Account created. Check your email to confirm.' })
    setBusy(false)
  }
  return (
    <div className="auth"><div className="card">
      <div className="brand" style={{ color: 'var(--deep)', paddingLeft: 0 }}><span className="drop" /> {t('app')}</div>
      <div className="tabs"><button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>{t('signin')}</button><button className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>{t('signup')}</button></div>
      <div style={{ display: 'grid', gap: 10 }}>
        {mode === 'up' && <label className="field"><span>{t('fullname')}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>}
        <label className="field"><span>{t('email')}</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>{t('password')}</span><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} /></label>
        {msg && <div className={`notice ${msg.err ? 'err' : ''}`}>{msg.text}</div>}
        <button className="btn primary" disabled={busy} onClick={go}>{mode === 'in' ? t('signin') : t('signup')}</button>
        <div className="row small muted" style={{ justifyContent: 'center' }}><button className="btn ghost sm" onClick={() => setLang('pt')}>Português</button>·<button className="btn ghost sm" onClick={() => setLang('en')}>English</button></div>
      </div>
    </div></div>
  )
}
