// Definições pessoais: perfil, idioma, palavra-passe e ligação à central telefónica.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import { connectPhone, disconnectPhone } from '../lib/sip'

export default function Settings({ profile, reload }) {
  const { t, lang, setLang } = useT(); const toast = useToast()
  const [p, setP] = useState({ full_name: profile.full_name || '', extension: profile.extension || '', wss_url: profile.wss_url || '', sip_uri: profile.sip_uri || '', sip_password: profile.sip_password || '' })
  const [pw, setPw] = useState('')
  const saveP = async () => { const { error } = await supabase.from('profiles').update({ ...p, language: lang }).eq('id', profile.id); if (error) toast(t('error') + ': ' + error.message); else { toast(t('saved')); reload() } }
  const savePw = async () => { if (pw.length < 8) return; const { error } = await supabase.auth.updateUser({ password: pw }); toast(error ? t('error') : t('saved')); setPw('') }
  const f = (k) => ({ value: p[k], onChange: (e) => setP((x) => ({ ...x, [k]: e.target.value })) })
  return (
    <div className="page">
      <div className="page-head"><h1>{t('settings')}</h1></div>
      <div className="grid2">
        <div className="card"><h2>{t('profile')}</h2>
          <div className="grid2">
            <label className="field"><span>{t('fullname')}</span><input className="input" {...f('full_name')} /></label>
            <label className="field"><span>{t('language')}</span><select className="input" value={lang} onChange={(e) => setLang(e.target.value)}><option value="pt">Português</option><option value="en">English</option></select></label>
          </div>
          <p className="small muted">{profile.email} · {t(profile.role)}</p>
          <button className="btn primary" onClick={saveP}>{t('save')}</button>
          <h2 style={{ marginTop: 20 }}>{t('security')}</h2>
          <div className="row"><input className="input" type="password" placeholder={t('change_password')} value={pw} onChange={(e) => setPw(e.target.value)} /><button className="btn" onClick={savePw}>{t('save')}</button></div>
        </div>
        <div className="card"><h2>{t('phone_settings')}</h2>
          <div className="grid2">
            <label className="field"><span>{t('extension')}</span><input className="input" placeholder="200" {...f('extension')} /></label>
            <label className="field"><span>{t('sip_uri')}</span><input className="input" placeholder="sip:200@central.gotapura.ao" {...f('sip_uri')} /></label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span>{t('wss_url')}</span><input className="input" placeholder="wss://central.gotapura.ao:8089/ws" {...f('wss_url')} /></label>
            <label className="field"><span>{t('sip_password')}</span><input className="input" type="password" {...f('sip_password')} /></label>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={async () => { await saveP(); connectPhone({ ...p, display_name: p.full_name }) }}>{t('connect')}</button>
            <button className="btn" onClick={disconnectPhone}>{t('disconnect')}</button>
          </div>
          <p className="small muted">Asterisk / FreePBX / 3CX / Issabel: activar WebRTC (WSS) e criar uma extensão SIP por utilizador. Séries: 100 administrativa · 200 apoio ao cliente · 300 comercial · 400 técnica.</p>
        </div>
      </div>
    </div>
  )
}
