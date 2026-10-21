// Etiquetas: escreva e prima Enter ou vírgula; clique numa etiqueta para a remover.
import { useState } from 'react'
export default function TagInput({ value = [], onChange, placeholder = 'Etiqueta…', suggestions = [] }) {
  const [text, setText] = useState('')
  const add = (t) => { const v = t.trim().replace(/,$/, ''); if (v && !value.includes(v)) onChange([...value, v]); setText('') }
  return (
    <div className="tags">
      {value.map((t) => <span key={t} className="chip tag" onClick={() => onChange(value.filter((x) => x !== t))}>{t} ×</span>)}
      <input className="tag-in" list="tag-suggestions" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text) } if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1)) }}
        onBlur={() => text && add(text)} />
      {suggestions.length > 0 && <datalist id="tag-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  )
}
