'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '@public/components/shared/AdminModalStyles/AdminModalStyles.module.scss';

const m = (...names) => names.filter(Boolean).map((name) => styles[name] ?? name).join(' ');

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return n.toFixed(2).replace(/\.00$/, '');
}

function getClientId(client) {
  return client?.id ?? client?._id ?? '';
}

function getClientName(client) {
  return (
    client?.name ||
    `${client?.firstName ?? ''} ${client?.lastName ?? ''}`.trim() ||
    '—'
  );
}

function getClientPhone(client) {
  return client?.phone || '';
}

export default function AppCreateModal({
  open,
  saving = false,
  dateISO = '',
  timeHM = '',
  onClose,
  onCreate,

  services = [],
  barbers = [],
  selectedBarberId = '',
}) {
  const justPickedRef = useRef(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const formAbortRef = useRef(null);

  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [selectedClient, setSelectedClient] = useState(null);
  const [serviceId, setServiceId] = useState('');
  const [barberPickId, setBarberPickId] = useState('');

  const [formState, setFormState] = useState({
    loading: false,
    data: null,
  });

  const [err, setErr] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const startAtISO = useMemo(() => {
    if (!dateISO || !timeHM) return '';
    return `${dateISO}T${timeHM}:00-05:00`;
  }, [dateISO, timeHM]);

  const availableServices = useMemo(() => {
    if (!Array.isArray(services)) return [];

    return services.filter((service) => service?.id && service?.name);
  }, [services]);

  const selectedService = useMemo(() => {
    return availableServices.find((s) => s.id === serviceId) || null;
  }, [availableServices, serviceId]);

  const isLockedBarber = !!selectedBarberId;

  const finalBarberId = useMemo(() => {
    return selectedBarberId || barberPickId || '';
  }, [selectedBarberId, barberPickId]);

  const availableBarbers = useMemo(() => {
    return Array.isArray(formState?.data?.barbers) ? formState.data.barbers : [];
  }, [formState]);

  const selectedBarberMeta = useMemo(() => {
    if (!finalBarberId) return null;

    const fromAvailable = availableBarbers.find((b) => b.id === finalBarberId);
    if (fromAvailable) return fromAvailable;

    const fromGlobal = Array.isArray(barbers)
      ? barbers.find((b) => b.id === finalBarberId)
      : null;

    return fromGlobal || null;
  }, [availableBarbers, barbers, finalBarberId]);

  const canValidateForm = useMemo(() => {
    if (!open) return false;
    if (!startAtISO) return false;
    if (!serviceId) return false;
    return true;
  }, [open, startAtISO, serviceId]);

  useEffect(() => {
    if (!open) return;

    setQ('');
    setResults([]);
    setSearching(false);
    setSelectedClient(null);
    setServiceId('');
    setBarberPickId('');
    setErr('');
    setDropdownOpen(false);
    setFormState({
      loading: false,
      data: null,
    });

    const t = setTimeout(() => {
      inputRef.current?.focus?.();
    }, 50);

    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!err) return;
    const t = setTimeout(() => setErr(''), 5000);
    return () => clearTimeout(t);
  }, [err]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (formAbortRef.current) formAbortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (justPickedRef.current) return;

    const term = (q || '').trim();

    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearching(true);

        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        const params = new URLSearchParams();
        params.set('q', term);
        params.set('page', '1');

        const res = await fetch(`/api/admin/clients?${params.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: abortRef.current.signal,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Error buscando clientes');

        const list = data?.clients || data?.users || data?.results || [];
        setResults(Array.isArray(list) ? list : []);
        setDropdownOpen(true);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!canValidateForm) {
      setFormState({
        loading: false,
        data: null,
      });
      return;
    }

    const payload = {
      date: dateISO,
      time: timeHM,
      startAt: startAtISO,
      ...(serviceId ? { serviceId } : {}),
      ...(finalBarberId ? { barberId: finalBarberId } : {}),
    };

    const run = async () => {
      try {
        setFormState((prev) => ({
          ...prev,
          loading: true,
        }));

        if (formAbortRef.current) formAbortRef.current.abort();
        formAbortRef.current = new AbortController();

        const res = await fetch('/api/admin/schedule/form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(payload),
          signal: formAbortRef.current.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.error || data?.errors?.[0] || 'Error validando formulario'
          );
        }

        setFormState({
          loading: false,
          data,
        });

        if (!selectedBarberId && barberPickId) {
          const currentBarber = Array.isArray(data?.barbers)
            ? data.barbers.find((b) => b.id === barberPickId)
            : null;

          if (!currentBarber?.enabled) {
            setBarberPickId('');
          }
        }
      } catch (e) {
        if (e?.name === 'AbortError') return;

        setFormState({
          loading: false,
          data: null,
        });
      }
    };

    run();
  }, [
    canValidateForm,
    dateISO,
    timeHM,
    startAtISO,
    serviceId,
    finalBarberId,
    selectedBarberId,
    barberPickId,
  ]);

  const pickClient = (client) => {
    const id = getClientId(client);
    const name = getClientName(client);
    const phone = getClientPhone(client);

    justPickedRef.current = true;

    setSelectedClient({ ...client, id, name, phone });
    setDropdownOpen(false);
    setQ('');

    setTimeout(() => {
      justPickedRef.current = false;
    }, 0);
  };

  const validate = () => {
    if (!dateISO || !timeHM) return 'Falta fecha u hora';
    if (!selectedClient?.id) return 'Selecciona un cliente';
    if (!serviceId) return 'Selecciona un servicio';

    const validation = formState?.data?.validation;

    if (validation && validation?.startAtValid === false) {
      return 'La fecha u hora no son válidas';
    }

    if (validation && validation?.serviceValid === false) {
      return 'El servicio seleccionado no es válido';
    }

    if (finalBarberId) {
      if (validation && validation?.barberValid === false) {
        return 'El barbero seleccionado no está disponible';
      }

      if (selectedBarberMeta && selectedBarberMeta?.enabled === false) {
        return selectedBarberMeta?.reason || 'Barbero no disponible';
      }
    }

    return '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErr('');

    const msg = validate();
    if (msg) {
      setErr(msg);
      return;
    }

    const payload = {
      clientId: selectedClient.id,
      barberId: finalBarberId || '',
      serviceId,
      date: dateISO,
      time: timeHM,
      startAt: startAtISO,
    };

    onCreate?.(payload);
  };

  if (!open) return null;

  const handleClose = () => {
    // limpiar form principal
    setFormState({
      loading: false,
      data: null,
    });

    // limpiar búsqueda cliente
    setQ('');
    setResults([]);
    setSearching(false);

    // limpiar selección
    setSelectedClient(null);
    setServiceId('');
    setBarberPickId('');

    // limpiar errores / warnings
    setErr('');
    setDropdownOpen(false);

    // abortar requests activos
    if (abortRef.current) abortRef.current.abort();
    if (formAbortRef.current) formAbortRef.current.abort();

    // cerrar modal
    onClose?.();
  };

  return (
    <div
      className={m('modalOverlay')}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={m('modalCard')} style={{ maxWidth: 620 }}>
        <header className={m('modalHeader')}>
          <h3 className={m('modalTitle')}>Nueva cita</h3>

          <button
            className={m('modalClose')}
            onClick={handleClose}
            disabled={saving}
            aria-label="Cerrar"
            type="button"
          >
            ✕
          </button>
        </header>

        <form className={m('modalBody')} onSubmit={handleSubmit}>
          {err && <div className={m('modalError')}>{err}</div>}

          {!!formState?.data?.errors?.length && (
            <div className={m('modalError')} style={{ marginTop: 10 }}>
              {formState.data.errors[0]}
            </div>
          )}

          {!!formState?.data?.warnings?.length && (
            <div className={m('modalHintBox')}>
              {formState.data.warnings[0]}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div className={m('field', 'dis')}>
              <label className={m('field__label')}>Fecha</label>
              <input className={m('field__input')} value={dateISO || '—'} readOnly />
            </div>

            <div className={m('field', 'dis')}>
              <label className={m('field__label')}>Hora</label>
              <input className={m('field__input')} value={timeHM || '—'} readOnly />
            </div>
          </div>

          <div className={m('field')} style={{ marginBottom: 12 }}>
            <label className={m('field__label')}>Servicio</label>
            <div className={m('field__selectWrap')}>
              <select
                className={m('field__select')}
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                disabled={saving}
              >
                <option value="">Seleccionar servicio…</option>

                {availableServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.durationMinutes} min · $
                    {formatMoney(service.price)}
                  </option>
                ))}
              </select>
              <span className={m('field__selectIcon')} aria-hidden="true">▼</span>
            </div>

            {/* {selectedService && (
              <div className="field__hint">
                Duración: {selectedService.durationMinutes} min · Precio: $
                {formatMoney(selectedService.price)}
              </div>
            )} */}
          </div>

          {isLockedBarber ? (
            <div className={m('field', 'dis')} style={{ marginBottom: 12 }}>
              <label className={m('field__label')}>Barbero</label>
              <input
                className={m('field__input')}
                value={selectedBarberMeta?.name || '—'}
                readOnly
              />

              {!!selectedBarberMeta?.reason && !selectedBarberMeta?.enabled && (
                <div className={m('field__hint')} style={{ color: '#d9534f' }}>
                  {selectedBarberMeta.reason}
                </div>
              )}
            </div>
          ) : (
            <div className={m('field')} style={{ marginBottom: 12 }}>
              <label className={m('field__label')}>Barbero</label>
              <div className={m('field__selectWrap')}>
                <select
                  className={m('field__select')}
                  value={barberPickId}
                  onChange={(e) => setBarberPickId(e.target.value)}
                  disabled={saving || !serviceId}
                >
                  <option value="">
                    {!serviceId
                      ? 'Primero selecciona un servicio…'
                      : 'Sin asignar por ahora'}
                  </option>

                  {availableBarbers.map((barber) => (
                    <option
                      key={barber.id}
                      value={barber.id}
                      disabled={!barber.enabled}
                    >
                      {barber.name}
                      {!barber.enabled && barber.reason ? ` · ${barber.reason}` : ''}
                    </option>
                  ))}
                </select>
                <span className={m('field__selectIcon')} aria-hidden="true">▼</span>
              </div>

              {/* <div className="field__hint">
                Puedes dejar la cita sin barbero y asignarlo más tarde.
              </div> */}
            </div>
          )}

          <div className={m('field', 'modalClient')}>
            <label className={m('field__label')}>Cliente</label>

            {selectedClient?.id && !dropdownOpen ? (
              <div className={m('modalClient__selected')}>
                <div className={m('modalClient__selectedText')}>
                  <span className={m('modalClient__selectedName')}>
                    {selectedClient?.name ?? '—'}
                  </span>
                  <span className={m('modalClient__selectedPhone')}>
                    {selectedClient?.phone ?? ''}
                  </span>
                </div>

                <button
                  type="button"
                  className={m('__button', 'secondary', 'modalClient__changeBtn')}
                  onClick={() => {
                    setSelectedClient(null);
                    setQ('');
                    setResults([]);
                    setDropdownOpen(true);

                    setTimeout(() => inputRef.current?.focus?.(), 50);
                  }}
                  disabled={saving}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className={m('modalClient__searchWrap')}>
                  <input
                    ref={inputRef}
                    className={m('field__input')}
                    placeholder="Busca por nombre o teléfono…"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    disabled={saving}
                  />

                  {dropdownOpen && q.trim().length > 0 && (
                    <div
                      className={m('modalClient__dropdown')}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {searching && (
                        <div className={m('modalClient__dropdownState')}>
                          Buscando…
                        </div>
                      )}

                      {!searching && results.length === 0 && (
                        <div className={m('modalClient__dropdownState')}>
                          Sin resultados
                        </div>
                      )}

                      {!searching && results.length > 0 && (
                        <div className={m('modalClient__dropdownList')}>
                          {results.slice(0, 10).map((client) => {
                            const id = getClientId(client);
                            const name = getClientName(client);
                            const phone = getClientPhone(client);

                            return (
                              <button
                                key={id}
                                type="button"
                                className={m('modalClient__option')}
                                onClick={() => {
                                  pickClient(client);
                                  setDropdownOpen(false);
                                }}
                              >
                                <span className={m('modalClient__optionName')}>
                                  {name || '—'}
                                </span>
                                <span className={m('modalClient__optionPhone')}>
                                  {phone}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={m('modalClient__hint')}>
                  Escribe y selecciona un cliente de la lista.
                </div>
              </>
            )}
          </div>

          {/* {selectedService && (
            <div className="modalSummaryBox" style={{ marginTop: 14 }}>
              <div>
                <strong>Servicio:</strong> {selectedService.name}
              </div>
              <div>
                <strong>Duración:</strong> {selectedService.durationMinutes} min
              </div>
              <div>
                <strong>Precio:</strong> ${formatMoney(selectedService.price)}
              </div>
              <div>
                <strong>Barbero:</strong>{' '}
                {finalBarberId
                  ? selectedBarberMeta?.name || 'Asignado'
                  : 'Sin asignar por ahora'}
              </div>
              <div>
                <strong>Finaliza:</strong>{' '}
                {formState?.data?.endAt
                  ? new Date(formState.data.endAt).toLocaleTimeString('es-EC', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  : '—'}
              </div>
            </div>
          )} */}

          <footer className={m('modalFooter')}>
            <button
              className={m('__button', 'secondary')}
              type="button"
              onClick={handleClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              className={m('__button', 'primary')}
              type="submit"
              disabled={
                saving ||
                formState.loading ||
                !selectedClient?.id ||
                !serviceId ||
                formState?.data?.validation?.canSubmit === false
              }
            >
              {saving
                ? 'Guardando…'
                : formState.loading
                  ? 'Validando…'
                  : 'Crear cita'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
