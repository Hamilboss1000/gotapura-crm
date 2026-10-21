import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { I18nProvider, useT } from './lib/i18n'
import { ToastProvider } from './components/Toast'
import { SettingsProvider, useSettings } from './lib/settings'
import Auth from './components/Auth'
import Layout from './components/Layout'
import Dashboard from './modules/Dashboard'
import Records from './modules/Records'
import Opportunities from './modules/Opportunities'
import Projects from './modules/Projects'
import Tasks from './modules/Tasks'
import Quotes from './modules/Quotes'
import Documents from './modules/Documents'
import WhatsApp from './modules/WhatsApp'
import Social from './modules/Social'
import Website from './modules/Website'
import Automations from './modules/Automations'
import Integrations from './modules/Integrations'
import Users from './modules/Users'
import Settings from './modules/Settings'
import Import from './modules/Import'

function Shell() {
  const { t } = useT(); const { reload: reloadSettings } = useSettings()
  const [session, setSession] = useState(undefined); const [profile, setProfile] = useState(null)
  const loadProfile = async (s) => { if (!s) return setProfile(null); const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).single(); setProfile(data); reloadSettings() }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); loadProfile(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); loadProfile(s) })
    return () => sub.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <div className="page muted">{t('loading')}</div>
  if (!session) return <Auth />
  if (!profile) return <div className="page muted">{t('loading')}</div>
  if (!profile.active) return <div className="auth"><div className="card">Conta desactivada. Contacte o administrador.</div></div>
  const user = session.user
  const isAdmin = ['admin', 'manager'].includes(profile.role)
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout profile={profile} />}>
          <Route index element={<Dashboard user={user} profile={profile} />} />
          <Route path="leads/:id?" element={<Records module="leads" />} />
          <Route path="contacts/:id?" element={<Records module="contacts" />} />
          <Route path="organizations/:id?" element={<Records module="organizations" />} />
          <Route path="products/:id?" element={<Records module="products" />} />
          <Route path="opportunities/:id?" element={<Opportunities />} />
          <Route path="projects/:id?" element={<Projects />} />
          <Route path="tasks/:id?" element={<Tasks user={user} />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="documents" element={<Documents />} />
          <Route path="import" element={profile.role !== 'viewer' ? <Import /> : <Navigate to="/" />} />
          <Route path="whatsapp" element={<WhatsApp />} />
          <Route path="social" element={<Social />} />
          <Route path="website" element={<Website />} />
          <Route path="automations" element={isAdmin ? <Automations /> : <Navigate to="/" />} />
          <Route path="integrations" element={isAdmin ? <Integrations /> : <Navigate to="/" />} />
          <Route path="users" element={isAdmin ? <Users profile={profile} /> : <Navigate to="/" />} />
          <Route path="settings" element={<Settings profile={profile} reload={() => loadProfile(session)} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() { return <I18nProvider><ToastProvider><SettingsProvider><Shell /></SettingsProvider></ToastProvider></I18nProvider> }
