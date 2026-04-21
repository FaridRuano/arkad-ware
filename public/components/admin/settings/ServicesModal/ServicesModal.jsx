'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from '@public/components/shared/AdminModalStyles/AdminModalStyles.module.scss'

const m = (...names) => names.filter(Boolean).map((name) => styles[name] ?? name).join(' ')

function normalizePrice(value = '') {
  const raw = String(value).replace(',', '.').trim()
  if (!raw) return ''
  const num = Number(raw)
  if (!Number.isFinite(num)) return value
  return String(num)
}

function formatDurationLabel(minutes = 0) {
  const total = Number(minutes) || 0
  const hours = Math.floor(total / 60)
  const mins = total % 60

  if (hours && mins) return `${hours} hora${hours > 1 ? 's' : ''} ${mins} min`
  if (hours) return `${hours} hora${hours > 1 ? 's' : ''}`
  return `${mins} min`
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
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(30)
  const [loadingInterval, setLoadingInterval] = useState(false)

  const durationOptions = useMemo(() => {
    const interval = Number(slotIntervalMinutes) > 0 ? Number(slotIntervalMinutes) : 30
    const options = Array.from({ length: 4 }, (_, index) => {
      const value = interval * (index + 1)
      return {
        value,
        label: formatDurationLabel(value),
      }
    })

    const currentDuration = Number(form.durationMinutes)
    if (
      isEdit &&
      Number.isInteger(currentDuration) &&
      currentDuration > 0 &&
      !options.some((option) => option.value === currentDuration)
    ) {
      options.push({
        value: currentDuration,
        label: `${formatDurationLabel(currentDuration)} (actual)`,
      })
      options.sort((a, b) => a.value - b.value)
    }

    return options
  }, [slotIntervalMinutes, form.durationMinutes])

  useEffect(() => {
    if (!open) return
    if (loadingInterval) return

    const interval = Number(slotIntervalMinutes) > 0 ? Number(slotIntervalMinutes) : 30

    setForm((prev) => {
      if (isEdit) {
        return prev
      }

      if (prev.durationMinutes === interval) {
        return prev
      }

      return {
        ...prev,
        durationMinutes: interval,
      }
    })
  }, [open, loadingInterval, slotIntervalMinutes, isEdit])

  useEffect(() => {
    if (open) {
      setForm(initialForm)
      setErr('')
    }
  }, [open, initialForm])

  useEffect(() => {
    if (!open) return

    let ignore = false

    const fetchBusinessInterval = async () => {
      setLoadingInterval(true)

      try {
        const res = await fetch('/api/admin/settings/schedule/business', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || 'No se pudo cargar el intervalo de agenda')
        }

        const interval = Number(data?.business?.slotIntervalMinutes || 30)

        if (!ignore) {
          setSlotIntervalMinutes(Number.isInteger(interval) && interval > 0 ? interval : 30)
        }
      } catch (error) {
        if (!ignore) {
          setSlotIntervalMinutes(30)
        }
      } finally {
        if (!ignore) {
          setLoadingInterval(false)
        }
      }
    }

    fetchBusinessInterval()

    return () => {
      ignore = true
    }
  }, [open])

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

    if (duration % slotIntervalMinutes !== 0) {
      return `La duración debe respetar bloques de ${slotIntervalMinutes} min`
    }

    if (duration > slotIntervalMinutes * 4) {
      return `La duración no puede superar ${slotIntervalMinutes * 4} min`
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
      className={m('modalOverlay')}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className={m('modalCard')}>
        <header className={m('modalHeader')}>
          <h3 className={m('modalTitle')}>
            {isEdit ? 'Editar servicio' : 'Nuevo servicio'}
          </h3>

          <button
            className={m('modalClose')}
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            type="button"
          >
            ✕
          </button>
        </header>

        <form className={m('modalBody')} onSubmit={handleSubmit}>
          {err && <div className={m('modalError')}>{err}</div>}

          <div className={m('modalGrid')}>
            <div className={m('field')} style={{ gridColumn: '1 / -1' }}>
              <label className={m('field__label')}>Nombre</label>
              <input
                className={m('field__input')}
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Ej: Corte premium"
              />
            </div>

            <div className={m('field')} style={{ gridColumn: '1 / -1' }}>
              <label className={m('field__label')}>Descripción (opcional)</label>
              <input
                className={m('field__input')}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Ej: Incluye lavado y acabado"
              />
            </div>

            <div className={m('field')}>
              <label className={m('field__label')}>Duración</label>
              <select
                className={m('field__input')}
                value={form.durationMinutes}
                onChange={(e) => setField('durationMinutes', Number(e.target.value))}
                disabled={loadingInterval}
              >
                {durationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className={m('field__hint')}>
                Esta duración se usará para calcular los bloques en agenda.
                {` Opciones: ${slotIntervalMinutes}, ${slotIntervalMinutes * 2}, ${slotIntervalMinutes * 3} y ${slotIntervalMinutes * 4} min.`}
              </div>
            </div>

            <div className={m('field')}>
              <label className={m('field__label')}>Precio</label>
              <input
                className={m('field__input')}
                value={form.price}
                onChange={(e) => setField('price', normalizePrice(e.target.value))}
                placeholder="Ej: 10"
                inputMode="decimal"
              />
            </div>

            <div className={m('field')}>
              <label className={m('field__label')}>Color</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  className={m('field__input')}
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
              <div className={m('field__hint')}>
                Útil para identificar el servicio visualmente.
              </div>
            </div>

            <div className={m('field')}>
              <label className={m('field__label')}>Estado</label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.isActive)}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
                <span>{form.isActive ? 'Activo' : 'Inactivo'}</span>
              </label>
              <div className={m('field__hint')}>
                Si lo desactivas, el servicio no debería aparecer disponible al agendar.
              </div>
            </div>

            <div className={m('field')} style={{ gridColumn: '1 / -1' }}>
              <label className={m('field__label')}>Barberos asignados (opcional)</label>

              <div className={m('serviceModalBarbers')}>
                {barbers.length === 0 ? (
                  <div className={m('field__hint')}>
                    No hay barberos disponibles todavía.
                  </div>
                ) : (
                  barbers.map((barber) => {
                    const barberId = barber?.id || barber?._id
                    const checked = form.barbers.includes(barberId)

                    return (
                      <label
                        key={barberId}
                        className={m('serviceModalBarbers__item', checked ? 'is-selected' : '')}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBarber(barberId)}
                        />

                        <span
                          className={m('serviceModalBarbers__dot')}
                          style={{ background: barber?.color || '#000000' }}
                        />

                        <span className={m('serviceModalBarbers__name')}>
                          {barber?.name || 'Sin nombre'}
                        </span>

                        {barber?.isActive === false && (
                          <span className={m('serviceModalBarbers__badge')}>
                            Inactivo
                          </span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>

              <div className={m('field__hint')}>
                Puedes dejar este campo vacío y asignar barberos más adelante.
              </div>
            </div>
          </div>

          <footer className={m('modalFooter')}>
            <button
              className={m('__button', 'secondary')}
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button className={m('__button', 'primary')} type="submit" disabled={saving}>
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
