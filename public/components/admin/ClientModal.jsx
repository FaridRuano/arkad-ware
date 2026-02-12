'use client'
import { useEffect, useMemo, useState } from "react"
import { normalizeEcMobileRemainder } from '@utils/ecPhone'
import { cedulaErrorMessage, validateEcuadorCedula } from '@utils/ecuadorId'


function normalizeEcMobileToE164(input = "") {
    const s = String(input).trim()

    if (!s) return { ok: false, e164: "", reason: "empty" }

    // deja solo dígitos (sin +, espacios, etc.)
    let digits = s.replace(/\D/g, "")

    // Casos:
    // +593996447884 -> digits "593996447884"
    // 593996447884  -> digits "593996447884"
    // 0996447884    -> digits "0996447884"
    // 996447884     -> digits "996447884"

    if (digits.startsWith("593")) {
        digits = digits.slice(3) // deja el móvil (9 dígitos)
    } else if (digits.startsWith("0")) {
        digits = digits.slice(1) // quita 0 local
    }

    // ahora debería quedar 9 dígitos empezando en 9
    digits = digits.slice(0, 9)

    if (!/^9\d{8}$/.test(digits)) {
        return { ok: false, e164: digits ? `+593${digits}` : "", reason: "invalid_mobile" }
    }

    return { ok: true, e164: `+593${digits}`, reason: "" }
}

export default function ClientModal({
    open,
    mode = "create", // "create" | "edit"
    initialData = null,
    saving = false,
    onClose,
    onSave,
}) {
    const isEdit = mode === "edit"

    const initialForm = useMemo(() => ({
        cedula: initialData?.cedula ?? "",
        firstName: initialData?.firstName ?? "",
        lastName: initialData?.lastName ?? "",
        email: initialData?.email ?? "",
        phone: initialData?.phone
            ? normalizeEcMobileToE164(initialData.phone).e164
            : "",
        address: initialData?.address ?? "",
    }), [initialData])

    const [form, setForm] = useState(initialForm)
    const [err, setErr] = useState("")

    // ✅ errores específicos (para mostrar debajo del input si quieres)
    const [errorCedula, setErrorCedula] = useState("")
    const [errorPhone, setErrorPhone] = useState("")

    useEffect(() => {
        if (open) {
            setForm(initialForm)
            setErr("")
            setErrorCedula("")
            setErrorPhone("")
        }
    }, [open, initialForm])

    useEffect(() => {
        if (!err) return

        const timer = setTimeout(() => {
            setErr("")
        }, 5000)

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

    // ✅ tus handlers adaptados al form del modal
    function onCedulaChange(e) {
        const value = e.target.value.replace(/\D/g, '').slice(0, 10)
        setField("cedula", value)

        // valida si hay algo escrito (si está vacío no grites error todavía)
        if (!value) {
            setErrorCedula("")
            return
        }

        const res = validateEcuadorCedula(value)
        setErrorCedula(res.ok ? "" : cedulaErrorMessage(res.reason))
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
        const cedula = (form.cedula || "").trim()
        const email = (form.email || "").trim()
        const firstName = (form.firstName || "").trim()
        const lastName = (form.lastName || "").trim()
        const phonePretty = (form.phone || "").trim()
        const address = (form.address || "").trim()

        // ✅ cédula (usa tu validador)
        if (!cedula) return "La cédula es requerida"
        const cedRes = validateEcuadorCedula(cedula)
        if (!cedRes.ok) return cedulaErrorMessage(cedRes.reason)

        if (!firstName) return "Nombre es requerido"
        if (!lastName) return "Apellido es requerido"
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) return "Email no es válido"
        if (!phonePretty) return "Teléfono es requerido"

        const phone = (form.phone || "").trim()
        const phoneRes = normalizeEcMobileToE164(phone)
        if (!phoneRes.ok) return "Teléfono no es válido"

        if (!address) return "Dirección es requerida"

        // si tus estados ya marcaron error, también bloquea (extra safety)
        if (errorCedula) return errorCedula
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
            cedula: form.cedula.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim().toLowerCase(),
            phone: normalizeEcMobileToE164(form.phone).e164,
            address: form.address.trim(),
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
                    <h3 className="modalTitle">{isEdit ? "Editar cliente" : "Nuevo cliente"}</h3>
                    <button className="modalClose" onClick={onClose} disabled={saving} aria-label="Cerrar">✕</button>
                </header>

                <form className="modalBody" onSubmit={handleSubmit}>
                    {err && <div className="modalError">{err}</div>}

                    <div className="modalGrid">
                        <div className="field">
                            <label className="field__label">Cédula</label>
                            <input
                                className="field__input"
                                value={form.cedula}
                                onChange={onCedulaChange}
                                placeholder="10 dígitos"
                                inputMode="numeric"
                            />
                            {!!errorCedula && <div className="field__hint" style={{ color: "var(--negative)" }}>{errorCedula}</div>}
                        </div>

                        <div className="field">
                            <label className="field__label">Teléfono</label>
                            <input
                                className="field__input"
                                value={form.phone}
                                onChange={onPhoneChange}
                                placeholder="09xx xxx xxx"
                                inputMode="tel"
                            />
                            {!!errorPhone && <div className="field__hint" style={{ color: "var(--negative)" }}>{errorPhone}</div>}
                            {/* Opcional: mostrar lo que se enviará */}
                            {/* <div className="field__hint">Se enviará: {getPhoneE164() || "—"}</div> */}
                        </div>

                        <div className="field">
                            <label className="field__label">Nombres</label>
                            <input
                                className="field__input"
                                value={form.firstName}
                                onChange={(e) => setField("firstName", e.target.value)}
                            />
                        </div>

                        <div className="field">
                            <label className="field__label">Apellidos</label>
                            <input
                                className="field__input"
                                value={form.lastName}
                                onChange={(e) => setField("lastName", e.target.value)}
                            />
                        </div>

                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <label className="field__label">Email</label>
                            <input
                                className="field__input"
                                value={form.email}
                                onChange={(e) => setField("email", e.target.value)}
                                placeholder="correo@dominio.com"
                                inputMode="email"
                            />
                        </div>

                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <label className="field__label">Dirección</label>
                            <input
                                className="field__input"
                                value={form.address}
                                onChange={(e) => setField("address", e.target.value)}
                                placeholder="Av. ... y ..."
                            />
                        </div>
                    </div>

                    <footer className="modalFooter">
                        <button className="__button secondary" type="button" onClick={onClose} disabled={saving}>
                            Cancelar
                        </button>
                        <button className="__button primary" type="submit" disabled={saving}>
                            {saving ? "Guardando…" : (isEdit ? "Guardar cambios" : "Crear cliente")}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    )
}