'use client'
import App from '@node_modules/next/app'
import AppointmentModal from '@public/components/admin/AppointmentModal'
import AppointmentOverlay from '@public/components/admin/AppointmentOverlay'
import { MetricCard } from '@public/components/admin/MetricCard'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_assistance: 'No asistió',
}
const NON_BLOCKING_STATUSES = new Set(["cancelled", "no_assistance"]);

const parseHMToMinutes = (hm) => {
  // "19:30" o "19h30"
  if (!hm) return 0;
  const normalized = hm.replace("h", ":");
  const [h, m] = normalized.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const isRangeFree = ({ startMin, span, step, timelineModel }) => {
  for (let i = 0; i < span; i++) {
    const t = startMin + i * step;
    if (timelineModel.slotMap.has(t)) return false;
    if (timelineModel.hiddenSlots.has(t)) return false;
  }
  return true;
};

const getAllowedDurations = ({ startMin, schedule, timelineModel }) => {
  const step = schedule.stepMinutes; // ej 30
  const startM = schedule.startHour * 60;
  const endM = schedule.endHour * 60;

  const candidates = [30, 60]; // tus planes actuales

  return candidates.filter((d) => {
    const span = Math.ceil(d / step);
    const end = startMin + span * step;

    if (startMin < startM) return false;
    if (end > endM) return false;

    return isRangeFree({ startMin, span, step, timelineModel });
  });
};

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
  const [allowedDurations, setAllowedDurations] = useState([30, 60]);

  // slot seleccionado para crear
  const [createTimeHM, setCreateTimeHM] = useState('') // 'HH:MM'
  const [createStartMin, setCreateStartMin] = useState(null) // opcional, por si lo usas luego

  const openCreateAtSlot = (slot) => {
    // slot: { startMin, label }
    const hm = slot?.label || (typeof slot?.startMin === 'number' ? fmtHM(slot.startMin) : '')
    if (!date || !hm) return

    const startMin = slot.startMin ?? parseHMToMinutes(slot.label ?? slot.timeHM);
    const allowed = getAllowedDurations({ startMin, schedule, timelineModel });

    setAllowedDurations(allowed);

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

  /* =====================Appt Overlay======================== */
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const [selectedAppt, setSelectedAppt] = React.useState(null);

  const openApptOverlay = (block) => {
    const appt = buildOverlayAppointment(block);
    setSelectedAppt(appt);
    setOverlayOpen(true);
  };

  const closeApptOverlay = () => {
    setOverlayOpen(false);
    setSelectedAppt(null);
  };

  /* ========================================================= */

  /* =======================Handlers=========================== */

  const GRID_STEP_MIN = 30;

  const toLocalDate = (input) => {
    if (!input) return null;
    if (input instanceof Date) return input;

    if (typeof input === "string") {
      const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        return new Date(+m[1], +m[2] - 1, +m[3]);
      }
      return new Date(input);
    }

    return null;
  };

  const startOfDay = (input) => {
    const d = toLocalDate(input);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const getDayRelation = (viewDateInput) => {
    const today = startOfDay(new Date());
    const viewDay = startOfDay(viewDateInput);

    if (!viewDay) return "today";

    if (viewDay.getTime() < today.getTime()) return "past";
    if (viewDay.getTime() > today.getTime()) return "future";
    return "today";
  };

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  const getSlotMinutes = (label) => {
    if (!label) return 0;

    // Soporta "12:00" o "12h00"
    const normalized = label.replace('h', ':');
    const [h, m] = normalized.split(':').map(Number);

    return h * 60 + (m || 0);
  };

  const getNowMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  const getStatusLabel = (status) => {
    return STATUS_LABELS[status] || status || '—'
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
      if (NON_BLOCKING_STATUSES.has(a?.status)) continue;
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
        price: a?.price ?? 0,
        raw: a, // guardamos el objeto original por si luego abres modal
      })
    }

    return { slotMap, hiddenSlots }
  }, [appointments, date, schedule])


  const buildOverlayAppointment = (block) => {
    const raw = block?.raw || {};

    // intenta leer del raw si existe, si no usa el block
    const startAt = raw.startAt ?? raw.start ?? raw.dateStart ?? null;
    const endAt = raw.endAt ?? raw.end ?? raw.dateEnd ?? null;

    return {
      // IDs
      _id: raw._id ?? block?.id ?? raw.id ?? null,
      id: block?.id ?? raw.id ?? raw._id ?? null,

      // Datos principales (block suele ser más estable para nombre/phone en tu timeline)
      name: block?.name ?? raw.name ?? raw.clientName ?? raw.client?.name ?? '—',
      phone: block?.phone ?? raw.phone ?? raw.client?.phone ?? '',
      serviceType: block?.serviceType ?? raw.serviceType ?? raw.service ?? '—',
      price: block?.price ?? raw.price ?? raw.amount ?? 0,

      // Estados
      status: raw.status ?? block?.status ?? 'pending',
      paymentStatus: raw.paymentStatus ?? block?.paymentStatus ?? 'unpaid',
      statusHistory: raw.statusHistory ?? [],

      // Notas
      notes: raw.notes ?? raw.note ?? block?.notes ?? '',

      // Fechas
      startAt,

      // Extras útiles para UI (por si quieres mostrar duración o debugging)
      durationMinutes: raw.durationMinutes ?? block?.durationMinutes ?? 30,
      span: block?.span ?? null,
      startMin: block?.startMin ?? null,

      // por si necesitas todo el doc para acciones avanzadas
      raw,
    };
  };

  const handleAppointmentClick = (block) => {
    // para drawer (info rápida)
    openApptOverlay(block)
  }

  const handleAppointmentDoubleClick = (block) => {
    // ✅ placeholder: aquí luego abres modal de detalle/edición
    // setSelectedAppointment(block.raw)
    // setDetailsModalOpen(true)
    console.log('Double click appointment:', block?.id)
  }
  /* ========================================================= */

  /* =======================Api Handlers=========================== */

  const mergeStatusUpdate = (prev, patch) => {
    if (!prev) return prev;
    return {
      ...prev,
      status: patch?.status ?? prev.status,
      statusHistory: patch?.statusHistory ?? prev.statusHistory,
      // si en tu doc viene updatedAt:
      updatedAt: patch?.updatedAt ?? prev.updatedAt,
    };
  };

  const handleUpdateStatus = async (id, newStatus) => {
    const res = await fetch(`/api/admin/schedule/appointments/status/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: newStatus, reason: "admin_update" }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Error actualizando estado");

    const patch = data.appointment; // doc mongo (puede venir sin name/phone)

    // ✅ 1) overlay: NO reemplazar, solo merge
    setSelectedAppt((prev) =>
      (prev?._id === id || prev?.id === id) ? mergeStatusUpdate(prev, patch) : prev
    );

    // ✅ 2) lista principal: NO reemplazar, solo merge
    setAppointments((prev) =>
      prev.map((a) =>
        String(a._id) === String(id) ? mergeStatusUpdate(a, patch) : a
      )
    );
  };


  const mergeBillingUpdate = (prev, patch) => {
    if (!prev) return prev;
    return {
      ...prev,
      paymentStatus: patch?.paymentStatus ?? prev.paymentStatus,
      updatedAt: patch?.updatedAt ?? prev.updatedAt,
    };
  };

  const handleTogglePaid = async (id, newPayStatus) => {
    const res = await fetch(`/api/admin/schedule/appointments/billing/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: newPayStatus }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Error actualizando pago");

    const patch = data.appointment;

    setSelectedAppt((prev) =>
      (prev?._id === id || prev?.id === id) ? mergeBillingUpdate(prev, patch) : prev
    );

    setAppointments((prev) =>
      prev.map((a) =>
        String(a._id) === String(id) ? mergeBillingUpdate(a, patch) : a
      )
    );
  };

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
        allowedDurations={allowedDurations}
      />

      <AppointmentOverlay
        open={overlayOpen}
        appointment={selectedAppt}
        onClose={closeApptOverlay}
        onUpdateStatus={handleUpdateStatus}
        onTogglePaid={handleTogglePaid}
        onCancel={(id) => {
          // TODO: patch status:'cancelled' o endpoint cancel
        }}
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

        {/* RESUMEN / METRICS */}
        <section className="schedule__metrics" aria-label="Resumen de agenda">
          <MetricCard
            variant="total"
            label="Total"
            value={meta.total ?? 0}
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
          />

          <MetricCard
            variant="pending"
            label="Pendientes"
            value={meta.pending ?? 0}
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 7v6l4 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            }
          />

          <MetricCard
            variant="confirmed"
            label="Confirmadas"
            value={meta.confirmed ?? 0}
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />

          <MetricCard
            variant="unpaid"
            label="Por cobrar"
            value={meta.unpaid ?? 0}
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 7h12v14H6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M9 3h6v4H9z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M9 11h6M9 15h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
          />
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

                  const startMin = slot.startMin;

                  // si este slot está cubierto por una cita anterior (ej: 60min), lo saltamos
                  if (timelineModel.hiddenSlots.has(startMin)) return null;

                  const block = timelineModel.slotMap.get(startMin);

                  // ✅ duración REAL de la celda renderizada
                  const cellDuration =
                    block ? (block.span || 1) * GRID_STEP_MIN : GRID_STEP_MIN;

                  const cellEndMin = startMin + cellDuration;

                  // ⚠️ usa aquí tu variable real del día mostrado (ej: selectedDate / activeDay / currentDay)
                  // Cambia "selectedDate" por la que tú tengas en tu componente:
                  const relation = getDayRelation(date);

                  const nowMinutes = getNowMinutes();
                  const slotMinutes = getSlotMinutes(slot.label);
                  const slotDuration = slot.durationMinutes || 60;
                  const slotEnd = slotMinutes + slotDuration;

                  let isCurrent = false;
                  let isPast = false;
                  let isFuture = false;
                  let pastFade = 0;

                  if (relation === "past") {
                    isPast = true;
                    pastFade = 1;
                  } else if (relation === "future") {
                    isFuture = true;
                    pastFade = 0;
                  } else {
                    // ✅ hoy: usa startMin y cellEndMin (no label)
                    isCurrent = nowMinutes >= startMin && nowMinutes < cellEndMin;
                    isPast = nowMinutes >= cellEndMin;
                    isFuture = nowMinutes < startMin;

                    const minutesPast = Math.max(0, nowMinutes - cellEndMin);
                    pastFade = clamp01(minutesPast / 120);
                  }

                  return (
                    <div
                      key={slot.key}
                      className="schedule__row"
                      role="row"
                    >
                      {/* Columna hora */}
                      <div
                        className={`schedule__timeCell 
                          ${isCurrent ? 'schedule__timeCell--current' : ''}
                          ${isPast ? 'schedule__timeCell--past' : ''}
                          ${isFuture ? 'schedule__timeCell--future' : ''}
                        `}
                        role="gridcell"
                      >
                        <span className="schedule__timeLabel">
                          {slot.label}
                        </span>
                      </div>

                      {/* Columna contenido */}
                      <div
                        className={`schedule__slotCell
                            ${isPast ? "schedule__slotCell--past" : ""}
                            ${isCurrent ? "schedule__slotCell--current" : ""}
                          `}
                        role="gridcell"
                        style={{ "--pastFade": pastFade }}
                      >
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
                              minHeight: `calc(${block.span} * 58px)`,
                              "--pastFade": pastFade, // también para cards
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
