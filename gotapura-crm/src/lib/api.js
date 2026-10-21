import { supabase } from './supabase'

export async function list(table, { select = '*', order = 'created_at', asc = false, filters = [], search, searchCols = [], limit = 500 } = {}) {
  let q = supabase.from(table).select(select).order(order, { ascending: asc }).limit(limit)
  for (const [col, op, val] of filters) q = q[op](col, val)
  if (search && searchCols.length) q = q.or(searchCols.map((c) => `${c}.ilike.%${search}%`).join(','))
  const { data, error } = await q
  if (error) throw error
  return data
}
export async function save(table, record) {
  const { id, ...rest } = record
  const q = id ? supabase.from(table).update(rest).eq('id', id) : supabase.from(table).insert(rest)
  const { data, error } = await q.select().single()
  if (error) throw error
  return data
}
export async function remove(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}
export async function profiles() {
  const { data } = await supabase.from('profiles').select('id, full_name, email, role, department, extension, active').order('full_name')
  return data || []
}
export const fmtMoney = (n, cur = 'AOA') => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(n || 0))
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-PT') : '')
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('pt-PT') : '')
export const today = () => new Date().toISOString().slice(0, 10)
