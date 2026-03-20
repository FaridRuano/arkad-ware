'use client'

import React, { useEffect, useState } from 'react'
import BarberModal from "@public/components/admin/settings/BarberModal";
import ModalConfirm from "@public/components/shared/ModalConfirm";

const page = () => {
  /* =======================Loading=========================== */
  const [loading, setLoading] = useState(false);
  /* ========================================================= */

  /* =======================Filtros=========================== */
  const [q, setQ] = useState('')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // paginado
  const [page, setPage] = useState(1)
  const [limit] = useState(12)
  /* ========================================================= */

  /* ===========================Data========================== */
  const [barbers, setBarbers] = useState([])
  const [error, setError] = useState('')
  /* ========================================================= */

  /* ======================Confirm Modal====================== */
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmModalText, setConfirmModalText] = useState("");
  const [selectedBarber, setSelectedBarber] = useState(null)

  const handleConfirmModal = () => {
    setConfirmModal((prev) => !prev);
  }

  const responseConfirmModal = async () => {
    if (!selectedBarber?.id && !selectedBarber?._id) return

    const id = selectedBarber.id ?? selectedBarber._id

    try {
      setLoading(true)
      /* ?hard=true <=========== PARA ELIMINAR DEFINITIVO */
      const res = await fetch(`/api/admin/barbers/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Error eliminando barbero')
      }

      // 🔥 Refrescar lista
      await fetchBarbers()

    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
      setConfirmModal(false)
      setSelectedBarber(null)
    }
  }
  /* ========================================================= */

  /* =========================Fetch=========================== */
  async function fetchBarbers() {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()

      if (q?.trim()) params.set('q', q.trim())
      params.set('page', String(page || 1))

      const res = await fetch(`/api/admin/barbers?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Error cargando barberos')
      }

      setBarbers(data?.barbers || [])
      setTotal(data?.total ?? 0)
      setTotalPages(data?.totalPages ?? 1)

      const safeTotalPages = data?.totalPages ?? 1
      if (page > safeTotalPages) setPage(safeTotalPages)
    } catch (err) {
      setBarbers([])
      setTotal(0)
      setTotalPages(1)
      setError(err?.message || 'Error cargando barberos')
    } finally {
      setLoading(false)
    }
  }
  /* ========================================================= */

  /* =======================Barber Modal====================== */
  const [barberModalOpen, setBarberModalOpen] = useState(false)
  const [editingBarber, setEditingBarber] = useState(null) // null = crear
  const [saving, setSaving] = useState(false)

  const openNewBarber = () => {
    setEditingBarber(null)
    setBarberModalOpen(true)
  }

  const openEditBarber = (barber) => {
    setEditingBarber(barber)
    setBarberModalOpen(true)
  }

  const closeBarberModal = () => {
    setBarberModalOpen(false)
    setEditingBarber(null)
  }

  async function handleSaveBarber(payload) {
    setSaving(true)
    try {
      const isEdit = Boolean(editingBarber?.id || editingBarber?._id)
      const id = editingBarber?.id || editingBarber?._id

      const res = await fetch(
        isEdit ? `/api/admin/barbers/${id}` : `/api/admin/barbers/create`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar el barbero')

      closeBarberModal()
      fetchBarbers()
    } catch (e) {
      alert(e?.message || 'Error guardando barbero')
    } finally {
      setSaving(false)
    }
  }
  /* ========================================================= */

  useEffect(() => {
    fetchBarbers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q])

  return (
    <>
      <ModalConfirm
        mainText={confirmModalText}
        active={confirmModal}
        setActive={handleConfirmModal}
        response={responseConfirmModal}
        type="confirm"
      />

      <BarberModal
        open={barberModalOpen}
        mode={editingBarber ? "edit" : "create"}
        initialData={editingBarber}
        saving={saving}
        onClose={closeBarberModal}
        onSave={handleSaveBarber}
      />

      <div className="admin__dashboard clients__page">
        {/* 1) Filtros */}
        <section className="clients__filters">
          <header className="clients__filtersHeader">
            <h1 className="clients__title">Barberos</h1>

            <div className="clients__filtersActions">
              <button
                className="__button primary clients__btnNew"
                onClick={openNewBarber}
              >
                + Nuevo
              </button>

              <button
                className="__button clients__btnRefresh"
                onClick={() => {
                  fetchBarbers()
                  setQ("")
                  setPage(1)
                }}
                disabled={loading}
              >
                {loading ? "Cargando…" : "Actualizar"}
              </button>
            </div>
          </header>

          <div className="clients__filtersGrid">
            <div className="field clients__field clients__fieldSearch">
              <label className="field__label">Buscar</label>
              <input
                className="field__input"
                placeholder="Nombre del barbero"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>
        </section>

        {/* 2) Tabla */}
        <section className="clients__tableSection">
          <header className="clients__tableHeader">
            <h2 className="clients__subtitle">Resultados</h2>

            <div className="clients__tableMeta">
              <span className="clients__count">
                {(() => {
                  const totalSafe = total ?? 0
                  const limitSafe = limit ?? 12
                  const pageSafe = page ?? 1
                  const fromN = totalSafe === 0 ? 0 : (pageSafe - 1) * limitSafe + 1
                  const toN = Math.min(pageSafe * limitSafe, totalSafe)
                  return totalSafe ? `Mostrando ${fromN}–${toN} de ${totalSafe}` : '—'
                })()}
              </span>
            </div>
          </header>

          <div className="clients__tableWrap">
            <table className="clients__table">
              <thead className="clients__thead">
                <tr className="clients__tr clients__trHead">
                  <th className="clients__th">Barbero</th>
                  <th className="clients__th">Teléfono</th>
                  <th className="clients__th">Estado</th>
                  <th className="clients__th">Color</th>
                  <th className="clients__th">Registro</th>
                  <th className="clients__th clients__thActions">Acciones</th>
                </tr>
              </thead>

              <tbody className="clients__tbody">
                {loading && (
                  <tr className="clients__tr">
                    <td className="clients__td clients__tdState" colSpan={6}>
                      <div className="clients__state clients__stateLoading">
                        <span className="clients__stateTitle">Cargando barberos…</span>
                        <span className="clients__stateText">Por favor espera un momento</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr className="clients__tr">
                    <td className="clients__td clients__tdState" colSpan={6}>
                      <div className="clients__state clients__stateError">
                        <span className="clients__stateTitle">Ocurrió un error</span>
                        <span className="clients__stateText">{error}</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && (barbers?.length ?? 0) === 0 && (
                  <tr className="clients__tr clients__trEmpty">
                    <td className="clients__td clients__tdState" colSpan={6}>
                      <div className="clients__state clients__stateEmpty">
                        <span className="clients__stateTitle">No se encontraron resultados</span>
                        <span className="clients__stateText">
                          Intenta buscar por nombre
                        </span>

                        <button
                          className="__button secondary clients__stateAction"
                          onClick={() => {
                            setQ('')
                            setPage(1)
                          }}
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && (barbers?.length ?? 0) > 0 &&
                  barbers.map((b) => {
                    const id = b?.id ?? b?._id
                    const name = b?.name ?? '—'
                    const isActive = b?.isActive !== false
                    const color = b?.color || '#000000'

                    return (
                      <tr className="clients__tr" key={id}>
                        <td className="clients__td">{name}</td>
                        <td className="clients__td">{b?.phone ?? '—'}</td>

                        <td className="clients__td">
                          <span className={`badge ${isActive ? 'badge--ok' : 'badge--off'}`}>
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>

                        <td className="clients__td">
                          <span
                            title={color}
                            style={{
                              display: 'inline-block',
                              width: 14,
                              height: 14,
                              borderRadius: 999,
                              border: '1px solid rgba(0,0,0,.2)',
                              background: color,
                              verticalAlign: 'middle',
                            }}
                          />
                          <span style={{ marginLeft: 8 }}>{color}</span>
                        </td>

                        <td className="clients__td">
                          {b?.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}
                        </td>

                        {/* ✅ ACCIONES */}
                        <td className="clients__td clients__tdActions">
                          <div className="clients__actions">
                            <button
                              className="actionBtn actionBtn--edit"
                              title="Editar barbero"
                              onClick={() => openEditBarber(b)}
                              disabled={loading}
                            >
                              ✎
                            </button>

                            <button
                              className="actionBtn actionBtn--delete"
                              title="Eliminar barbero"
                              onClick={() => {
                                setSelectedBarber(b)
                                setConfirmModalText(
                                  `¿Confirma que desea eliminar al barbero "${name}"? Esta acción no se puede deshacer.`
                                )
                                handleConfirmModal()
                              }}
                              disabled={loading}
                            >
                              🗑
                            </button>
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
        <section className="clients__pagination">
          {(() => {
            const totalPagesCalc = Math.max(1, Math.ceil((total || 0) / limit))
            const safePage = Math.min(page, totalPagesCalc)

            const canPrev = !loading && safePage > 1
            const canNext = !loading && safePage < totalPagesCalc

            const indicators = Array.from({ length: totalPagesCalc }, (_, i) => {
              const p = i + 1
              const isEdge = p === 1 || p === totalPagesCalc
              const isActive = p === safePage
              return { p, isEdge, isActive }
            })

            return (
              <>
                <div className="clients__paginationLeft">
                  <span className="clients__pageInfo">
                    Página <b>{safePage}</b> de <b>{totalPagesCalc}</b>
                  </span>
                </div>

                <div className="clients__paginationRight">
                  <button
                    className={`clients__navBtn ${canPrev ? '' : 'is-disabled'}`}
                    onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
                    disabled={!canPrev}
                    aria-label="Página anterior"
                    title="Anterior"
                  >
                    ‹
                  </button>

                  <div className="clients__pageDots" aria-label="Indicador de páginas">
                    {totalPagesCalc === 1 ? (
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
                    className={`clients__navBtn ${canNext ? '' : 'is-disabled'}`}
                    onClick={() => canNext && setPage((p) => Math.min(totalPagesCalc, p + 1))}
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

export default page