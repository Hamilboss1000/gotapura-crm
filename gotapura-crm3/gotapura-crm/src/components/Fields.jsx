// Formulário genérico guiado por configuração: [{ key, label, type, options, required, span }]
import { useT } from '../lib/i18n'

export function Field({ f, value, onChange, people = [], options = {} }) {
  const { t } = useT()
  const label = f.label || t(f.key)
  const v = value ?? ''
  const set = (x) => onChange(f.key, x)
  const inner = () => {
    switch (f.type) {
      case 'textarea': return <textarea className="input" value={v} onChange={(e) => set(e.target.value)} />
      case 'number': return <input className="input" type="number" step="any" value={v} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />
      case 'date': return <input className="input" type="date" value={v} onChange={(e) => set(e.target.value || null)} />
      case 'time': return <input className="input" type="time" value={v} onChange={(e) => set(e.target.value || null)} />
      case 'checkbox': return <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
      case 'select': return (
        <select className="input" value={v} onChange={(e) => set(e.target.value || null)}>
          <option value="">—</option>
          {(f.options || []).map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>)
      case 'person': return (
        <select className="input" value={v} onChange={(e) => set(e.target.value || null)}>
          <option value="">{t('unassigned')}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
        </select>)
      case 'lookup': return (
        <select className="input" value={v} onChange={(e) => set(e.target.value || null)}>
          <option value="">—</option>
          {(options[f.lookup] || []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>)
      default: return <input className="input" type={f.type || 'text'} value={v} required={f.required} onChange={(e) => set(e.target.value)} />
    }
  }
  return <label className="field" style={f.span ? { gridColumn: `span ${f.span}` } : undefined}><span>{label}{f.required ? ' *' : ''}</span>{inner()}</label>
}

export function Form({ fields, values, onChange, people, options }) {
  return <div className="grid2">{fields.map((f) => <Field key={f.key} f={f} value={values[f.key]} onChange={onChange} people={people} options={options} />)}</div>
}
