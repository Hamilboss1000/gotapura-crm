// Integrações (WhatsApp, redes sociais, facturação certificada, e-mail, central), chaves de API e webhooks.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { list, save, remove, fmtDateTime } from '../lib/api'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'

const SCHEMAS = {
  pbx: [['wss_url', 'wss://central:8089/ws'], ['domain', 'central.gotapura.ao']],
  whatsapp: [['phone_number_id', 'ID do número (Meta)'], ['business_account_id', 'ID da conta WhatsApp Business'], ['access_token', 'Token permanente'], ['verify_token', 'Token de verificação do webhook']],
  facebook: [['page_id', 'ID da página'], ['access_token', 'Token da página']],
  instagram: [['account_id', 'ID da conta profissional'], ['access_token', 'Token']],
  linkedin: [['organization_id', 'ID da organização'], ['access_token', 'Token']],
  invoicing: [['provider', 'Software certificado (ex.: Primavera, PHC, Moloni, Odoo)'], ['base_url', 'https://api.…'], ['api_key', 'Chave de API'], ['series', 'Série de facturação']],
  email: [['smtp_host', 'smtp.…'], ['smtp_port', '587'], ['smtp_user', 'utilizador'], ['smtp_password', 'palavra-passe'], ['from', 'comercial@gotapura.ao']],
}
const EVENTS = ['lead.created', 'lead.converted', 'opportunity.won', 'opportunity.lost', 'quote.accepted', 'task.completed', 'contact.created']

export default function Integrations() {
  const { t } = useT(); const toast = useToast()
  const [ints, setInts] = useState([]); const [keys, setKeys] = useState([]); const [hooks, setHooks] = useState([]); const [newKey, setNewKey] = useState(null); const [hook, setHook] = useState({ url: '', events: [] })
  const load = async () => { const { data } = await supabase.from('integrations').select('*').order('provider'); setInts(data || []); setKeys(await list('api_keys')); setHooks(await list('webhooks')) }
  useEffect(() => { load() }, [])
  const saveInt = async (i) => { const { error } = await supabase.from('integrations').update({ config: i.config, active: i.active, updated_at: new Date().toISOString() }).eq('provider', i.provider); toast(error ? t('error') + ': ' + error.message : t('saved')) }
  const genKey = async () => {
    const raw = 'gtp_' + crypto.randomUUID().replace(/-/g, '')
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    const name = prompt(t('name')) || 'Integração'
    await save('api_keys', { name, prefix: raw.slice(0, 10), key_hash: hash }); setNewKey(raw); load()
  }
  const addHook = async () => { if (!hook.url || !hook.events.length) return; await save('webhooks', { ...hook, secret: crypto.randomUUID() }); setHook({ url: '', events: [] }); load() }
  const url = import.meta.env.VITE_SUPABASE_URL
  return (
    <div className="page">
      <div className="page-head"><h1>{t('integrations')}</h1></div>
      <div className="grid2">
        {ints.map((i) => <div key={i.provider} className="card">
          <div className="row"><h2 style={{ margin: 0, flex: 1 }}>{i.label}</h2><label className="row small"><input type="checkbox" checked={i.active} onChange={(e) => setInts((xs) => xs.map((x) => x.provider === i.provider ? { ...x, active: e.target.checked } : x))} /> {t('active')}</label></div>
          <div className="grid2" style={{ marginTop: 8 }}>
            {(SCHEMAS[i.provider] || []).map(([k, ph]) => <label key={k} className="field"><span>{k}</span><input className="input" type={/token|password|key/.test(k) ? 'password' : 'text'} placeholder={ph} value={i.config?.[k] || ''} onChange={(e) => setInts((xs) => xs.map((x) => x.provider === i.provider ? { ...x, config: { ...x.config, [k]: e.target.value } } : x))} /></label>)}
          </div>
          {i.provider === 'whatsapp' && <p className="small muted">Webhook (Meta): {url}/functions/v1/whatsapp-webhook</p>}
          {i.provider === 'invoicing' && <p className="small muted">{t('invoicing_hint')}</p>}
          <button className="btn primary sm" style={{ marginTop: 8 }} onClick={() => saveInt(i)}>{t('save')}</button>
        </div>)}
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card"><h2>{t('api_keys')}</h2>
          <p className="small muted">{t('rest_hint')} <code>{url}/rest/v1/&lt;tabela&gt;</code> (cabeçalhos <code>apikey</code> e <code>Authorization: Bearer</code>). As chaves abaixo identificam integrações externas (facturação, website, parceiros).</p>
          {newKey && <div className="notice"><strong>{newKey}</strong><br />{t('key_once')}</div>}
          <table className="tbl" style={{ marginTop: 8 }}><tbody>{keys.map((k) => <tr key={k.id}><td>{k.name}</td><td className="small muted">{k.prefix}…</td><td className="small">{fmtDateTime(k.created_at)}</td><td><button className="btn sm danger" onClick={async () => { await remove('api_keys', k.id); load() }}>×</button></td></tr>)}</tbody></table>
          <button className="btn" style={{ marginTop: 8 }} onClick={genKey}>+ {t('generate_key')}</button>
        </div>
        <div className="card"><h2>{t('webhooks')}</h2>
          <input className="input" placeholder="https://…/webhook" value={hook.url} onChange={(e) => setHook((h) => ({ ...h, url: e.target.value }))} />
          <div className="row" style={{ margin: '8px 0' }}>{EVENTS.map((ev) => <label key={ev} className="row small"><input type="checkbox" checked={hook.events.includes(ev)} onChange={(e) => setHook((h) => ({ ...h, events: e.target.checked ? [...h.events, ev] : h.events.filter((x) => x !== ev) }))} />{ev}</label>)}</div>
          <button className="btn" onClick={addHook}>+ {t('new')}</button>
          <table className="tbl" style={{ marginTop: 8 }}><tbody>{hooks.map((h) => <tr key={h.id}><td className="small">{h.url}</td><td className="small">{h.events.join(', ')}</td><td><button className="btn sm danger" onClick={async () => { await remove('webhooks', h.id); load() }}>×</button></td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  )
}
