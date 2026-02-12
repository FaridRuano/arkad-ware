'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

export default function AppointmentModal({
    open,
    saving = false,
    dateISO = '',      // 'YYYY-MM-DD'
    timeHM = '',       // 'HH:MM' (ej '08:30')
    onClose,
    onCreate,          // (payload) => void
}) {

    const justPickedRef = useRef(false)

    const [q, setQ] = useState('')
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)

    const [selectedClient, setSelectedClient] = useState(null) // { id, name, phone, ... }
    const [durationMinutes, setDurationMinutes] = useState(30)

    const [err, setErr] = useState('')
    const [dropdownOpen, setDropdownOpen] = useState(false)

    const inputRef = useRef(null)
    const abortRef = useRef(null)

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

        // focus input
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
        // debounce
        const t = setTimeout(async () => {
            try {
                setSearching(true)

                // abort previous
                if (abortRef.current) abortRef.current.abort()
                abortRef.current = new AbortController()

                const params = new URLSearchParams()
                params.set('q', term)
                params.set('page', '1') // por si tu API soporta
                // params.set('limit', '8')

                const res = await fetch(`/api/admin/clients?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    cache: 'no-store',
                    signal: abortRef.current.signal,
                })

                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data?.error || 'Error buscando clientes')

                // Tu GET clients probablemente retorna { clients, total, ... }
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

    const serviceLabel = useMemo(() => {
        return durationMinutes >= 60 ? 'Premium (60 min)' : 'Estándar (30 min)'
    }, [durationMinutes])

    const startAtISO = useMemo(() => {
        // Esto es opcional: si prefieres crear startAt en el backend, no lo uses.
        // Ecuador -05:00
        if (!dateISO || !timeHM) return ''
        return `${dateISO}T${timeHM}:00-05:00`
    }, [dateISO, timeHM])

    const pickClient = (c) => {
        const id = c?.id ?? c?._id
        const name = c?.name ?? `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim()
        const phone = c?.phone ?? ''

        justPickedRef.current = true // 👈 clave

        setSelectedClient({ ...c, id, name, phone })
        setDropdownOpen(false)

        // opcional: en vez de setQ(name) podrías dejarlo vacío,
        // pero si quieres que se vea el nombre, lo dejamos:
        setQ('')

        // soltamos el lock en el siguiente tick
        setTimeout(() => {
            justPickedRef.current = false
        }, 0)
    }

    const validate = () => {
        if (!dateISO || !timeHM) return 'Falta fecha u hora'
        if (!selectedClient?.id) return 'Selecciona un cliente'
        if (![30, 60].includes(Number(durationMinutes))) return 'Selecciona un servicio válido'
        return ''
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        setErr('')

        const msg = validate()
        if (msg) return setErr(msg)

        const payload = {
            userId: selectedClient.id,
            date: dateISO,
            time: timeHM,
            startAt: startAtISO,          // ✅ opcional, pero útil
            durationMinutes: Number(durationMinutes),
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

                    {/* Buscar cliente */}
                    <div className="field modalClient">
                        <label className="field__label">Cliente</label>

                        {/* ✅ Si hay cliente seleccionado: mostrar chip/resumen */}
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
                                {/* ✅ Si NO hay seleccionado: mostrar input + dropdown */}
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
                                            onMouseDown={(e) => e.preventDefault()} // evita perder foco antes del click
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
                                                                    pickClient(c)        // tu función existente
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

                                {/* mini hint */}
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
                            <option value={30}>Estándar · 30 min</option>
                            <option value={60}>Premium · 60 min</option>
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
