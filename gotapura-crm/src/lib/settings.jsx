// Definições globais: empresa/logótipo, moedas e campos personalizados.
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const DEFAULT_COMPANY = { name: 'Gotapura', tagline: 'Tratamento de água', logo_url: null, nif: '', address: '', phone: '', email: '', base_currency: 'AOA' }
const DEFAULT_CURRENCIES = [{ code: 'AOA', symbol: 'Kz', name: 'Kwanza', rate: 1, is_base: true, active: true }]
const Ctx = createContext(null)

export function SettingsProvider({ children }) {
  const [company, setCompany] = useState(DEFAULT_COMPANY)
  const [currencies, setCurrencies] = useState(DEFAULT_CURRENCIES)
  const [fields, setFields] = useState([])
  const reload = useCallback(async () => {
    const [s, c, f] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'company').maybeSingle(),
      supabase.from('currencies').select('*').order('is_base', { ascending: false }),
      supabase.from('custom_fields').select('*').order('position'),
    ])
    if (s.data?.value) setCompany({ ...DEFAULT_COMPANY, ...s.data.value })
    if (c.data?.length) setCurrencies(c.data)
    setFields(f.data || [])
  }, [])
  useEffect(() => { reload() }, [reload])

  const base = currencies.find((x) => x.is_base) || currencies[0]
  const cur = (code) => currencies.find((x) => x.code === code) || base
  const toBase = (amount, code) => Number(amount || 0) * Number(cur(code).rate || 1)
  const fmtMoney = (amount, code = base.code) => {
    const c = cur(code); const n = Number(amount || 0)
    const num = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n)
    return c.code === 'AOA' ? `${num} ${c.symbol}` : `${c.symbol} ${num}`
  }
  const customFields = (module) => fields.filter((f) => f.module === module)
  return <Ctx.Provider value={{ company, currencies: currencies.filter((c) => c.active), allCurrencies: currencies, base, fmtMoney, toBase, customFields, reload }}>{children}</Ctx.Provider>
}
export const useSettings = () => useContext(Ctx)
