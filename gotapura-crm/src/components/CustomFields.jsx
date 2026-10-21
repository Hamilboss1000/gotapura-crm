// Campos personalizados definidos pelo administrador (Definições → Campos personalizados), guardados em record.custom
import { useSettings } from '../lib/settings'
export default function CustomFields({ module, value = {}, onChange }) {
  const { customFields } = useSettings()
  const defs = customFields(module)
  if (!defs.length) return null
  const set = (k, v) => onChange({ ...(value || {}), [k]: v })
  return (
    <div className="grid2">
      {defs.map((f) => {
        const v = value?.[f.key] ?? ''
        const inner = f.type === 'select' ? <select className="input" value={v} onChange={(e) => set(f.key, e.target.value)}><option value="">—</option>{(f.options || []).map((o) => <option key={o}>{o}</option>)}</select>
          : f.type === 'checkbox' ? <input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} />
          : f.type === 'textarea' ? <textarea className="input" value={v} onChange={(e) => set(f.key, e.target.value)} />
          : <input className="input" type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={v} onChange={(e) => set(f.key, e.target.value)} />
        return <label key={f.key} className="field"><span>{f.label}{f.required ? ' *' : ''}</span>{inner}</label>
      })}
    </div>
  )
}
