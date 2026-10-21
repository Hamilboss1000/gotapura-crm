// Gestão documental: pastas, idioma, versões e etiquetas, com ficheiros no Supabase Storage.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { list, remove, fmtDateTime } from '../lib/api'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'

const FOLDERS = ['/', '/contratos', '/propostas', '/facturas', '/manuais', '/certificados', '/marketing', '/rh']

export default function Documents() {
  const { t } = useT(); const toast = useToast()
  const [rows, setRows] = useState([]); const [folder, setFolder] = useState('/'); const [lang, setLang] = useState('pt'); const [tags, setTags] = useState(''); const [search, setSearch] = useState('')
  const load = async () => setRows(await list('documents', { select: '*, profiles:uploaded_by(full_name)', search, searchCols: ['name', 'folder'] }))
  useEffect(() => { load() }, [search])
  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const existing = rows.filter((r) => r.name === file.name && r.folder === folder)
    const version = existing.length ? Math.max(...existing.map((r) => r.version)) + 1 : 1
    const path = `${folder.replace(/^\//, '') || 'raiz'}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documents').upload(path, file)
    if (error) return toast(t('error') + ': ' + error.message)
    await supabase.from('documents').insert({ name: file.name, storage_path: path, mime: file.type, size_bytes: file.size, folder, language: lang, version, tags: tags.split(',').map((x) => x.trim()).filter(Boolean) })
    toast(t('saved')); setTags(''); load(); e.target.value = ''
  }
  const download = async (r) => { const { data } = await supabase.storage.from('documents').createSignedUrl(r.storage_path, 300); if (data?.signedUrl) window.open(data.signedUrl) }
  const del = async (r) => { if (!confirm(t('confirm_delete'))) return; await supabase.storage.from('documents').remove([r.storage_path]); await remove('documents', r.id); load() }
  const shown = rows.filter((r) => folder === '/' || r.folder === folder)
  return (
    <div className="page">
      <div className="page-head"><h1>{t('documents')}</h1><div className="spacer" /><input className="input" style={{ width: 240 }} placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="card row" style={{ marginBottom: 14 }}>
        <label className="field"><span>{t('folder')}</span><select className="input" value={folder} onChange={(e) => setFolder(e.target.value)}>{FOLDERS.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label className="field"><span>{t('language')}</span><select className="input" value={lang} onChange={(e) => setLang(e.target.value)}><option value="pt">Português</option><option value="en">English</option></select></label>
        <label className="field" style={{ flex: 1 }}><span>{t('tags')}</span><input className="input" placeholder="contrato, cliente X" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
        <label className="btn primary" style={{ alignSelf: 'flex-end' }}>{t('upload')}<input type="file" hidden onChange={upload} /></label>
      </div>
      {shown.length === 0 ? <div className="empty">{t('empty')}</div> : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>{t('name')}</th><th>{t('folder')}</th><th>{t('language')}</th><th>{t('version')}</th><th>{t('tags')}</th><th>{t('size')}</th><th>{t('owner')}</th><th></th></tr></thead>
          <tbody>{shown.map((r) => <tr key={r.id}>
            <td style={{ fontWeight: 500 }}>{r.name}</td><td>{r.folder}</td><td>{r.language}</td><td>v{r.version}</td>
            <td>{(r.tags || []).map((x) => <span key={x} className="chip grey" style={{ marginRight: 4 }}>{x}</span>)}</td>
            <td>{Math.round((r.size_bytes || 0) / 1024)} KB</td><td className="small">{r.profiles?.full_name}<br /><span className="muted">{fmtDateTime(r.created_at)}</span></td>
            <td className="row"><button className="btn sm" onClick={() => download(r)}>{t('download')}</button><button className="btn sm danger" onClick={() => del(r)}>×</button></td>
          </tr>)}</tbody>
        </table></div>
      )}
    </div>
  )
}
