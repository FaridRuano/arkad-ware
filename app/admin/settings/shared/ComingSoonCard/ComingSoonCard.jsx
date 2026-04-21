import { Sparkles, ArrowUpRight, Clock3 } from 'lucide-react'
import styles from './ComingSoonCard.module.scss'

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ')

export default function ComingSoonCard({
  eyebrow = 'Próximamente',
  title = 'Módulo en construcción',
  description = 'Esta sección estará disponible pronto con una experiencia completa y más herramientas operativas.',
  points = [],
}) {
  return (
    <section className={m('comingSoon page')}>
      <div className={m('comingSoon__hero')}>
        <div className={m('comingSoon__icon')}>
          <Sparkles size={26} />
        </div>

        <div className={m('comingSoon__content')}>
          <span className={m('comingSoon__eyebrow')}>{eyebrow}</span>
          <h1 className={m('comingSoon__title')}>{title}</h1>
          <p className={m('comingSoon__text')}>{description}</p>
        </div>

        <div className={m('comingSoon__status')}>
          <Clock3 size={15} />
          <span>En preparación</span>
        </div>
      </div>

      <div className={m('comingSoon__grid')}>
        <article className={m('comingSoon__panel')}>
          <div className={m('comingSoon__panelTop')}>
            <h2>Qué llegará aquí</h2>
            <ArrowUpRight size={16} />
          </div>

          <div className={m('comingSoon__list')}>
            {points.map((point) => (
              <div className={m('comingSoon__item')} key={point}>
                <span className={m('comingSoon__bullet')} />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={m('comingSoon__panel comingSoon__panel--soft')}>
          <span className={m('comingSoon__noteLabel')}>Estado</span>
          <strong className={m('comingSoon__noteValue')}>Diseño reservado</strong>
          <p className={m('comingSoon__noteText')}>
            Dejamos esta vista lista para que la navegación no se sienta vacía mientras construimos el módulo real.
          </p>
        </article>
      </div>
    </section>
  )
}
