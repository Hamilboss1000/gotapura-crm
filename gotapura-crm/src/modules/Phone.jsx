// Softphone integrado (SIP/WebRTC) com identificação do contacto e registo automático das chamadas.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { connectPhone, disconnectPhone, dial, answer, hangup, toggleMute, onPhoneEvent, isPhoneReady } from '../lib/sip'
import { useT } from '../lib/i18n'

export default function PhoneWidget({ profile }) {
  const { t } = useT()
  const [open, setOpen] = useState(false); const [state, setState] = useState('off'); const [number, setNumber] = useState('')
  const [contact, setContact] = useState(null); const [muted, setMuted] = useState(false); const [notes, setNotes] = useState(''); const [err, setErr] = useState('')
  const call = useRef(null)

  useEffect(() => {
    if (profile?.sip_uri && profile?.sip_password && profile?.wss_url) connectPhone({ ...profile, display_name: profile.full_name })
    return () => disconnectPhone()
  }, [profile?.sip_uri, profile?.sip_password, profile?.wss_url])

  const lookup = async (n) => {
    const clean = (n || '').replace(/\D/g, '').slice(-9)
    if (!clean) return null
    const { data } = await supabase.from('contacts').select('id, first_name, last_name, organizations(name)').or(`phone.ilike.%${clean},mobile.ilike.%${clean},whatsapp.ilike.%${clean}`).limit(1)
    return data?.[0] || null
  }
  useEffect(() => onPhoneEvent(async (ev, d) => {
    if (ev === 'registered') { setState('ready'); setErr('') }
    if (ev === 'unregistered' || ev === 'disconnected') setState('off')
    if (ev === 'error') { setErr(String(d)); setState('off') }
    if (ev === 'incoming' || ev === 'outgoing') {
      setOpen(true); setState(ev === 'incoming' ? 'ringing' : 'calling'); setNumber(d.number)
      call.current = { direction: ev === 'incoming' ? 'entrada' : 'saida', number: d.number, started: Date.now(), answered: false }
      setContact(await lookup(d.number))
    }
    if (ev === 'confirmed') { setState('in_call'); if (call.current) call.current.answered = true }
    if (ev === 'ended' || ev === 'failed') {
      setState('ready'); const c = call.current; call.current = null
      if (c) {
        const dur = c.answered ? Math.round((Date.now() - c.started) / 1000) : 0
        await supabase.from('call_logs').insert({ direction: c.direction, number: c.number, contact_id: contact?.id, extension: profile?.extension, ended_at: new Date().toISOString(), duration_seconds: dur, outcome: c.answered ? 'atendida' : ev === 'failed' ? 'falhada' : 'sem resposta', notes })
        setNotes('')
      }
    }
  }), [contact, notes, profile])

  if (!open) return <button className="btn primary phone-toggle" onClick={() => setOpen(true)}>☏ {t('phone')} <span className={`dot ${state !== 'off' ? 'on' : ''}`} /></button>
  return (
    <div className="phone">
      <div className="status"><span className={`dot ${state === 'ringing' ? 'ring' : state !== 'off' ? 'on' : ''}`} />
        <span>{state === 'off' ? t('unregistered') : state === 'ringing' ? t('incoming') : state === 'calling' ? t('calling') : state === 'in_call' ? t('in_call') : t('registered')}</span>
        <span className="muted small">{profile?.extension ? '· ' + t('extension') + ' ' + profile.extension : ''}</span><div style={{ flex: 1 }} /><button className="btn ghost sm" onClick={() => setOpen(false)}>×</button></div>
      {err && <div className="notice err small">{err}</div>}
      {contact && <div className="notice small">{contact.first_name} {contact.last_name} {contact.organizations?.name ? '· ' + contact.organizations.name : ''}</div>}
      {state === 'ready' || state === 'off' ? (
        <div className="row"><input className="input" placeholder={t('dial')} value={number} onChange={(e) => setNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && dial(number)} /><button className="btn aqua" disabled={!isPhoneReady()} onClick={() => dial(number)}>{t('call')}</button></div>
      ) : (
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, margin: '6px 0' }}>{number}</div>
          <div className="row">
            {state === 'ringing' && <button className="btn aqua" onClick={answer}>{t('answer')}</button>}
            {state === 'in_call' && <button className="btn" onClick={() => setMuted(toggleMute())}>{muted ? t('unmute') : t('mute')}</button>}
            <button className="btn danger" onClick={hangup}>{t('hangup')}</button></div>
          <textarea className="input" style={{ marginTop: 8, minHeight: 60 }} placeholder={t('call_notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}
      {state === 'off' && <p className="small muted" style={{ margin: '8px 0 0' }}>{t('phone_settings')} → {t('settings')}</p>}
    </div>
  )
}
