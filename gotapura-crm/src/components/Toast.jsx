import { createContext, useContext, useState, useCallback } from 'react'
const Ctx = createContext(() => {})
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const show = useCallback((m) => { setMsg(m); setTimeout(() => setMsg(null), 2500) }, [])
  return <Ctx.Provider value={show}>{children}{msg && <div className="toast">{msg}</div>}</Ctx.Provider>
}
export const useToast = () => useContext(Ctx)
