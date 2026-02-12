'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

const Page = () => {


  /* =======================Filtros=========================== */
  const [date, setDate] = useState('') // estable en SSR
  const [hydrated, setHydrated] = useState(false)

  // helpers
  const pad2 = (n) => String(n).padStart(2, '0')
  const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

  // hoy
  const todayISO = useMemo(() => {
    const d = new Date()
    return toISO(d)
  }, [])

  // year / month derivados de date
  const year = useMemo(() => Number(date.slice(0, 4)), [date])
  const monthIndex = useMemo(() => Number(date.slice(5, 7)) - 1, [date]) // 0..11

  const monthLabel = useMemo(() => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return months[monthIndex] ?? '—'
  }, [monthIndex])

  // Semana (Lun–Dom) a partir de "date"
  const weekDays = useMemo(() => {
    const base = new Date(`${date}T00:00:00`)
    const jsDay = base.getDay() // 0=Dom..6=Sáb
    const diffToMonday = (jsDay === 0 ? -6 : 1 - jsDay) // lunes como inicio
    const monday = new Date(base)
    monday.setDate(base.getDate() + diffToMonday)

    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const iso = toISO(d)

      return {
        iso,
        dayName: dayNames[i],
        dayNum: pad2(d.getDate()),
        labelFull: d.toLocaleDateString(),
      }
    })
  }, [date])

  // Controles
  const shiftYear = (dir) => {
    const d = new Date(`${date}T00:00:00`)
    d.setFullYear(d.getFullYear() + dir)
    setDate(toISO(d))
  }

  const shiftMonth = (dir) => {
    const d = new Date(`${date}T00:00:00`)
    d.setMonth(d.getMonth() + dir)
    setDate(toISO(d))
  }

  const shiftWeek = (dir) => {
    const d = new Date(`${date}T00:00:00`)
    d.setDate(d.getDate() + (dir * 7))
    setDate(toISO(d))
  }

  /* ========================================================= */


  /* =======================Data=========================== */

  const [appointments, setAppointments] = useState([]) // citas del día
  const [meta, setMeta] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    noAssistance: 0,
    unpaid: 0,
  })

  // ✅ Estados de red
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /* ========================================================= */


  /* =======================Appointmens=========================== */
  const [selectedAppointment, setSelectedAppointment] = useState(null) // para drawer
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ✅ Navegación simple (Hoy / Prev / Next)
  const goToday = () => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setDate(`${yyyy}-${mm}-${dd}`)
  }

  const shiftDate = (dir = 1) => {
    // dir: -1 prev day, +1 next day
    const d = new Date(`${date}T00:00:00`)
    d.setDate(d.getDate() + dir)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setDate(`${yyyy}-${mm}-${dd}`)
  }
  /* ========================================================= */


  /* =======================Fetch=========================== */

  const fetchAgenda = useCallback(async () => {

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return

    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      params.set('date', date)

      const res = await fetch(`/api/admin/schedule?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Error cargando agenda')

      // Esperado: { appointments: [], meta: {...} }
      setAppointments(data?.appointments || [])
      setMeta((prev) => ({ ...prev, ...(data?.meta || {}) }))
    } catch (err) {
      setAppointments([])
      setMeta({
        total: 0,
        pending: 0,
        confirmed: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        noAssistance: 0,
        unpaid: 0,
      })
      setError(err?.message || 'Error cargando agenda')
    } finally {
      setLoading(false)
    }
  }, [date])

  /* ========================================================= */


  /* =======================Use Effect=========================== */

  useEffect(() => {
    setHydrated(true)
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setDate(`${yyyy}-${mm}-${dd}`)
  }, [])

  useEffect(() => {
    if (!date) return
    fetchAgenda()
  }, [date, fetchAgenda])

  /* ========================================================= */


  /* =======================Handlers=========================== */

  const openDrawer = (appt) => {
    setSelectedAppointment(appt)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedAppointment(null)
  }

  // ✅ (Opcional) horario base para timeline luego
  const schedule = useMemo(() => {
    return {
      start: '08:00',
      end: '20:00',
      stepMinutes: 30,
    }
  }, [])
  /* ========================================================= */

  if (!hydrated) return null
  return (
    <div className="schedule__page">
      {/* HEADER / CONTROLES (Año / Mes / Semana) */}
      <section className="schedule__header">
        <div className="schedule__headerTop">
          <h1 className="schedule__title">Agenda</h1>

          <div className="schedule__headerActions">
            <button className="__button secondary" onClick={goToday} disabled={loading}>
              Hoy
            </button>

            <button className="__button" onClick={fetchAgenda} disabled={loading}>
              {loading ? 'Cargando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {/* Controles de año/mes */}
        <div className="schedule__ymControls">
          <div className="schedule__ymGroup">
            <span className="schedule__ymLabel">Año</span>
            <div className="schedule__ymPicker">
              <button
                className="schedule__ymBtn"
                onClick={() => shiftYear(-1)}
                disabled={loading}
                aria-label="Año anterior"
                title="Año anterior"
              >
                ‹
              </button>

              <button
                className="schedule__ymValue"
                onClick={() => { }}
                type="button"
                disabled={loading}
                title="Año"
              >
                {year}
              </button>

              <button
                className="schedule__ymBtn"
                onClick={() => shiftYear(1)}
                disabled={loading}
                aria-label="Año siguiente"
                title="Año siguiente"
              >
                ›
              </button>
            </div>
          </div>

          <div className="schedule__ymGroup">
            <span className="schedule__ymLabel">Mes</span>
            <div className="schedule__ymPicker">
              <button
                className="schedule__ymBtn"
                onClick={() => shiftMonth(-1)}
                disabled={loading}
                aria-label="Mes anterior"
                title="Mes anterior"
              >
                ‹
              </button>

              <button
                className="schedule__ymValue"
                onClick={() => { }}
                type="button"
                disabled={loading}
                title="Mes"
              >
                {monthLabel}
              </button>

              <button
                className="schedule__ymBtn"
                onClick={() => shiftMonth(1)}
                disabled={loading}
                aria-label="Mes siguiente"
                title="Mes siguiente"
              >
                ›
              </button>
            </div>
          </div>

          {/* Navegación por semana */}
          <div className="schedule__weekNav">
            <button
              className="schedule__weekBtn"
              onClick={() => shiftWeek(-1)}
              disabled={loading}
              title="Semana anterior"
            >
              ‹ Anterior
            </button>

            <button
              className="schedule__weekBtn"
              onClick={() => shiftWeek(1)}
              disabled={loading}
              title="Semana siguiente"
            >
              Siguiente ›
            </button>
          </div>
        </div>

        {/* Semana Lun–Dom */}
        <div className="schedule__weekStrip" aria-label="Semana">
          {weekDays.map((d) => {
            const isSelected = d.iso === date
            const isToday = d.iso === todayISO

            return (
              <button
                key={d.iso}
                className={[
                  'schedule__dayChip',
                  isSelected ? 'is-active' : '',
                  isToday ? 'is-today' : '',
                ].join(' ')}
                onClick={() => setDate(d.iso)}
                disabled={loading}
                type="button"
                title={d.labelFull}
              >
                <span className="schedule__dayName">{d.dayName}</span>
                <span className="schedule__dayNum">{d.dayNum}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* RESUMEN / METRICS (placeholder) */}
      <section className="schedule__metrics">
        <div className="schedule__metricCard schedule__metricCard--total">
          <span className="schedule__metricLabel">Total</span>
          <span className="schedule__metricValue">{meta.total ?? 0}</span>
        </div>

        <div className="schedule__metricCard schedule__metricCard--pending">
          <span className="schedule__metricLabel">Pendientes</span>
          <span className="schedule__metricValue">{meta.pending ?? 0}</span>
        </div>

        <div className="schedule__metricCard schedule__metricCard--confirmed">
          <span className="schedule__metricLabel">Confirmadas</span>
          <span className="schedule__metricValue">{meta.confirmed ?? 0}</span>
        </div>

        <div className="schedule__metricCard schedule__metricCard--unpaid">
          <span className="schedule__metricLabel">Por cobrar</span>
          <span className="schedule__metricValue">{meta.unpaid ?? 0}</span>
        </div>
      </section>

      {/* BODY: TIMELINE + DRAWER */}
      <section className="schedule__body">
        {/* TIMELINE */}
        <div className="schedule__timeline">
          <header className="schedule__timelineHeader">
            <h2 className="schedule__subtitle">Día {date}</h2>
            <span className="schedule__subtitleHint">
              Horario: {schedule.start}–{schedule.end} · cada {schedule.stepMinutes} min
            </span>
          </header>

          {/* Estados: loading / error / empty */}
          {loading && (
            <div className="schedule__state schedule__stateLoading">
              <span className="schedule__stateTitle">Cargando schedule…</span>
              <span className="schedule__stateText">Por favor espera un momento</span>
            </div>
          )}

          {!loading && error && (
            <div className="schedule__state schedule__stateError">
              <span className="schedule__stateTitle">Ocurrió un error</span>
              <span className="schedule__stateText">{error}</span>
            </div>
          )}

          {!loading && !error && appointments.length === 0 && (
            <div className="schedule__state schedule__stateEmpty">
              <span className="schedule__stateTitle">No hay citas para este día</span>
              <span className="schedule__stateText">
                Luego aquí mostraremos los slots disponibles para crear una nueva cita.
              </span>
            </div>
          )}

          {/* ✅ Placeholder lista simple (luego lo cambiamos a timeline) */}
          {!loading && !error && appointments.length > 0 && (
            <div className="schedule__list">
              {appointments.map((a) => (
                <button
                  key={a?.id ?? a?._id}
                  className="schedule__apptRow"
                  onClick={() => openDrawer(a)}
                >
                  <span className="schedule__apptTime">{a?.startAt ? new Date(a.startAt).toLocaleTimeString() : '—'}</span>
                  <span className="schedule__apptName">{a?.name ?? '—'}</span>
                  <span className="schedule__apptStatus">{a?.status ?? 'pending'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DRAWER (placeholder) */}
        <aside className={`schedule__drawer ${drawerOpen ? 'is-open' : ''}`}>
          <header className="schedule__drawerHeader">
            <h3 className="schedule__drawerTitle">Detalle</h3>
            <button className="__button secondary" onClick={closeDrawer}>
              Cerrar
            </button>
          </header>

          {!selectedAppointment ? (
            <div className="schedule__drawerEmpty">
              Selecciona una cita para ver detalles.
            </div>
          ) : (
            <div className="schedule__drawerBody">
              <div className="schedule__drawerItem">
                <span className="schedule__drawerLabel">Cliente</span>
                <span className="schedule__drawerValue">{selectedAppointment?.name ?? '—'}</span>
              </div>

              <div className="schedule__drawerItem">
                <span className="schedule__drawerLabel">Teléfono</span>
                <span className="schedule__drawerValue">{selectedAppointment?.phone ?? '—'}</span>
              </div>

              <div className="schedule__drawerItem">
                <span className="schedule__drawerLabel">Estado</span>
                <span className="schedule__drawerValue">{selectedAppointment?.status ?? '—'}</span>
              </div>

              <div className="schedule__drawerHint">
                Luego aquí van los botones: Confirmar / Iniciar / Completar / Cancelar / No asistió / Cobrar / WhatsApp.
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}

export default Page
