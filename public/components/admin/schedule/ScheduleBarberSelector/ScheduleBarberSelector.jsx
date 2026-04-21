'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './ScheduleBarberSelector.module.scss';

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ');

export default function ScheduleBarberSelector({
  barbers = [],
  selectedBarberId = '',
  onChange,
}) {
  const rootRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const normalizedSelectedId = useMemo(() => {
    return String(selectedBarberId || '');
  }, [selectedBarberId]);

  const options = useMemo(() => {
    return [
      {
        id: '',
        name: 'Todos',
        color: 'var(--primary)',
        isAll: true,
      },
      ...(Array.isArray(barbers) ? barbers : []).map((barber) => ({
        id: String(barber?.id || ''),
        name: barber?.name || 'Barbero',
        color: barber?.color || 'var(--primary)',
        isAll: false,
      })),
    ];
  }, [barbers]);

  const selectedOption = useMemo(() => {
    return (
      options.find((option) => String(option.id) === normalizedSelectedId) ||
      options[0]
    );
  }, [options, normalizedSelectedId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    const handleMouseDown = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleSelect = (id) => {
    const nextId = String(id || '');
    onChange?.(nextId);
    setMobileOpen(false);
  };

  return (
      <div className={m('scheduleBarberSelector')} ref={rootRef}>
      <div className={m('scheduleBarberSelector__desktop')}>
        {options.map((option) => {
          const isActive = String(option.id) === normalizedSelectedId;

          return (
            <button
              key={option.id || 'all'}
              type="button"
              className={m(
                'scheduleBarberSelector__card',
                option.isAll && 'scheduleBarberSelector__card--all',
                isActive && 'is-active',
              )}
              onClick={() => handleSelect(option.id)}
              style={{
                '--barber-color': option.color,
              }}
            >
              <span className={m('scheduleBarberSelector__name')}>
                {option.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className={m('scheduleBarberSelector__mobile')}>
        <button
          type="button"
          className={m(
            'scheduleBarberSelector__card scheduleBarberSelector__trigger',
            selectedOption?.isAll && 'scheduleBarberSelector__card--all',
            mobileOpen && 'is-open',
          )}
          onClick={() => setMobileOpen((prev) => !prev)}
          style={{
            '--barber-color': selectedOption?.color || 'var(--primary)',
          }}
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
        >
          <span className={m('scheduleBarberSelector__name')}>
            {selectedOption?.name || 'Todos'}
          </span>

          <span className={m('scheduleBarberSelector__chevron')}>
            {mobileOpen ? '−' : '+'}
          </span>
        </button>

        {mobileOpen && (
          <div
            className={m('scheduleBarberSelector__dropdown')}
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setMobileOpen(false);
              }
            }}
          >
            <div
              className={m('scheduleBarberSelector__dropdownInner')}
              role="listbox"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {options.map((option) => {
                const isActive = String(option.id) === normalizedSelectedId;

                return (
                  <button
                    key={option.id || 'all-mobile'}
                    type="button"
                    className={m(
                      'scheduleBarberSelector__option',
                      option.isAll && 'scheduleBarberSelector__option--all',
                      isActive && 'is-active',
                    )}
                    onClick={() => handleSelect(option.id)}
                    style={{
                      '--barber-color': option.color,
                    }}
                  >
                    <span className={m('scheduleBarberSelector__name')}>
                      {option.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
  );
}
