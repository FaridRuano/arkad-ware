'use client';

import styles from './ScheduleExceptionDetailsModal.module.scss';

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ');

function getScopeLabel(exception) {
  if (exception?.scope === 'barber') {
    return exception?.barber?.name
      ? `Barbero · ${exception.barber.name}`
      : 'Barbero';
  }

  return 'Negocio completo';
}

function getTypeLabel(exception) {
  return exception?.type === 'time_range' ? 'Horario bloqueado' : 'Día bloqueado';
}

export default function ScheduleExceptionDetailsModal({
  open,
  exception,
  loading = false,
  onClose,
  onToggleActive,
}) {
  if (!open || !exception) return null;

  return (
    <div
      className={m('detailsModal')}
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose?.();
        }
      }}
    >
      <div className={m('detailsModal__panel')}>
        <div className={m('detailsModal__header')}>
          <div>
            <h3 className={m('detailsModal__title')}>{getTypeLabel(exception)}</h3>
            <p className={m('detailsModal__subtitle')}>{getScopeLabel(exception)}</p>
          </div>

          <button
            type="button"
            className={m('detailsModal__close')}
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className={m('detailsModal__body')}>
          <div className={m('detailsModal__meta')}>
            <span className={m('pill', exception?.isActive ? 'is-active' : 'is-inactive')}>
              {exception?.isActive ? 'Activa' : 'Inactiva'}
            </span>
            <span className={m('pill')}>{exception?.startDate}</span>
            {exception?.endDate && exception.endDate !== exception.startDate ? (
              <span className={m('pill')}>hasta {exception.endDate}</span>
            ) : null}
            {exception?.type === 'time_range' ? (
              <span className={m('pill')}>
                {exception?.startTime} - {exception?.endTime}
              </span>
            ) : null}
          </div>

          <div className={m('detailsModal__card')}>
            <div className={m('detailsModal__label')}>Motivo</div>
            <div className={m('detailsModal__value')}>
              {exception?.reason || 'Sin detalle adicional'}
            </div>
          </div>

          <div className={m('detailsModal__actions')}>
            <button
              type="button"
              className={m('button button--ghost')}
              onClick={() => onToggleActive?.(!exception?.isActive)}
              disabled={loading}
            >
              {exception?.isActive ? 'Desactivar' : 'Reactivar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
