import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

// Arranque defensivo: em vez de uma página em branco, mostra no ecrã a causa de qualquer falha.
const root = ReactDOM.createRoot(document.getElementById('root'))

function showError(title, detail) {
  root.render(
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 640, margin: '40px auto', color: '#13232E' }}>
      <h2 style={{ color: '#C43E3E', marginTop: 0 }}>{title}</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#F3F7F9', padding: 12, borderRadius: 8, fontSize: 13 }}>{detail}</pre>
    </div>
  )
}
window.addEventListener('error', (e) => showError('Erro na aplicação', e.message))
window.addEventListener('unhandledrejection', (e) => showError('Erro na aplicação', String(e.reason?.stack || e.reason)))

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  showError('Faltam as variáveis de ligação ao Supabase',
    `VITE_SUPABASE_URL: ${url ? 'OK' : 'EM FALTA'}\nVITE_SUPABASE_ANON_KEY: ${key ? 'OK' : 'EM FALTA'}\n\n` +
    'No Vercel: Settings → Environment Variables → adicionar a(s) variável(is) em falta → Deployments → Redeploy.')
} else {
  import('./App')
    .then(({ default: App }) => root.render(<React.StrictMode><App /></React.StrictMode>))
    .catch((e) => showError('Erro ao carregar a aplicação', String(e?.stack || e)))
}
