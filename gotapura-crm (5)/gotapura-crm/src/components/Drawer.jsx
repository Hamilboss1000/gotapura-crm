import { useT } from '../lib/i18n'
export default function Drawer({ title, onClose, children, footer }) {
  const { t } = useT()
  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="head"><h2>{title}</h2><button className="btn ghost" onClick={onClose}>{t('close')}</button></div>
        {children}
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>
  )
}
