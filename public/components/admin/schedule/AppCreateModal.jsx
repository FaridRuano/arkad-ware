'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

export default function AppCreateModal({
  open,
  saving = false,
  dateISO = '',
  timeHM = '',
  onClose,
  onCreate,

  services = [], // [{id,name,durationMinutes,price,color}]
  selectedBarberId = '', // si viene desde la columna del calendario
}) {
  const justPickedRef = useRef(false)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const formAbortRef = useRef(null)

  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [selectedClient, setSelectedClient] = useState(null)
  const [serviceId, setServiceId] = useState('')
  const [barberPickId, setBarberPickId] = useState('')

  const [formState, setFormState] = useState({
    loading: false,
    data: null,
  })

  const [err, setErr] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const startAtISO = useMemo(() => {
    if (!dateISO || !timeHM) return ''
    return `${dateISO}T${timeHM}:00-05:00`
  }, [dateISO, timeHM])

  const selectedService = useMemo(() => {
    return services.find((s) => s.id === serviceId) || null
  }, [services, serviceId])

  const isLockedBarber = !!selectedBarberId

  const finalBarberId = useMemo(() => {
    return selectedBarberId || barberPickId || ''
  }, [selectedBarberId, barberPickId])

  const availableBarbers = useMemo(() => {
    return Array.isArray(formState?.data?.barbers) ? formState.data.barbers : []
  }, [formState])

  const selectedBarberMeta = useMemo(() => {
    if (!finalBarberId) return null
    return availableBarbers.find((b) => b.id === finalBarberId) || null
  }, [availableBarbers, finalBarberId])

  // Reset al abrir
  useEffect(() => {
    if (!open) return

    setQ('')
    setResults([])
    setSearching(false)
    setSelectedClient(null)
    setServiceId('')
    setBarberPickId('')
    setErr('')
    setDropdownOpen(false)
    setFormState({
      loading: false,
      data: null,
    })

    setTimeout(() => inputRef.current?.focus?.(), 50)
  }, [open])

  // ESC close
  useEffect(() => {
    if (!open) return

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Auto clear err
  useEffect(() => {
    if (!err) return
    const t = setTimeout(() => setErr(''), 5000)
    return () => clearTimeout(t)
  }, [err])

  // Buscar clientes
  useEffect(() => {
    if (!open) return
    if (justPickedRef.current) return

    const term = (q || '').trim()

    if (!term) {
      setResults([])
      setSearching(false)
      return
    }

    const t = setTimeout(async () => {
      try {
        setSearching(true)

        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()

        const params = new URLSearchParams()
        params.set('q', term)
        params.set('page', '1')

        const res = await fetch(`/api/admin/clients?${params.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: abortRef.current.signal,
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Error buscando clientes')

        const list = data?.clients || data?.users || data?.results || []
        setResults(Array.isArray(list) ? list : [])
        setDropdownOpen(true)
      } catch (e) {
        if (e?.name === 'AbortError') return
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 280)

    return () => clearTimeout(t)
  }, [q, open])

  // Consultar API /form
  useEffect(() => {
    if (!open) return
    if (!startAtISO) return

    const payload = {
      date: dateISO,
      time: timeHM,
      startAt: startAtISO,
      ...(serviceId ? { serviceId } : {}),
      ...(finalBarberId ? { barberId: finalBarberId } : {}),
    }

    const run = async () => {
      try {
        setFormState((prev) => ({
          ...prev,
          loading: true,
        }))

        if (formAbortRef.current) formAbortRef.current.abort()
        formAbortRef.current = new AbortController()

        const res = await fetch('/api/admin/schedule/form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(payload),
          signal: formAbortRef.current.signal,
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data?.error || data?.errors?.[0] || 'Error validando formulario')
        }

        setFormState({
          loading: false,
          data,
        })

        // Si el barbero elegido dejó de ser válido, lo limpiamos
        if (!selectedBarberId && barberPickId) {
          const currentBarber = Array.isArray(data?.barbers)
            ? data.barbers.find((b) => b.id === barberPickId)
            : null

          if (!currentBarber?.enabled) {
            setBarberPickId('')
          }
        }
      } catch (e) {
        if (e?.name === 'AbortError') return

        setFormState({
          loading: false,
          data: null,
        })
      }
    }

    run()
  }, [open, dateISO, timeHM, startAtISO, serviceId, finalBarberId, selectedBarberId, barberPickId])

  const pickClient = (c) => {
    const id = c?.id ?? c?._id
    const name = c?.name ?? `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim()
    const phone = c?.phone ?? ''

    justPickedRef.current = true

    setSelectedClient({ ...c, id, name, phone })
    setDropdownOpen(false)
    setQ('')

    setTimeout(() => {
      justPickedRef.current = false
    }, 0)
  }

  const validate = () => {
    if (!dateISO || !timeHM) return 'Falta fecha u hora'
    if (!selectedClient?.id) return 'Selecciona un cliente'
    if (!serviceId) return 'Selecciona un servicio'
    if (!finalBarberId) return 'Selecciona un barbero'

    const validation = formState?.data?.validation
    if (!validation?.startAtValid) return 'La fecha u hora no son válidas'
    if (!validation?.serviceValid) return 'El servicio seleccionado no es válido'
    if (!validation?.barberValid) return 'El barbero seleccionado no está disponible'
    if (!selectedBarberMeta?.enabled) return selectedBarberMeta?.reason || 'Barbero no disponible'

    return ''
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setErr('')

    const msg = validate()
    if (msg) {
      setErr(msg)
      return
    }

    const payload = {
      clientId: selectedClient.id,
      barberId: finalBarberId,
      serviceId,
      date: dateISO,
      time: timeHM,
      startAt: startAtISO,
    }

    onCreate?.(payload)
  }

  if (!open) return null

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="modalCard" style={{ maxWidth: 620 }}>
        <header className="modalHeader">
          <h3 className="modalTitle">Nueva cita</h3>

          <button
            className="modalClose"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            type="button"
          >
            ✕
          </button>
        </header>

        <form className="modalBody" onSubmit={handleSubmit}>
          {err && <div className="modalError">{err}</div>}

          {!!formState?.data?.errors?.length && (
            <div className="modalError" style={{ marginTop: 10 }}>
              {formState.data.errors[0]}
            </div>
          )}

          {!!formState?.data?.warnings?.length && (
            <div className="modalHintBox" style={{ marginBottom: 12 }}>
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
            <div className="field dis">
              <label className="field__label">Fecha</label>
              <input className="field__input" value={dateISO || '—'} readOnly />
            </div>

            <div className="field dis">
              <label className="field__label">Hora</label>
              <input className="field__input" value={timeHM || '—'} readOnly />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Servicio</label>
            <select
              className="field__select"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              disabled={saving}
            >
              <option value="">Seleccionar servicio…</option>
              {(services || []).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.durationMinutes} min · ${service.price}
                </option>
              ))}
            </select>

            {selectedService && (
              <div className="field__hint">
                Duración: {selectedService.durationMinutes} min · Precio: ${selectedService.price}
              </div>
            )}
          </div>

          {isLockedBarber ? (
            <div className="field dis" style={{ marginBottom: 12 }}>
              <label className="field__label">Barbero</label>
              <input
                className="field__input"
                value={selectedBarberMeta?.name || '—'}
                readOnly
              />
              {!!selectedBarberMeta?.reason && !selectedBarberMeta?.enabled && (
                <div className="field__hint" style={{ color: '#d9534f' }}>
                  {selectedBarberMeta.reason}
                </div>
              )}
            </div>
          ) : (
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Barbero</label>
              <select
                className="field__select"
                value={barberPickId}
                onChange={(e) => setBarberPickId(e.target.value)}
                disabled={saving || !serviceId}
              >
                <option value="">
                  {!serviceId ? 'Primero selecciona un servicio…' : 'Seleccionar barbero…'}
                </option>

                {availableBarbers.map((b) => (
                  <option key={b.id} value={b.id} disabled={!b.enabled}>
                    {b.name}
                    {!b.compatible ? ' · No realiza este servicio' : ''}
                    {b.compatible && !b.available ? ' · Ocupado' : ''}
                  </option>
                ))}
              </select>

              <div className="field__hint">
                Se muestran según servicio y disponibilidad del horario.
              </div>
            </div>
          )}

          <div className="field modalClient">
            <label className="field__label">Cliente</label>

            {selectedClient?.id && !dropdownOpen ? (
              <div className="modalClient__selected">
                <div className="modalClient__selectedText">
                  <span className="modalClient__selectedName">
                    {selectedClient?.name ?? '—'}
                  </span>
                  <span className="modalClient__selectedPhone">
                    {selectedClient?.phone ?? ''}
                  </span>
                </div>

                <button
                  type="button"
                  className="__button secondary modalClient__changeBtn"
                  onClick={() => {
                    setSelectedClient(null)
                    setQ('')
                    setResults([])
                    setDropdownOpen(true)
                    setTimeout(() => inputRef.current?.focus?.(), 50)
                  }}
                  disabled={saving}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className="modalClient__searchWrap">
                  <input
                    ref={inputRef}
                    className="field__input"
                    placeholder="Busca por nombre o teléfono…"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      setDropdownOpen(true)
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    disabled={saving}
                  />

                  {dropdownOpen && q.trim().length > 0 && (
                    <div
                      className="modalClient__dropdown"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {searching && (
                        <div className="modalClient__dropdownState">
                          Buscando…
                        </div>
                      )}

                      {!searching && results.length === 0 && (
                        <div className="modalClient__dropdownState">
                          Sin resultados
                        </div>
                      )}

                      {!searching && results.length > 0 && (
                        <div className="modalClient__dropdownList">
                          {results.slice(0, 10).map((c) => {
                            const id = c?.id ?? c?._id
                            const name =
                              c?.name ??
                              `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim()
                            const phone = c?.phone ?? ''

                            return (
                              <button
                                key={id}
                                type="button"
                                className="modalClient__option"
                                onClick={() => {
                                  pickClient(c)
                                  setDropdownOpen(false)
                                }}
                              >
                                <span className="modalClient__optionName">
                                  {name || '—'}
                                </span>
                                <span className="modalClient__optionPhone">
                                  {phone}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="modalClient__hint">
                  Escribe y selecciona un cliente de la lista.
                </div>
              </>
            )}
          </div>

          {selectedService && (
            <div className="modalSummaryBox" style={{ marginTop: 14 }}>
              <div><strong>Servicio:</strong> {selectedService.name}</div>
              <div><strong>Duración:</strong> {selectedService.durationMinutes} min</div>
              <div><strong>Precio:</strong> ${selectedService.price}</div>
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
          )}

          <footer className="modalFooter">
            <button
              className="__button secondary"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              className="__button primary"
              type="submit"
              disabled={
                saving ||
                formState.loading ||
                !formState?.data?.validation?.canSubmit ||
                !selectedClient?.id
              }
            >
              {saving ? 'Guardando…' : formState.loading ? 'Validando…' : 'Crear cita'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}