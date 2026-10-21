// Caixa de entrada WhatsApp: conversas por número, envio pela Cloud API (Edge Function), ligação automática a contactos.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/api'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'

export default function WhatsApp() {
  const { t } = useT(); const toast = useToast()
  const [msgs, setMsgs] = useState([]); const [sel, setSel] = useState(null); const [text, setText] = useState(''); const [newNum, setNewNum] = useState('')
  const load = async () => { const { data } = await supabase.from('messages').select('*, contacts(first_name,last_name)').eq('channel', 'whatsapp').order('created_at', { ascending: false }).limit(500); setMsgs(data || []) }
  useEffect(() => { load(); const ch = supabase.channel('wa').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load).subscribe(); return () => supabase.removeChannel(ch) }, [])
  const threads = useMemo(() => {
    const m = new Map()
    msgs.forEach((x) => { const n = x.direction === 'entrada' ? x.from_number : x.to_number; if (!m.has(n)) m.set(n, { number: n, last: x, contact: x.contacts, unread: 0 }); if (x.direction === 'entrada' && x.status === 'recebida') m.get(n).unread++ })
    return [...m.values()]
  }, [msgs])
  const thread = msgs.filter((x) => (x.direction === 'entrada' ? x.from_number : x.to_number) === sel).reverse()
  const send = async () => {
    if (!sel || !text.trim()) return
    const { error } = await supabase.functions.invoke('whatsapp-send', { body: { to: sel, text } })
    if (error) toast(t('error') + ': ' + error.message); else { setText(''); load() }
  }
  return (
    <div className="page">
      <div className="page-head"><h1>{t('whatsapp')}</h1><div className="spacer" /><input className="input" style={{ width: 200 }} placeholder="+244 9…" value={newNum} onChange={(e) => setNewNum(e.target.value)} /><button className="btn" onClick={() => { if (newNum) { setSel(newNum.replace(/\s/g, '')); setNewNum('') } }}>+ {t('new')}</button></div>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, minHeight: 500 }}>
        <div className="card" style={{ padding: 0, overflowY: 'auto' }}>
          {threads.length === 0 && <div className="empty" style={{ border: 0 }}>{t('no_conversations')}</div>}
          {threads.map((th) => <div key={th.number} onClick={() => setSel(th.number)} style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: sel === th.number ? 'var(--aqua-2)' : '' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><strong>{th.contact ? `${th.contact.first_name} ${th.contact.last_name || ''}` : th.number}</strong>{th.unread > 0 && <span className="chip ok">{th.unread}</span>}</div>
            <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{th.last.body}</div></div>)}
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          {!sel ? <p className="muted">{t('conversations')}</p> : <>
            <h3>{sel}</h3>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {thread.map((m) => <div key={m.id} style={{ alignSelf: m.direction === 'saida' ? 'flex-end' : 'flex-start', maxWidth: '70%', background: m.direction === 'saida' ? 'var(--aqua-2)' : '#F3F7F9', borderRadius: 10, padding: '8px 12px' }}>
                <div>{m.body}</div><div className="small muted">{fmtDateTime(m.created_at)} · {m.status}</div></div>)}
            </div>
            <div className="row" style={{ marginTop: 10 }}><input className="input" placeholder={t('message')} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} /><button className="btn aqua" onClick={send}>{t('send')}</button></div>
          </>}
        </div>
      </div>
    </div>
  )
}
