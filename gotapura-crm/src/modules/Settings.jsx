// Definições: perfil pessoal, telefone SIP e, para administradores, empresa/logótipo, moedas e campos personalizados.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import { useSettings } from '../lib/settings'
import { connectPhone, disconnectPhone } from '../lib/sip'

const MODULES = ['tasks', 'contacts', 'organizations', 'leads', 'opportunities', 'projects', 'products']
const TYPES = ['text', 'number', 'date', 'select', 'checkbox', 'textarea']
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export default function Settings({ profile, reload }) {
  const { t, lang, setLang } = useT(); const toast = useToast()
  const { company, allCurrencies, customFields, reload: reloadSettings } = useSettings()
  const [tab, setTab] = useState('profile')
  const [p, setP] = useState({ full_name: profile.full_name || '', phone: profile.phone || '', mobile: profile.mobile || '', job_title: profile.job_title || '', extension: profile.extension || '', wss_url: profile.wss_url || '', sip_uri: profile.sip_uri || '', sip_password: profile.sip_password || '' })
  const [pw, setPw] = useState('')
  const [co, setCo] = useState(company)
  const [curs, setCurs] = useState(allCurrencies); const [newCur, setNewCur] = useState({ code: '', symbol: '', name: '', rate: 1 })
  const [cf, setCf] = useState({ module: 'tasks', label: '', type: 'text', options: '', required: false })
  const isAdmin = profile.role === 'admin'
  useEffect(() => { setCo(company) }, [company]); useEffect(() => { setCurs(allCurrencies) }, [allCurrencies])
  const f = (k) => ({ value: p[k], onChange: (e) => setP((x) => ({ ...x, [k]: e.target.value })) })
  const c = (k) => ({ value: co[k] || '', onChange: (e) => setCo((x) => ({ ...x, [k]: e.target.value })) })

  const saveP = async () => { const { error } = await supabase.from('profiles').update({ ...p, language: lang }).eq('id', profile.id); if (error) toast(t('error') + ': ' + error.message); else { toast(t('saved')); reload() } }
  const savePw = async () => { if (pw.length < 8) return; const { error } = await supabase.auth.updateUser({ password: pw }); toast(error ? t('error') : t('saved')); setPw('') }
  const saveCo = async (patch = {}) => { const value = { ...co, ...patch }; const { error } = await supabase.from('settings').upsert({ key: 'company', value, updated_at: new Date().toISOString() }); if (error) toast(t('error') + ': ' + error.message); else { setCo(value); toast(t('saved')); reloadSettings() } }
  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const ext = file.name.split('.').pop().toLowerCase(); const path = `logo.${ext}`
    const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true, contentType: file.type })
    if (error) return toast(t('error') + ': ' + error.message)
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    await saveCo({ logo_url: `${data.publicUrl}?v=${Date.now()}` }); e.target.value = ''
  }
  const saveCur = async (cur) => { const { error } = await supabase.from('currencies').upsert({ ...cur, updated_at: new Date().toISOString() }); if (error) toast(t('error') + ': ' + error.message); else { toast(t('saved')); reloadSettings() } }
  const setBase = async (code) => { for (const x of curs) await supabase.from('currencies').update({ is_base: x.code === code, rate: x.code === code ? 1 : x.rate }).eq('code', x.code); await saveCo({ base_currency: code }); reloadSettings() }
  const addCur = async () => { if (!newCur.code) return; await saveCur({ ...newCur, code: newCur.code.toUpperCase(), is_base: false, active: true }); setCurs((xs) => [...xs, { ...newCur, code: newCur.code.toUpperCase(), is_base: false, active: true }]); setNewCur({ code: '', symbol: '', name: '', rate: 1 }) }
  const addField = async () => {
    if (!cf.label) return
    const { error } = await supabase.from('custom_fields').insert({ module: cf.module, key: slug(cf.label), label: cf.label, type: cf.type, options: cf.options.split(',').map((x) => x.trim()).filter(Boolean), required: cf.required, position: customFields(cf.module).length })
    if (error) toast(t('error') + ': ' + error.message); else { toast(t('saved')); setCf({ ...cf, label: '', options: '' }); reloadSettings() }
  }
  const delField = async (id) => { if (confirm(t('confirm_delete'))) { await supabase.from('custom_fields').delete().eq('id', id); reloadSettings() } }

  return (
    <div className="page">
      <div className="page-head"><h1>{t('settings')}</h1></div>
      <div className="tabs">
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}>{t('profile')}</button>
        <button className={tab === 'phone' ? 'on' : ''} onClick={() => setTab('phone')}>{t('phone')}</button>
        {isAdmin && <><button className={tab === 'company' ? 'on' : ''} onClick={() => setTab('company')}>{t('company')}</button>
          <button className={tab === 'currencies' ? 'on' : ''} onClick={() => setTab('currencies')}>{t('currencies')}</button>
          <button className={tab === 'fields' ? 'on' : ''} onClick={() => setTab('fields')}>{t('custom_fields')}</button></>}
      </div>

      {tab === 'profile' && <div className="card" style={{ maxWidth: 720 }}><h2>{t('profile')}</h2>
        <div className="grid2">
          <label className="field"><span>{t('fullname')}</span><input className="input" {...f('full_name')} /></label>
          <label className="field"><span>{t('job_title')}</span><input className="input" {...f('job_title')} /></label>
          <label className="field"><span>{t('phone_n')}</span><input className="input" {...f('phone')} /></label>
          <label className="field"><span>{t('mobile')}</span><input className="input" {...f('mobile')} /></label>
          <label className="field"><span>{t('language')}</span><select className="input" value={lang} onChange={(e) => setLang(e.target.value)}><option value="pt">Português</option><option value="en">English</option></select></label>
        </div>
        <p className="small muted">{profile.email} · {t(profile.role)}{profile.department ? ' · ' + profile.department : ''}</p>
        <button className="btn primary" onClick={saveP}>{t('save')}</button>
        <h2 style={{ marginTop: 20 }}>{t('security')}</h2>
        <div className="row"><input className="input" type="password" placeholder={t('change_password')} value={pw} onChange={(e) => setPw(e.target.value)} /><button className="btn" onClick={savePw}>{t('save')}</button></div>
      </div>}

      {tab === 'phone' && <div className="card" style={{ maxWidth: 720 }}><h2>{t('phone_settings')}</h2>
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
      </div>}

      {tab === 'company' && isAdmin && <div className="card" style={{ maxWidth: 820 }}><h2>{t('company')}</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          {co.logo_url ? <img className="logo-prev" src={co.logo_url} alt="logo" /> : <span className="chip grey">{t('no_logo')}</span>}
          <label className="btn">{t('upload_logo')}<input type="file" hidden accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={uploadLogo} /></label>
          {co.logo_url && <button className="btn sm" onClick={() => saveCo({ logo_url: null })}>{t('remove_logo')}</button>}
          <span className="small muted">PNG ou SVG com fundo transparente, até 1 MB.</span>
        </div>
        <div className="grid2">
          <label className="field"><span>{t('name')}</span><input className="input" {...c('name')} /></label>
          <label className="field"><span>{t('tagline')}</span><input className="input" {...c('tagline')} /></label>
          <label className="field"><span>{t('nif')}</span><input className="input" {...c('nif')} /></label>
          <label className="field"><span>{t('phone_n')}</span><input className="input" {...c('phone')} /></label>
          <label className="field"><span>{t('email')}</span><input className="input" {...c('email')} /></label>
          <label className="field"><span>{t('website_n')}</span><input className="input" {...c('website')} /></label>
          <label className="field" style={{ gridColumn: 'span 2' }}><span>{t('address')}</span><input className="input" {...c('address')} /></label>
          <label className="field" style={{ gridColumn: 'span 2' }}><span>{t('quote_footer')}</span><textarea className="input" {...c('quote_footer')} /></label>
        </div>
        <button className="btn primary" style={{ marginTop: 10 }} onClick={() => saveCo()}>{t('save')}</button>
        <p className="small muted">Estes dados aparecem no menu, na página de entrada, nas cotações e nas facturas pró-forma.</p>
      </div>}

      {tab === 'currencies' && isAdmin && <div className="card" style={{ maxWidth: 820 }}><h2>{t('currencies')}</h2>
        <p className="small muted">{t('rate_hint')}</p>
        <table className="tbl"><thead><tr><th>{t('code')}</th><th>{t('symbol')}</th><th>{t('name')}</th><th>{t('rate')}</th><th>{t('active')}</th><th>{t('base')}</th><th></th></tr></thead>
          <tbody>{curs.map((x, i) => <tr key={x.code}>
            <td><strong>{x.code}</strong></td>
            <td><input className="input" style={{ width: 60 }} value={x.symbol} onChange={(e) => setCurs((xs) => xs.map((y, j) => j === i ? { ...y, symbol: e.target.value } : y))} /></td>
            <td><input className="input" value={x.name} onChange={(e) => setCurs((xs) => xs.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} /></td>
            <td><input className="input" style={{ width: 120 }} type="number" step="any" disabled={x.is_base} value={x.rate} onChange={(e) => setCurs((xs) => xs.map((y, j) => j === i ? { ...y, rate: Number(e.target.value) } : y))} /></td>
            <td><input type="checkbox" checked={x.active} disabled={x.is_base} onChange={(e) => setCurs((xs) => xs.map((y, j) => j === i ? { ...y, active: e.target.checked } : y))} /></td>
            <td>{x.is_base ? <span className="chip ok">{t('base')}</span> : <button className="btn sm" onClick={() => setBase(x.code)}>{t('set_base')}</button>}</td>
            <td><button className="btn sm primary" onClick={() => saveCur(x)}>{t('save')}</button></td></tr>)}</tbody></table>
        <div className="row" style={{ marginTop: 10 }}>
          <input className="input" style={{ width: 80 }} placeholder="ZAR" value={newCur.code} onChange={(e) => setNewCur({ ...newCur, code: e.target.value })} />
          <input className="input" style={{ width: 70 }} placeholder="R" value={newCur.symbol} onChange={(e) => setNewCur({ ...newCur, symbol: e.target.value })} />
          <input className="input" style={{ width: 180 }} placeholder="Rand" value={newCur.name} onChange={(e) => setNewCur({ ...newCur, name: e.target.value })} />
          <input className="input" style={{ width: 120 }} type="number" step="any" placeholder={t('rate')} value={newCur.rate} onChange={(e) => setNewCur({ ...newCur, rate: Number(e.target.value) })} />
          <button className="btn" onClick={addCur}>+ {t('new')}</button>
        </div>
      </div>}

      {tab === 'fields' && isAdmin && <div className="card" style={{ maxWidth: 820 }}><h2>{t('custom_fields')}</h2>
        <div className="row">
          <select className="input" style={{ width: 160 }} value={cf.module} onChange={(e) => setCf({ ...cf, module: e.target.value })}>{MODULES.map((m) => <option key={m} value={m}>{t(m)}</option>)}</select>
          <input className="input" style={{ width: 200 }} placeholder={t('field_label')} value={cf.label} onChange={(e) => setCf({ ...cf, label: e.target.value })} />
          <select className="input" style={{ width: 130 }} value={cf.type} onChange={(e) => setCf({ ...cf, type: e.target.value })}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select>
          {cf.type === 'select' && <input className="input" style={{ width: 220 }} placeholder="opção 1, opção 2, …" value={cf.options} onChange={(e) => setCf({ ...cf, options: e.target.value })} />}
          <label className="row small"><input type="checkbox" checked={cf.required} onChange={(e) => setCf({ ...cf, required: e.target.checked })} /> *</label>
          <button className="btn primary" onClick={addField}>+ {t('new')}</button>
        </div>
        <table className="tbl" style={{ marginTop: 12 }}><thead><tr><th>{t('module')}</th><th>{t('field_label')}</th><th>Tipo</th><th>Opções</th><th></th></tr></thead>
          <tbody>{MODULES.flatMap((m) => customFields(m).map((x) => <tr key={x.id}><td>{t(m)}</td><td>{x.label}{x.required ? ' *' : ''}</td><td>{x.type}</td><td className="small">{(x.options || []).join(', ')}</td><td><button className="btn sm danger" onClick={() => delField(x.id)}>×</button></td></tr>))}</tbody></table>
      </div>}
    </div>
  )
}
