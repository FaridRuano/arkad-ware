'use client'

import ModalConfirm from '@public/components/shared/ModalConfirm'
import React, { useEffect, useMemo, useState } from 'react'

export default function page() {
  // filtros
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [quick, setQuick] = useState('') // hoy | semana | mes | pendientes | pagados | sinpagar

  // paginado
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // data
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [debouncedQ, setDebouncedQ] = useState(q)

  //quicks
  function ymdLocal(date) {
    const d = new Date(date)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  function startOfWeekMonday(date) {
    const d = new Date(date)
    const day = d.getDay() // 0=domingo, 1=lunes...
    const diff = day === 0 ? -6 : 1 - day // lunes como inicio
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  }


  function applyQuick(type) {
    const now = new Date()

    // reset de filtros
    setQ('')
    setStatus('all')
    setPage(1)

    // set rango
    if (type === 'hoy') {
      const today = ymdLocal(now)
      setFrom(today)
      setTo(today)
    }

    if (type === 'semana') {
      const start = ymdLocal(startOfWeekMonday(now))
      const end = ymdLocal(now) // hasta hoy
      setFrom(start)
      setTo(end)
    }

    if (type === 'mes') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const start = ymdLocal(first)
      const end = ymdLocal(now) // hasta hoy
      setFrom(start)
      setTo(end)
    }

    setQuick(type)
  }


  // arma la query
  const queryString = useMemo(() => {
    const params = new URLSearchParams()

    if (debouncedQ.trim()) params.set('q', debouncedQ.trim())
    if (status !== 'all') params.set('status', status)
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    params.set('page', String(page))
    params.set('limit', String(limit))

    return params.toString()
  }, [debouncedQ, status, from, to, page, limit])


  async function fetchAppointments() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/appointments?${queryString}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'No se pudieron cargar las citas')
      }

      const data = await res.json()

      // soporta diferentes formatos de respuesta
      const list = Array.isArray(data) ? data : (data?.docs ?? data?.appointments ?? [])
      const t = data?.total ?? data?.count ?? list.length

      setRows(list)
      setTotal(t)
    } catch (e) {
      setRows([])
      setTotal(0)
      setError(e?.message || 'Ocurrió un error')
    } finally {
      setLoading(false)
    }
  }

  const [confirmModalText, setConfirmModalText] = useState('');
  const [confirmModal, setConfirmModal] = useState(false);
  const [modalAction, setModalAction] = useState('')
  const [modalAppointment, setModalAppointment] = useState(null)

  // -----------------------------
  // REGLAS DE ACCIONES POR ESTADO
  // (ajustadas a tu enum con espacio)
  // -----------------------------
  function canCancel(st) {
    return st === 'pending' || st === 'confirmed'
  }

  function canNoAssistance(st) {
    return st === 'confirmed' || st === 'in progress'
  }

  function canDelete(st) {
    return st === 'pending' || st === 'cancelled'
  }

  // -----------------------------
  // ABRIR MODAL SEGÚN ACCIÓN
  // -----------------------------
  const handleConfirmModal = (appointment, action) => {
    setModalAppointment(appointment)
    setModalAction(action)

    if (action === 'cancel') {
      setConfirmModalText('¿Estás seguro de que quieres cancelar esta cita?')
    } else if (action === 'no assistance') {
      setConfirmModalText('¿Marcar esta cita como “Sin asistencia”?')
    } else if (action === 'delete') {
      setConfirmModalText('¿Eliminar esta cita? Esta acción no se puede deshacer.')
    }

    setConfirmModal(current => !current)
  }

  const closeConfirmModal = () => {
    setConfirmModal(false)
    setModalAppointment(null)
    setModalAction(null)
  }

  // -----------------------------
  // UPDATE STATUS (TU ENDPOINT)
  // -----------------------------
  async function updateAppointmentStatus(appointment, action, reason = '') {
    const id = appointment?.id ?? appointment?._id
    if (!id) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/appointments/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      })

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || 'No se pudo actualizar la cita')
      }

      // refrescar lista
      await fetchAppointments()
    } catch (error) {
      console.error('Update appointment status error:', error)
      alert(error?.message || 'Error al actualizar la cita')
    } finally {
      setLoading(false)
    }
  }

  // -----------------------------
  // DELETE (ENDPOINT POR ID)
  // -----------------------------
  async function deleteAppointment(appointment) {
    const id = appointment?.id ?? appointment?._id
    if (!id) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || 'No se pudo eliminar la cita')
      }

      await fetchAppointments()
    } catch (error) {
      console.error('Delete appointment error:', error)
      alert(error?.message || 'Error al eliminar la cita')
    } finally {
      setLoading(false)
    }
  }

  // -----------------------------
  // CONFIRM MODAL RESPONSE
  // -----------------------------
  const responseConfirmModal = async () => {
    if (!modalAppointment || !modalAction) return

    if (modalAction === 'cancel') {
      await updateAppointmentStatus(modalAppointment, 'cancel')
    }

    if (modalAction === 'no_assistance') {
      await updateAppointmentStatus(modalAppointment, 'no_assistance')
    }

    if (modalAction === 'delete') {
      await deleteAppointment(modalAppointment)
    }

    closeConfirmModal()
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    fetchAppointments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  const STATUS_LABELS = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    'in progress': 'En proceso',
    completed: 'Completada',
    cancelled: 'Cancelada',
    'no assistance': 'Sin asistencia',
  }

  const STATUS_CLASS = {
    pending: 'pending',
    confirmed: 'confirmed',
    'in progress': 'in-progress',
    completed: 'completed',
    cancelled: 'cancelled',
    'no assistance': 'no-assistance',
  }

  return (
    <>
      <ModalConfirm mainText={confirmModalText} active={confirmModal} setActive={handleConfirmModal} response={responseConfirmModal} />

      <div className="admin__dashboard appointments__page">

        {/* 1) Filtros */}
        <section className="appointments__filters">
          <header className="appointments__filtersHeader">
            <h1 className="appointments__title">Citas</h1>

            <div className="appointments__filtersActions">
              {/* luego: actualizar / limpiar */}
              <button className="__button appointments__btnRefresh" onClick={fetchAppointments} disabled={loading}>
                {loading ? 'Cargando…' : 'Actualizar'}
              </button>
              <button
                className="__button secondary appointments__btnClear"
                onClick={() => {
                  setQ('')
                  setStatus('all')
                  setFrom('')
                  setTo('')
                  setQuick('')
                  setPage(1)
                }}
              >
                Limpiar
              </button>
            </div>
          </header>

          <div className="appointments__filtersGrid">
            {/* Búsqueda */}
            <div className="field appointments__field appointments__fieldSearch">
              <label className="field__label">Buscar</label>
              <input
                className="field__input"
                placeholder="Nombre"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {/* Estado */}
            <div className="field appointments__field appointments__fieldStatus">
              <label className="field__label">Estado</label>
              <select
                className="field__select"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              >
                <option value="all">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmado</option>
                <option value="in progress">En proceso</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
                <option value="no assistance">Sin asistencia</option>
              </select>
            </div>

            {/* Desde */}
            <div className="field appointments__field appointments__fieldFrom">
              <label className="field__label">Desde</label>
              <input
                className="field__input"
                type="date"
                value={from}
                onChange={(e) => {
                  const newFrom = e.target.value
                  setFrom(newFrom)
                  setPage(1)
                  setQuick('')

                  // si "hasta" queda inválido, lo limpiamos
                  if (to && newFrom && to < newFrom) {
                    setTo('')
                  }
                }}
              />
            </div>

            {/* Hasta */}
            <div className="field appointments__field appointments__fieldTo">
              <label className="field__label">
                Hasta {!from && <span style={{ opacity: 0.6 }}>(elige primero “Desde”)</span>}
              </label>
              <input
                className="field__input"
                type="date"
                value={to}
                min={from || undefined}
                disabled={!from}
                onChange={(e) => {
                  setTo(e.target.value)
                  setPage(1)
                  setQuick('')

                }}
              />
            </div>
          </div>

          {/* Opcional: filtros rápidos */}
          <div className="appointments__quickFilters">
            <button
              className={`chip appointments__chip ${quick === 'hoy' ? 'active' : ''}`}
              onClick={() => applyQuick('hoy')}
            >
              Hoy
            </button>

            <button
              className={`chip appointments__chip ${quick === 'semana' ? 'active' : ''}`}
              onClick={() => applyQuick('semana')}
            >
              Esta semana
            </button>

            <button
              className={`chip appointments__chip ${quick === 'mes' ? 'active' : ''}`}
              onClick={() => applyQuick('mes')}
            >
              Este mes
            </button>
          </div>
        </section>

        {/* 2) Tabla */}
        <section className="appointments__tableSection">
          <header className="appointments__tableHeader">
            <h2 className="appointments__subtitle">Resultados</h2>

            <div className="appointments__tableMeta">
              {/* luego: "Mostrando 1–10 de 120" */}
              <span className="appointments__count">—</span>
            </div>
          </header>

          <div className="appointments__tableWrap">
            <table className="appointments__table">
              <thead className="appointments__thead">
                <tr className="appointments__tr appointments__trHead">
                  <th className="appointments__th">Cliente</th>
                  <th className="appointments__th">Teléfono</th>
                  <th className="appointments__th">Fecha</th>
                  <th className="appointments__th">Duración</th>
                  <th className="appointments__th">Precio</th>
                  <th className="appointments__th">Estado</th>
                  <th className="appointments__th appointments__thActions">Acciones</th>
                </tr>
              </thead>

              <tbody className="appointments__tbody">
                {loading && (
                  <tr className="appointments__tr">
                    <td className="appointments__td appointments__tdState" colSpan={7}>
                      <div className="appointments__state appointments__stateLoading">
                        <span className="appointments__stateTitle">Cargando citas…</span>
                        <span className="appointments__stateText">
                          Por favor espera un momento
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr className="appointments__tr">
                    <td className="appointments__td appointments__tdState" colSpan={7}>
                      <div className="appointments__state appointments__stateError">
                        <span className="appointments__stateTitle">Ocurrió un error</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && rows.length === 0 && (
                  <tr className="appointments__tr appointments__trEmpty">
                    <td className="appointments__td appointments__tdState" colSpan={7}>
                      <div className="appointments__state appointments__stateEmpty">
                        <span className="appointments__stateTitle">
                          No se encontraron resultados
                        </span>
                        <span className="appointments__stateText">
                          Intenta cambiar los filtros o el rango de fechas
                        </span>

                        <button
                          className="__button secondary appointments__stateAction"
                          onClick={() => {
                            setQ('')
                            setStatus('all')
                            setFrom('')
                            setTo('')
                            setPage(1)
                          }}
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && rows.length > 0 &&
                  rows.map((a) => {
                    const id = a?.id ?? a?._id
                    const st = a?.status


                    return (
                      <tr className="appointments__tr" key={a?.id ?? a?._id}>
                        <td className="appointments__td">{a?.name ?? '—'}</td>
                        <td className="appointments__td">{a?.phone ?? '—'}</td>
                        <td className="appointments__td">
                          {a?.startAt ? new Date(a.startAt).toLocaleString() : '—'}
                        </td>
                        <td className="appointments__td">
                          {(a?.durationMinutes ?? a?.duration ?? '—')} min
                        </td>
                        <td className="appointments__td">
                          {typeof a?.price === 'number' ? `$${a.price}` : '—'}
                        </td>
                        <td className="appointments__td">
                          {(() => {
                            const st = a?.status || 'pending'
                            const label = STATUS_LABELS[st] || st
                            const cls = STATUS_CLASS[st] || 'pending'

                            return (
                              <span className={`status-badge s-${cls}`}>
                                {label}
                              </span>
                            )
                          })()}
                        </td>
                        {/* ✅ ACCIONES CON MODAL */}
                        <td className="appointments__td appointments__tdActions">
                          <div className="appointments__actions">
                            {canCancel(st) && (
                              <button
                                className="actionBtn actionBtn--cancel"
                                title="Cancelar cita"
                                onClick={() => handleConfirmModal(a, 'cancel')}
                                disabled={loading}
                              >
                                ✖
                              </button>
                            )}

                            {canNoAssistance(st) && (
                              <button
                                className="actionBtn actionBtn--noassist"
                                title="Marcar como sin asistencia"
                                onClick={() => handleConfirmModal(a, 'no assistance')}
                                disabled={loading}
                              >
                                ⚠
                              </button>
                            )}

                            {canDelete(st) && (
                              <button
                                className="actionBtn actionBtn--delete"
                                title="Eliminar cita"
                                onClick={() => handleConfirmModal(a, 'delete')}
                                disabled={loading}
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    )
                  })}
              </tbody>

            </table>
          </div>

        </section>

        {/* 3) Paginación */}
        <section className="appointments__pagination">
          {(() => {
            const limit = 12
            const totalPages = Math.max(1, Math.ceil((total || 0) / limit))
            const safePage = Math.min(page, totalPages)

            const canPrev = !loading && safePage > 1
            const canNext = !loading && safePage < totalPages

            // indicador: [■][•][•]...[■]
            const indicators = Array.from({ length: totalPages }, (_, i) => {
              const p = i + 1
              const isEdge = p === 1 || p === totalPages
              const isActive = p === safePage
              return { p, isEdge, isActive }
            })

            return (
              <>
                <div className="appointments__paginationLeft">
                  <span className="appointments__pageInfo">
                    Página <b>{safePage}</b> de <b>{totalPages}</b>
                  </span>
                </div>

                <div className="appointments__paginationRight">
                  <button
                    className={`appointments__navBtn ${canPrev ? '' : 'is-disabled'}`}
                    onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
                    disabled={!canPrev}
                    aria-label="Página anterior"
                    title="Anterior"
                  >
                    ‹
                  </button>

                  <div className="appointments__pageDots" aria-label="Indicador de páginas">
                    {totalPages === 1 ? (
                      <span className="pageMark pageMark--square is-active" />
                    ) : (
                      indicators.map((it) => (
                        <span
                          key={it.p}
                          className={[
                            'pageMark',
                            it.isEdge ? 'pageMark--square' : 'pageMark--dot',
                            it.isActive ? 'is-active' : '',
                          ].join(' ')}
                        />
                      ))
                    )}
                  </div>

                  <button
                    className={`appointments__navBtn ${canNext ? '' : 'is-disabled'}`}
                    onClick={() => canNext && setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={!canNext}
                    aria-label="Página siguiente"
                    title="Siguiente"
                  >
                    ›
                  </button>
                </div>
              </>
            )
          })()}
        </section>
      </div>
    </>

  )
}
