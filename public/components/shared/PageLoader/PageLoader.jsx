'use client'

import styles from './PageLoader.module.scss'

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ')

export default function PageLoader({
  title = 'Cargando...',
  text = 'Espera un momento mientras se actualiza la información.',
  className = '',
}) {
  return (
    <div className={m('pageLoader', className)} role="status" aria-live="polite">
      <div className={m('pageLoader__visual')} aria-hidden="true">
        <div className={m('pageLoader__spinner')} />
        <div className={m('pageLoader__glow')} />
      </div>

      <div className={m('pageLoader__skeleton')} aria-hidden="true">
        <span className={m('pageLoader__line pageLoader__line--lg')} />
        <span className={m('pageLoader__line')} />
        <span className={m('pageLoader__line pageLoader__line--sm')} />
      </div>

      <span className={m('pageLoader__title')}>{title}</span>
      <span className={m('pageLoader__text')}>{text}</span>
    </div>
  )
}
