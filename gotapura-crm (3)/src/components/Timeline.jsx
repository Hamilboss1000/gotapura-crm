// Cronologia de um registo: notas, chamadas, mensagens e tarefas associadas.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/api'
import { useT } from '../lib/i18n'

export default function Timeline({ table, id, contactId }) {
  const { t } = useT()
  const [items, setItems] = useState([])
  const [note, setNote] = useState('')
  const load = async () => {
    const [a, tk, c] = await Promise.all([
      supabase.from('activities').select('*, profiles:user_id(full_name)').eq('linked_table', table).eq('linked_id', id).order('occurred_at', { ascending: false }).limit(50),
      supabase.from('tasks').select('id, title, due_date, status').eq('linked_table', table).eq('linked_id', id).order('due_date'),
      contactId ? supabase.from('call_logs').select('*').eq('contact_id', contactId).order('started_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    ])
    const rows = [
      ...(a.data || []).map((x) => ({ id: x.id, when: x.occurred_at, kind: x.kind, text: x.subject || x.body, who: x.profiles?.full_name })),
      ...(tk.data || []).map((x) => ({ id: x.id, when: x.due_date, kind: 'tarefa', text: `${x.title} (${x.status})` })),
      ...(c.data || []).map((x) => ({ id: x.id, when: x.started_at, kind: 'chamada', text: `${x.direction} ${x.number} · ${x.duration_seconds || 0}s ${x.notes ? '— ' + x.notes : ''}` })),
    ].sort((x, y) => new Date(y.when) - new Date(x.when))
    setItems(rows)
  }
  useEffect(() => { load() }, [table, id])
  const addNote = async () => {
    if (!note.trim()) return
    await supabase.from('activities').insert({ kind: 'nota', body: note, linked_table: table, linked_id: id, contact_id: contactId })
    setNote(''); load()
  }
  return (
    <div>
      <h3>{t('recent')}</h3>
      <div className="row"><input className="input" placeholder={t('notes')} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} /><button className="btn" onClick={addNote}>+</button></div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
        {items.map((i) => <li key={i.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
          <span className="chip grey">{i.kind}</span> <span>{i.text}</span> <span className="muted small">· {fmtDateTime(i.when)}{i.who ? ' · ' + i.who : ''}</span>
        </li>)}
        {items.length === 0 && <li className="muted small">—</li>}
      </ul>
    </div>
  )
}
