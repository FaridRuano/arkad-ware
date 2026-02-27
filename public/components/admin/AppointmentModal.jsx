'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

export default function AppointmentModal({
  open,
  saving = false,
  dateISO = '',
  timeHM = '',
  onClose,
  onCreate,
  allowedDurations = [30, 60],

  // ✅ NUEVO
  barbers = [],               // [{id,name,color}]
  selectedBarberId = "",      // "" => Todos
}) {
  const justPickedRef = useRef(false)

  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [selectedClient, setSelectedClient] = useState(null)
  const [durationMinutes, setDurationMinutes] = useState(30)

  // ✅ Nuevo: barber elegido SOLO cuando estás en "Todos"
  const [barberPickId, setBarberPickId] = useState('')

  const [err, setErr] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const inputRef = useRef(null)
  const abortRef = useRef(null)

  const isAllBarbers = !selectedBarberId

  // Reset al abrir
  useEffect(() => {
    if (!open) return
    setQ('')
    setResults([])
    setSearching(false)
    setSelectedClient(null)
    setDurationMinutes(30)
    setErr('')
    setDropdownOpen(false)

    // ✅ si estás en "Todos", resetea selector
    setBarberPickId('')

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

  // Auto clear err 5s
  useEffect(() => {
    if (!err) return
    const t = setTimeout(() => setErr(''), 5000)
    return () => clearTimeout(t)
  }, [err])

  // Debounced search
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

  const startAtISO = useMemo(() => {
    if (!dateISO || !timeHM) return ''
    return `${dateISO}T${timeHM}:00-05:00`
  }, [dateISO, timeHM])

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

  // ✅ BarberId final: si no es "Todos" ya viene desde header
  const finalBarberId = useMemo(() => {
    return selectedBarberId || barberPickId || ""
  }, [selectedBarberId, barberPickId])

  const validate = () => {
    if (!dateISO || !timeHM) return 'Falta fecha u hora'
    if (!selectedClient?.id) return 'Selecciona un cliente'
    if (![30, 60].includes(Number(durationMinutes))) return 'Selecciona un servicio válido'

    // ✅ Si estás en "Todos", debes escoger barbero
    if (isAllBarbers && !barberPickId) return 'Selecciona un barbero'

    // ✅ Siempre debe existir barberId (tu backend lo exige)
    if (!finalBarberId) return 'Falta barbero'

    return ''
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setErr('')

    const msg = validate()
    if (msg) return setErr(msg)

    const payload = {
      userId: selectedClient.id,
      barberId: finalBarberId, // ✅ NUEVO
      date: dateISO,
      time: timeHM,
      startAt: startAtISO,
      durationMinutes: Number(durationMinutes),
    }

    onCreate?.(payload)
  }

  useEffect(() => {
    if (!allowedDurations.includes(durationMinutes)) {
      setDurationMinutes(allowedDurations[0] ?? 30);
    }
  }, [allowedDurations, durationMinutes])

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
      <div className="modalCard" style={{ maxWidth: 560 }}>
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

          {/* Fecha / hora */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="field dis">
              <label className="field__label">Fecha</label>
              <input className="field__input" value={dateISO || '—'} readOnly />
            </div>

            <div className="field dis">
              <label className="field__label">Hora</label>
              <input className="field__input" value={timeHM || '—'} readOnly />
            </div>
          </div>

          {/* ✅ Barbero (solo si estás en "Todos") */}
          {isAllBarbers ? (
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Barbero</label>

              <select
                className="field__select"
                value={barberPickId}
                onChange={(e) => setBarberPickId(e.target.value)}
                disabled={saving}
              >
                <option value="">Seleccionar barbero…</option>
                {(barbers || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              <div className="field__hint">
                Estás en “Todos”, por eso debes asignar el barbero.
              </div>
            </div>
          ) : (
            // ✅ Si ya hay barbero seleccionado en header, mostrarlo como info
            <div className="field dis" style={{ marginBottom: 12 }}>
              <label className="field__label">Barbero</label>
              <input
                className="field__input"
                value={
                  (barbers.find((b) => b.id === selectedBarberId)?.name) || "—"
                }
                readOnly
              />
            </div>
          )}

          {/* Buscar cliente */}
          <div className="field modalClient">
            <label className="field__label">Cliente</label>

            {selectedClient?.id && !dropdownOpen ? (
              <div className="modalClient__selected">
                <div className="modalClient__selectedText">
                  <span className="modalClient__selectedName">{selectedClient?.name ?? '—'}</span>
                  <span className="modalClient__selectedPhone">{selectedClient?.phone ?? ''}</span>
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
                            const name = c?.name ?? `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim()
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
                                <span className="modalClient__optionName">{name || '—'}</span>
                                <span className="modalClient__optionPhone">{phone}</span>
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

          {/* Servicio */}
          <div className="field" style={{ marginBottom: 6 }}>
            <label className="field__label">Servicio</label>
            <select
              className="field__select"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              disabled={saving}
            >
              <option value={30} disabled={!allowedDurations.includes(30)}>
                Estándar · 30 min
              </option>
              <option value={60} disabled={!allowedDurations.includes(60)}>
                Premium · 60 min
              </option>
            </select>
          </div>

          <footer className="modalFooter">
            <button className="__button secondary" type="button" onClick={onClose} disabled={saving}>
              Cancelar
            </button>

            <button className="__button primary" type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Crear cita'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}