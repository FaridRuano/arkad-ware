'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './ScheduleExceptionModal.module.scss';

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ');

function getInitialForm({ mode, dateISO }) {
  return {
    startTime: mode === 'time_range' ? '09:00' : '',
    endTime: mode === 'time_range' ? '10:00' : '',
    reason: '',
  };
}

export default function ScheduleExceptionModal({
  open,
  mode = 'full_day',
  scope = 'business',
  dateISO = '',
  selectedBarber = null,
  saving = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(getInitialForm({ mode, dateISO }));
  const [error, setError] = useState('');

  const title = useMemo(() => {
    if (scope === 'barber') {
      return mode === 'time_range' ? 'Cerrar horas del barbero' : 'Cerrar día del barbero';
    }

    return mode === 'time_range' ? 'Cerrar horas del negocio' : 'Cerrar día del negocio';
  }, [mode, scope]);

  const subtitle = useMemo(() => {
    if (scope === 'barber') {
      return selectedBarber?.name
        ? `Aplica solo para ${selectedBarber.name}.`
        : 'Aplica solo para el barbero seleccionado.';
    }

    return 'Aplica para todo el negocio y todos los barberos.';
  }, [scope, selectedBarber]);

  useEffect(() => {
    if (!open) return;
    setForm(getInitialForm({ mode, dateISO }));
    setError('');
  }, [open, mode, dateISO]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        onClose?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  const handleField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await onSubmit?.({
        scope,
        barberId: scope === 'barber' ? selectedBarber?.id || '' : '',
        type: mode,
        startDate: dateISO,
        endDate: dateISO,
        ...form,
      });
    } catch (submitError) {
      setError(submitError?.message || 'No se pudo guardar la excepción');
    }
  };

  return (
    <div
      className={m('exceptionModal')}
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose?.();
        }
      }}
    >
      <div className={m('exceptionModal__panel')}>
        <div className={m('exceptionModal__header')}>
          <div>
            <h3 className={m('exceptionModal__title')}>{title}</h3>
            <p className={m('exceptionModal__subtitle')}>{subtitle}</p>
          </div>

          <button
            type="button"
            className={m('exceptionModal__close')}
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <form className={m('exceptionModal__body')} onSubmit={handleSubmit}>
          {error ? <div className={m('exceptionModal__error')}>{error}</div> : null}

          <div className={m('exceptionModal__dayInfo')}>
            <span className={m('exceptionModal__dayLabel')}>Día seleccionado</span>
            <strong className={m('exceptionModal__dayValue')}>{dateISO || '—'}</strong>
          </div>

          {mode === 'time_range' ? (
            <div className={m('exceptionModal__grid')}>
              <label className={m('field')}>
                <span className={m('field__label')}>Desde</span>
                <input
                  className={m('field__input')}
                  type="time"
                  value={form.startTime}
                  onChange={(event) => handleField('startTime', event.target.value)}
                  disabled={saving}
                  required
                />
              </label>

              <label className={m('field')}>
                <span className={m('field__label')}>Hasta</span>
                <input
                  className={m('field__input')}
                  type="time"
                  value={form.endTime}
                  onChange={(event) => handleField('endTime', event.target.value)}
                  disabled={saving}
                  required
                />
              </label>
            </div>
          ) : null}

          <label className={m('field')}>
            <span className={m('field__label')}>Razón</span>
            <textarea
              className={m('field__textarea')}
              rows={3}
              value={form.reason}
              onChange={(event) => handleField('reason', event.target.value)}
              disabled={saving}
              placeholder="Ej. Permiso, cita médica, cierre especial..."
            />
          </label>

          <div className={m('exceptionModal__footer')}>
            <button
              type="button"
              className={m('button button--ghost')}
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className={m('button button--primary')}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar excepción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
