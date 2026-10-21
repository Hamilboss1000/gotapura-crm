// Cálculo da próxima ocorrência de uma tarefa recorrente (espelho da função SQL).
// recurrence = { freq: 'daily'|'weekdays'|'weekly'|'monthly'|'yearly', interval: 1, until: 'YYYY-MM-DD'|null }

export const FREQ_LABELS = {
  none: 'Não se repete',
  daily: 'Diariamente',
  weekdays: 'Dias úteis (seg–sex)',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
  yearly: 'Anualmente',
}

export function nextDueDate(dueDate, rec) {
  if (!rec || !rec.freq || rec.freq === 'none' || !dueDate) return null
  const d = new Date(dueDate + 'T00:00:00')
  const n = Number(rec.interval) > 0 ? Number(rec.interval) : 1
  switch (rec.freq) {
    case 'daily': d.setDate(d.getDate() + n); break
    case 'weekdays': {
      d.setDate(d.getDate() + 1)
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
      break
    }
    case 'weekly': d.setDate(d.getDate() + 7 * n); break
    case 'monthly': d.setMonth(d.getMonth() + n); break
    case 'yearly': d.setFullYear(d.getFullYear() + n); break
    default: return null
  }
  const iso = d.toISOString().slice(0, 10)
  if (rec.until && iso > rec.until) return null
  return iso
}

export function describeRecurrence(rec) {
  if (!rec || !rec.freq || rec.freq === 'none') return ''
  const n = Number(rec.interval) || 1
  const base = FREQ_LABELS[rec.freq] || rec.freq
  const every = n > 1 ? ` (a cada ${n})` : ''
  const until = rec.until ? `, até ${rec.until}` : ''
  return `${base}${every}${until}`
}
