'use client'

import { useEffect, useMemo, useState } from "react"
import { normalizeEcMobileRemainder } from '@utils/ecPhone'
import styles from '@public/components/shared/AdminModalStyles/AdminModalStyles.module.scss'

const m = (...names) => names.filter(Boolean).map((name) => styles[name] ?? name).join(' ')

// Reutilizamos la misma lógica de normalización móvil EC a E164
function normalizeEcMobileToE164(input = "") {
  const s = String(input).trim()
  if (!s) return { ok: false, e164: "", reason: "empty" }

  let digits = s.replace(/\D/g, "")

  if (digits.startsWith("593")) {
    digits = digits.slice(3)
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1)
  }

  digits = digits.slice(0, 9)

  if (!/^9\d{8}$/.test(digits)) {
    return { ok: false, e164: digits ? `+593${digits}` : "", reason: "invalid_mobile" }
  }

  return { ok: true, e164: `+593${digits}`, reason: "" }
}

export default function BarberModal({
  open,
  mode = "create", // "create" | "edit"
  initialData = null,
  saving = false,
  onClose,
  onSave,
}) {
  const isEdit = mode === "edit"

  const initialForm = useMemo(() => ({
    name: initialData?.name ?? "",
    phone: initialData?.phone
      ? normalizeEcMobileToE164(initialData.phone).e164
      : "",
    color: initialData?.color ?? "#000000",
    isActive: initialData?.isActive ?? true,
    notes: initialData?.notes ?? "",
  }), [initialData])

  const [form, setForm] = useState(initialForm)
  const [err, setErr] = useState("")
  const [errorPhone, setErrorPhone] = useState("")

  useEffect(() => {
    if (open) {
      setForm(initialForm)
      setErr("")
      setErrorPhone("")
    }
  }, [open, initialForm])

  useEffect(() => {
    if (!err) return
    const timer = setTimeout(() => setErr(""), 5000)
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

  function onPhoneChange(e) {
    const raw = e.target.value
    const res = normalizeEcMobileToE164(raw)

    // mostramos siempre en E164 (aunque esté incompleto)
    setField("phone", res.e164)

    if (!raw.trim()) {
      setErrorPhone("")
      return
    }

    setErrorPhone(res.ok ? "" : "Número móvil ecuatoriano inválido (debe empezar con 9 y tener 9 dígitos)")
  }

  const getPhoneE164 = (value = form.phone) => {
    const normalized = normalizeEcMobileRemainder(value)
    if (!normalized) return ""
    return `+593${String(normalized).replace(/\s+/g, '')}`
  }

  const validate = () => {
    const name = (form.name || "").trim()
    const phonePretty = (form.phone || "").trim()
    const color = (form.color || "").trim()

    if (!name) return "El nombre del barbero es requerido"

    // Teléfono: si lo quieres opcional, comenta este bloque
    if (!phonePretty) return "Teléfono es requerido"
    const phoneRes = normalizeEcMobileToE164(phonePretty)
    if (!phoneRes.ok) return "Teléfono no es válido"

    // Color: validación básica hex (#RRGGBB)
    if (!/^#([0-9a-fA-F]{6})$/.test(color)) return "El color debe ser HEX (#RRGGBB)"

    if (errorPhone) return errorPhone

    return ""
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr("")

    const msg = validate()
    if (msg) {
      setErr(msg)
      return
    }

    const payload = {
      name: form.name.trim(),
      phone: normalizeEcMobileToE164(form.phone).e164,
      color: form.color.trim(),
      isActive: Boolean(form.isActive),
      notes: (form.notes || "").trim(),
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
          <h3 className={m('modalTitle')}>{isEdit ? "Editar barbero" : "Nuevo barbero"}</h3>
          <button className={m('modalClose')} onClick={onClose} disabled={saving} aria-label="Cerrar">✕</button>
        </header>

        <form className={m('modalBody')} onSubmit={handleSubmit}>
          {err && <div className={m('modalError')}>{err}</div>}

          <div className={m('modalGrid')}>
            <div className={m('field')} style={{ gridColumn: "1 / -1" }}>
              <label className={m('field__label')}>Nombre</label>
              <input
                className={m('field__input')}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div className={m('field')}>
              <label className={m('field__label')}>Teléfono</label>
              <input
                className={m('field__input')}
                value={form.phone}
                onChange={onPhoneChange}
                placeholder="09xx xxx xxx"
                inputMode="tel"
              />
              {!!errorPhone && <div className={m('field__hint')} style={{ color: "var(--negative)" }}>{errorPhone}</div>}
              {/* <div className="field__hint">Se enviará: {getPhoneE164() || "—"}</div> */}
            </div>

            <div className={m('field')}>
              <label className={m('field__label')}>Color</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  className={m('field__input')}
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  placeholder="#000000"
                />
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  title="Seleccionar color"
                  style={{ width: 44, height: 40, padding: 0, border: "none", background: "transparent" }}
                />
              </div>
              <div className={m('field__hint')}>Usado para colorear citas en la agenda general</div>
            </div>

            <div className={m('field')} style={{ gridColumn: "1 / -1" }}>
              <label className={m('field__label')}>Estado</label>
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.isActive)}
                  onChange={(e) => setField("isActive", e.target.checked)}
                />
                <span>{form.isActive ? "Activo" : "Inactivo"}</span>
              </label>
              <div className={m('field__hint')}>
                Si lo desactivas, no debería aparecer para asignar citas (pero se conserva el historial).
              </div>
            </div>

            <div className={m('field')} style={{ gridColumn: "1 / -1" }}>
              <label className={m('field__label')}>Notas (opcional)</label>
              <input
                className={m('field__input')}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Ej: Especialista en fades / trabaja de 10 a 7…"
              />
            </div>
          </div>

          <footer className={m('modalFooter')}>
            <button className={m('__button', 'secondary')} type="button" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button className={m('__button', 'primary')} type="submit" disabled={saving}>
              {saving ? "Guardando…" : (isEdit ? "Guardar cambios" : "Crear barbero")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
