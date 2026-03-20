'use client'

import { useEffect, useMemo, useState } from 'react'

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1 hora 30 min' },
  { value: 120, label: '2 horas' },
]

function normalizePrice(value = '') {
  const raw = String(value).replace(',', '.').trim()
  if (!raw) return ''
  const num = Number(raw)
  if (!Number.isFinite(num)) return value
  return String(num)
}

export default function ServiceModal({
  open,
  mode = 'create',
  initialData = null,
  saving = false,
  barbers = [],
  onClose,
  onSave,
}) {
  const isEdit = mode === 'edit'

  const initialForm = useMemo(
    () => ({
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      durationMinutes: initialData?.durationMinutes ?? 30,
      price:
        initialData?.price !== undefined && initialData?.price !== null
          ? String(initialData.price)
          : '',
      color: initialData?.color ?? '#CFB690',
      isActive: initialData?.isActive ?? true,
      barbers: Array.isArray(initialData?.barbers)
        ? initialData.barbers.map((b) => b?.id || b?._id).filter(Boolean)
        : [],
    }),
    [initialData]
  )

  const [form, setForm] = useState(initialForm)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setForm(initialForm)
      setErr('')
    }
  }, [open, initialForm])

  useEffect(() => {
    if (!err) return
    const timer = setTimeout(() => setErr(''), 5000)
    return () => clearTimeout(timer)
  }, [err])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleBarber = (barberId) => {
    setForm((prev) => {
      const exists = prev.barbers.includes(barberId)

      return {
        ...prev,
        barbers: exists
          ? prev.barbers.filter((id) => id !== barberId)
          : [...prev.barbers, barberId],
      }
    })
  }

  const validate = () => {
    const name = String(form.name || '').trim()
    const color = String(form.color || '').trim()
    const duration = Number(form.durationMinutes)
    const price = Number(String(form.price).replace(',', '.'))

    if (!name) return 'El nombre del servicio es requerido'

    if (!Number.isInteger(duration) || duration <= 0) {
      return 'La duración debe ser un número entero de minutos mayor a 0'
    }

    if (!Number.isFinite(price) || price < 0) {
      return 'El precio debe ser un número válido mayor o igual a 0'
    }

    if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
      return 'El color debe ser HEX (#RRGGBB)'
    }

    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')

    const msg = validate()
    if (msg) {
      setErr(msg)
      return
    }

    const payload = {
      name: form.name.trim(),
      description: String(form.description || '').trim(),
      durationMinutes: Number(form.durationMinutes),
      price: Number(String(form.price).replace(',', '.')),
      color: form.color.trim(),
      isActive: Boolean(form.isActive),
      barbers: form.barbers,
    }

    onSave?.(payload)
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
      <div className="modalCard">
        <header className="modalHeader">
          <h3 className="modalTitle">
            {isEdit ? 'Editar servicio' : 'Nuevo servicio'}
          </h3>

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

          <div className="modalGrid">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Nombre</label>
              <input
                className="field__input"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Ej: Corte premium"
              />
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Descripción (opcional)</label>
              <input
                className="field__input"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Ej: Incluye lavado y acabado"
              />
            </div>

            <div className="field">
              <label className="field__label">Duración</label>
              <select
                className="field__input"
                value={form.durationMinutes}
                onChange={(e) => setField('durationMinutes', Number(e.target.value))}
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="field__hint">
                Esta duración se usará para calcular los bloques en agenda.
              </div>
            </div>

            <div className="field">
              <label className="field__label">Precio</label>
              <input
                className="field__input"
                value={form.price}
                onChange={(e) => setField('price', normalizePrice(e.target.value))}
                placeholder="Ej: 10"
                inputMode="decimal"
              />
            </div>

            <div className="field">
              <label className="field__label">Color</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  className="field__input"
                  value={form.color}
                  onChange={(e) => setField('color', e.target.value)}
                  placeholder="#CFB690"
                />
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setField('color', e.target.value)}
                  title="Seleccionar color"
                  style={{
                    width: 44,
                    height: 40,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                  }}
                />
              </div>
              <div className="field__hint">
                Útil para identificar el servicio visualmente.
              </div>
            </div>

            <div className="field">
              <label className="field__label">Estado</label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.isActive)}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
                <span>{form.isActive ? 'Activo' : 'Inactivo'}</span>
              </label>
              <div className="field__hint">
                Si lo desactivas, el servicio no debería aparecer disponible al agendar.
              </div>
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Barberos asignados (opcional)</label>

              <div className="serviceModalBarbers">
                {barbers.length === 0 ? (
                  <div className="field__hint">
                    No hay barberos disponibles todavía.
                  </div>
                ) : (
                  barbers.map((barber) => {
                    const barberId = barber?.id || barber?._id
                    const checked = form.barbers.includes(barberId)

                    return (
                      <label
                        key={barberId}
                        className={`serviceModalBarbers__item ${checked ? 'is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBarber(barberId)}
                        />

                        <span
                          className="serviceModalBarbers__dot"
                          style={{ background: barber?.color || '#000000' }}
                        />

                        <span className="serviceModalBarbers__name">
                          {barber?.name || 'Sin nombre'}
                        </span>

                        {barber?.isActive === false && (
                          <span className="serviceModalBarbers__badge">
                            Inactivo
                          </span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>

              <div className="field__hint">
                Puedes dejar este campo vacío y asignar barberos más adelante.
              </div>
            </div>
          </div>

          <footer className="modalFooter">
            <button
              className="__button secondary"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button className="__button primary" type="submit" disabled={saving}>
              {saving
                ? 'Guardando…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Crear servicio'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}