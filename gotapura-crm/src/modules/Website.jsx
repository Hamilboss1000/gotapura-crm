// Construtor de website por blocos (PT/EN), com pré-visualização e exportação de HTML pronto a alojar.
import { useEffect, useState } from 'react'
import { list, save, remove } from '../lib/api'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'

const BLOCKS = { hero: 'Cabeçalho (título + subtítulo + botão)', text: 'Texto', image: 'Imagem', features: 'Lista de vantagens', products: 'Produtos em destaque', contact: 'Formulário de contacto (cria lead no CRM)', cta: 'Chamada à acção' }
const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export function renderHTML(page, supabaseUrl, anonKey) {
  const body = (page.blocks || []).map((b) => {
    switch (b.type) {
      case 'hero': return `<section class="hero"><h1>${esc(b.title)}</h1><p>${esc(b.text)}</p>${b.button ? `<a class="btn" href="${esc(b.link || '#contacto')}">${esc(b.button)}</a>` : ''}</section>`
      case 'text': return `<section><h2>${esc(b.title)}</h2><p>${esc(b.text).replace(/\n/g, '<br>')}</p></section>`
      case 'image': return `<section><img src="${esc(b.url)}" alt="${esc(b.title)}"><p>${esc(b.text)}</p></section>`
      case 'features': return `<section><h2>${esc(b.title)}</h2><ul>${(b.text || '').split('\n').filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`
      case 'products': return `<section><h2>${esc(b.title)}</h2><div class="grid">${(b.text || '').split('\n').filter(Boolean).map((x) => { const [n, pr] = x.split('|'); return `<div class="p"><h3>${esc(n)}</h3><p>${esc(pr || '')}</p></div>` }).join('')}</div></section>`
      case 'cta': return `<section class="cta"><h2>${esc(b.title)}</h2><a class="btn" href="${esc(b.link || '#contacto')}">${esc(b.button || 'Contactar')}</a></section>`
      case 'contact': return `<section id="contacto"><h2>${esc(b.title || 'Fale connosco')}</h2><form id="lead"><input name="name" placeholder="Nome" required><input name="phone" placeholder="Telefone"><input name="email" placeholder="E-mail" type="email"><textarea name="notes" placeholder="Mensagem"></textarea><button class="btn">${esc(b.button || 'Enviar')}</button><p id="ok" hidden>Mensagem recebida. Entraremos em contacto.</p></form>
<script>document.getElementById('lead').onsubmit=async(e)=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));await fetch('${supabaseUrl}/rest/v1/leads',{method:'POST',headers:{apikey:'${anonKey}',Authorization:'Bearer ${anonKey}','Content-Type':'application/json'},body:JSON.stringify({...f,source:'website'})});e.target.reset();document.getElementById('ok').hidden=false}</script></section>`
      default: return ''
    }
  }).join('\n')
  return `<!doctype html><html lang="${page.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)}</title>
<style>body{margin:0;font-family:system-ui,sans-serif;color:#13232E;line-height:1.6}section{max-width:960px;margin:0 auto;padding:40px 20px}.hero{background:linear-gradient(160deg,#0B3C5D,#1FA2C6);color:#fff;max-width:none;text-align:center;padding:90px 20px}.hero h1{font-size:40px;margin:0 0 10px}.btn{display:inline-block;background:#1FA2C6;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;border:0;font-size:16px;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.p{border:1px solid #DCE5EA;border-radius:8px;padding:16px}.cta{text-align:center;background:#E4F4F9;max-width:none}img{max-width:100%;border-radius:8px}form{display:grid;gap:10px;max-width:480px}input,textarea{padding:10px;border:1px solid #DCE5EA;border-radius:8px;font:inherit}</style></head><body>${body}<footer style="text-align:center;padding:30px;color:#8A98A1;font-size:13px">Gotapura · Tratamento de água · Angola</footer></body></html>`
}

export default function Website() {
  const { t } = useT(); const toast = useToast()
  const [pages, setPages] = useState([]); const [page, setPage] = useState(null); const [preview, setPreview] = useState(false)
  const load = async () => setPages(await list('website_pages', { order: 'slug', asc: true }))
  useEffect(() => { load() }, [])
  const addBlock = (type) => setPage((p) => ({ ...p, blocks: [...p.blocks, { type, title: '', text: '', button: '', link: '', url: '' }] }))
  const updBlock = (i, patch) => setPage((p) => ({ ...p, blocks: p.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }))
  const move = (i, d) => setPage((p) => { const b = [...p.blocks]; const j = i + d; if (j < 0 || j >= b.length) return p; [b[i], b[j]] = [b[j], b[i]]; return { ...p, blocks: b } })
  const onSave = async () => { try { await save('website_pages', { ...page, updated_at: new Date().toISOString() }); toast(t('saved')); load() } catch (e) { toast(t('error') + ': ' + e.message) } }
  const exportHTML = () => { const html = renderHTML(page, import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = `${page.slug || 'index'}.${page.language}.html`; a.click() }
  return (
    <div className="page">
      <div className="page-head"><h1>{t('website')}</h1><div className="spacer" />
        {page && <><button className="btn" onClick={() => setPreview(!preview)}>{t('preview')}</button><button className="btn" onClick={exportHTML}>{t('export_html')}</button><button className="btn primary" onClick={onSave}>{t('save')}</button></>}
        <button className="btn" onClick={() => setPage({ slug: 'index', language: 'pt', title: 'Gotapura — Água pura para a sua casa e empresa', blocks: [], published: false })}>+ {t('new')}</button></div>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 8 }}>
          {pages.map((p) => <div key={p.id} className="row" style={{ padding: '6px 8px', cursor: 'pointer', background: page?.id === p.id ? 'var(--aqua-2)' : '', borderRadius: 6 }} onClick={() => { setPage(p); setPreview(false) }}><span style={{ flex: 1 }}>/{p.slug} <span className="chip grey">{p.language}</span></span>{p.published && <span className="chip ok">●</span>}<button className="btn sm ghost" onClick={async (e) => { e.stopPropagation(); if (confirm(t('confirm_delete'))) { await remove('website_pages', p.id); setPage(null); load() } }}>×</button></div>)}
          {pages.length === 0 && <p className="muted small">—</p>}
        </div>
        {!page ? <div className="empty">{t('empty')}</div> : preview ? (
          <iframe title="preview" style={{ width: '100%', height: '75vh', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} srcDoc={renderHTML(page, import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)} />
        ) : (
          <div className="card">
            <div className="grid3">
              <label className="field"><span>{t('page_slug')}</span><input className="input" value={page.slug} onChange={(e) => setPage({ ...page, slug: e.target.value })} /></label>
              <label className="field"><span>{t('language')}</span><select className="input" value={page.language} onChange={(e) => setPage({ ...page, language: e.target.value })}><option value="pt">Português</option><option value="en">English</option></select></label>
              <label className="field"><span>{t('publish')}</span><input type="checkbox" checked={page.published} onChange={(e) => setPage({ ...page, published: e.target.checked })} /></label>
              <label className="field" style={{ gridColumn: 'span 3' }}><span>{t('page_title')}</span><input className="input" value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} /></label>
            </div>
            <h3 style={{ marginTop: 14 }}>{t('blocks')}</h3>
            {page.blocks.map((b, i) => <div key={i} className="block-row">
              <div style={{ flex: 1 }}>
                <div className="row"><span className="chip">{BLOCKS[b.type]}</span><div style={{ flex: 1 }} /><button className="btn sm" onClick={() => move(i, -1)}>↑</button><button className="btn sm" onClick={() => move(i, 1)}>↓</button><button className="btn sm danger" onClick={() => setPage((p) => ({ ...p, blocks: p.blocks.filter((_, j) => j !== i) }))}>×</button></div>
                <div className="grid2" style={{ marginTop: 6 }}>
                  <input className="input" placeholder={t('title')} value={b.title} onChange={(e) => updBlock(i, { title: e.target.value })} />
                  {['hero', 'cta', 'contact'].includes(b.type) && <input className="input" placeholder="Texto do botão" value={b.button} onChange={(e) => updBlock(i, { button: e.target.value })} />}
                  {['hero', 'cta'].includes(b.type) && <input className="input" placeholder="Ligação do botão (#contacto, https://…)" value={b.link} onChange={(e) => updBlock(i, { link: e.target.value })} />}
                  {b.type === 'image' && <input className="input" placeholder="URL da imagem" value={b.url} onChange={(e) => updBlock(i, { url: e.target.value })} />}
                  {b.type !== 'cta' && b.type !== 'contact' && <textarea className="input" style={{ gridColumn: 'span 2', minHeight: 60 }} placeholder={b.type === 'features' ? 'Uma vantagem por linha' : b.type === 'products' ? 'Nome | Descrição ou preço (um por linha)' : t('content')} value={b.text} onChange={(e) => updBlock(i, { text: e.target.value })} />}
                </div>
              </div></div>)}
            <div className="row">{Object.entries(BLOCKS).map(([k, v]) => <button key={k} className="btn sm" onClick={() => addBlock(k)}>+ {v.split(' (')[0]}</button>)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
