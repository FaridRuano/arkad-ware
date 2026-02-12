'use client'
import AppointmentModal from '@public/components/admin/AppointmentModal'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  'in progress': 'En proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  'no assistance': 'No asistió',
}

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

  const minutesFromHM = (h, m) => h * 60 + m

  const parseTimeToMinutes = (isoDate, dateISO) => {
    // isoDate: Date string (startAt)
    // dateISO: 'YYYY-MM-DD' seleccionado
    // Convertimos a minutos del día según la hora local del navegador
    const d = new Date(isoDate)
    return d.getHours() * 60 + d.getMinutes()
  }

  const fmtHM = (minutes) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${pad2(h)}:${pad2(m)}`
  }

  const serviceLabelFromDuration = (durationMinutes) => {
    const d = Number(durationMinutes || 0)
    if (d >= 60) return 'Premium'
    return 'Estándar'
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

  /* ================Modal Create Appointment================= */
  // Modal crear cita
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createErr, setCreateErr] = useState('')

  // slot seleccionado para crear
  const [createTimeHM, setCreateTimeHM] = useState('') // 'HH:MM'
  const [createStartMin, setCreateStartMin] = useState(null) // opcional, por si lo usas luego

  const openCreateAtSlot = (slot) => {
    // slot: { startMin, label }
    const hm = slot?.label || (typeof slot?.startMin === 'number' ? fmtHM(slot.startMin) : '')
    if (!date || !hm) return

    setCreateErr('')
    setCreateTimeHM(hm)
    setCreateStartMin(slot?.startMin ?? null)
    setCreateOpen(true)
  }

  const closeCreateModal = () => {
    setCreateOpen(false)
    setCreateSaving(false)
    setCreateErr('')
    setCreateTimeHM('')
    setCreateStartMin(null)
  }

  const createAppointment = async (payload) => {
    // payload viene del modal:
    // { userId, date, time, startAt, durationMinutes }
    if (!payload?.userId) return

    setCreateSaving(true)
    setCreateErr('')

    try {
      const res = await fetch('/api/admin/schedule/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          userId: payload.userId,
          // puedes enviar startAt directo (recomendado)
          startAt: payload.startAt, // 'YYYY-MM-DDTHH:MM:00-05:00'
          durationMinutes: payload.durationMinutes,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear la cita')

      // ✅ refrescar agenda
      await fetchSchedule()

      // ✅ cerrar modal
      closeCreateModal()
    } catch (e) {
      setCreateErr(e?.message || 'Error creando cita')
    } finally {
      fetchAgenda()
      setCreateSaving(false)
      closeCreateModal()
    }
  }
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

  const getStatusLabel = (status) => {
    return STATUS_LABELS[status] || status || '—'
  }

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
      startHour: 8,       // 8am
      endHour: 20,        // 8pm
      stepMinutes: 30,    // intervalos
    }
  }, [])

  const daySlots = useMemo(() => {
    if (!date) return []

    const startM = schedule.startHour * 60
    const endM = schedule.endHour * 60
    const step = schedule.stepMinutes

    const slots = []
    for (let t = startM; t < endM; t += step) {
      slots.push({
        key: `${date}-${t}`,
        startMin: t,
        endMin: t + step,
        label: fmtHM(t),
      })
    }
    return slots
  }, [date, schedule])

  const timelineModel = useMemo(() => {
    if (!date) return { slotMap: new Map(), hiddenSlots: new Set() }

    const step = schedule.stepMinutes
    const startM = schedule.startHour * 60
    const endM = schedule.endHour * 60

    const slotMap = new Map()      // startMin -> block
    const hiddenSlots = new Set()  // startMin of slots that are "covered" by a previous block

    for (const a of appointments || []) {
      const startMin = parseTimeToMinutes(a?.startAt, date)
      const duration = Number(a?.durationMinutes || 30)

      // Solo agenda dentro del rango laboral
      if (startMin < startM || startMin >= endM) continue

      // Alinear al step (por si viene algo raro)
      const snappedStart = startMin - (startMin % step)

      // span mínimo 1
      const span = Math.max(1, Math.round(duration / step))

      // No permitimos que se salga del final del día (recortamos)
      const maxSpan = Math.floor((endM - snappedStart) / step)
      const safeSpan = Math.min(span, Math.max(1, maxSpan))

      // Si ya existe una cita que empieza exactamente ahí, puedes decidir:
      // - ignorar la nueva
      // - o guardarlas en array para "conflictos"
      // Por ahora: la primera gana
      if (slotMap.has(snappedStart)) continue

      // Marcamos slots cubiertos para saltarlos en render
      for (let i = 1; i < safeSpan; i++) {
        hiddenSlots.add(snappedStart + i * step)
      }

      slotMap.set(snappedStart, {
        id: a?.id ?? a?._id,
        startMin: snappedStart,
        durationMinutes: duration,
        span: safeSpan,
        name: a?.name ?? '—',
        status: a?.status ?? 'pending',
        phone: a?.phone ?? '',
        paymentStatus: a?.paymentStatus ?? 'unpaid',
        serviceType: serviceLabelFromDuration(duration),
        raw: a, // guardamos el objeto original por si luego abres modal
      })
    }

    return { slotMap, hiddenSlots }
  }, [appointments, date, schedule])

  const handleAppointmentClick = (block) => {
    // para drawer (info rápida)
    openDrawer(block.raw)
  }

  const handleAppointmentDoubleClick = (block) => {
    // ✅ placeholder: aquí luego abres modal de detalle/edición
    // setSelectedAppointment(block.raw)
    // setDetailsModalOpen(true)
    console.log('Double click appointment:', block?.id)
  }
  /* ========================================================= */

  if (!hydrated) return null
  return (

    <>
      <AppointmentModal
        open={createOpen}
        saving={createSaving}
        dateISO={date}
        timeHM={createTimeHM}
        onClose={closeCreateModal}
        onCreate={createAppointment}
      />


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
                Horario: {schedule.startHour}:00 · {schedule.endHour}:00
              </span>
            </header>

            {loading && (
              <div className="schedule__state schedule__stateLoading loading">
                <span className="schedule__stateTitle">Cargando schedule…</span>
                <span className="schedule__stateText">Por favor espera un momento</span>
                <div className="spinner" aria-hidden="true"></div>
              </div>
            )}

            {!loading && error && (
              <div className="schedule__state schedule__stateError">
                <span className="schedule__stateTitle">Ocurrió un error</span>
                <span className="schedule__stateText">{error}</span>
              </div>
            )}

            {!loading && !error && daySlots.length === 0 && (
              <div className="schedule__state schedule__stateEmpty">
                <span className="schedule__stateTitle">No hay slots</span>
                <span className="schedule__stateText">Selecciona una fecha válida.</span>
              </div>
            )}

            {!loading && !error && daySlots.length > 0 && (
              <div className="schedule__grid" role="grid" aria-label="Agenda por horarios">
                {daySlots.map((slot) => {
                  const startMin = slot.startMin

                  // si este slot está cubierto por una cita anterior (ej: 60min), lo saltamos
                  if (timelineModel.hiddenSlots.has(startMin)) return null

                  const block = timelineModel.slotMap.get(startMin)

                  return (
                    <div
                      key={slot.key}
                      className="schedule__row"
                      role="row"
                    >
                      {/* Columna hora */}
                      <div className="schedule__timeCell" role="gridcell">
                        <span className="schedule__timeLabel">{slot.label}</span>
                      </div>

                      {/* Columna contenido */}
                      <div className="schedule__slotCell" role="gridcell">
                        {!block ? (
                          <button
                            className="schedule__slotEmpty"
                            type="button"
                            onClick={() => openCreateAtSlot(slot)}
                          >
                            <span className="schedule__slotEmptyPlus">＋</span>
                            <span className="schedule__slotEmptyText">Disponible</span>
                          </button>
                        ) : (
                          <div
                            className={`schedule__apptCard s-${block.status || 'pending'}`}
                            style={{
                              // ✅ Esto hace que visualmente “ocupe” más alto cuando dura 60 min
                              minHeight: `calc(${block.span} * 56px)`, // ajustaremos con CSS luego
                            }}
                            onClick={() => handleAppointmentClick(block)}
                            onDoubleClick={() => handleAppointmentDoubleClick(block)}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="schedule__apptTop">
                              <span className="schedule__apptName">{block.name}</span>
                              <span className="schedule__apptService">{block.serviceType}</span>
                            </div>

                            <div className="schedule__apptBottom">
                              <span className="schedule__apptStatus">
                                {getStatusLabel(block.status)}
                              </span>
                              <span className={`schedule__apptPay ${block.paymentStatus === 'paid' ? 'is-paid' : 'is-unpaid'}`}>
                                {block.paymentStatus === 'paid' ? 'Pagado' : 'Por cobrar'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

export default Page
