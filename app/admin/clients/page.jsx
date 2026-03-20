'use client'
import ClientModal from "@public/components/admin/ClientModal";
import ModalConfirm from "@public/components/shared/ModalConfirm";
import { set } from "mongoose";
import React, { useEffect, useState } from 'react'

const page = () => {

  /* =======================Loading=========================== */
  const [loading, setLoading] = useState(false);
  /* ========================================================= */

  /* =======================Filtros=========================== */
  const [q, setQ] = useState('')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  //paginado
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  /* ========================================================= */

  /* ===========================Data========================== */
  const [clients, setClients] = useState([])
  const [error, setError] = useState('')
  /* ========================================================= */

  /* ======================Confirm Modal====================== */
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmModalText, setConfirmModalText] = useState("");
  const [selectedClient, setSelectedClient] = useState(null)

  const handleConfirmModal = () => {
    setConfirmModal((prev) => !prev);
  }

  const responseConfirmModal = async () => {
    if (!selectedClient?.id && !selectedClient?._id) return

    const id = selectedClient.id ?? selectedClient._id

    try {
      setLoading(true)

      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Error eliminando cliente')
      }

      // 🔥 Refrescar lista
      await fetchClients()

    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
      setConfirmModal(false)
      setSelectedClient(null)
    }
  }
  /* ========================================================= */

  /* =========================Fetch=========================== */
  async function fetchClients() {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()

      if (q?.trim()) params.set('q', q.trim())
      params.set('page', String(page || 1))

      const res = await fetch(`/api/admin/clients?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Error cargando clientes')
      }

      setClients(data?.clients || [])
      setTotal(data?.total ?? 0)
      setTotalPages(data?.totalPages ?? 1)

      // si por algún motivo la página quedó fuera (ej: borraste y ya no existe esa página)
      const safeTotalPages = data?.totalPages ?? 1
      if (page > safeTotalPages) setPage(safeTotalPages)
    } catch (err) {
      setClients([])
      setTotal(0)
      setTotalPages(1)
      setError(err?.message || 'Error cargando clientes')
    } finally {
      setLoading(false)
    }
  }
  /* ========================================================= */

  /* =======================Client Modal====================== */
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null) // null = crear
  const [saving, setSaving] = useState(false)

  const openNewClient = () => {
    setEditingClient(null)
    setClientModalOpen(true)
  }

  const openEditClient = (client) => {
    setEditingClient(client)
    setClientModalOpen(true)
  }

  const closeClientModal = () => {
    setClientModalOpen(false)
    setEditingClient(null)
  }

  async function handleSaveClient(payload) {
    setSaving(true)
    try {
      const isEdit = Boolean(editingClient?.id || editingClient?._id)
      const id = editingClient?.id || editingClient?._id

      const res = await fetch(isEdit ? `/api/admin/clients/${id}` : `/api/admin/clients/create`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar el cliente')

      closeClientModal()
      fetchClients() // refresca tabla
    } catch (e) {
      // aquí puedes setear un error global o dejar que el modal lo muestre
      alert(e?.message || 'Error guardando cliente')
    } finally {
      setSaving(false)
    }
  }
  /* ========================================================= */

  useEffect(() => {
    fetchClients()
  }, [page, limit, q])

  return (
    <>
      <ModalConfirm mainText={confirmModalText} active={confirmModal} setActive={handleConfirmModal} response={responseConfirmModal} type="confirm"/>
      <ClientModal
        open={clientModalOpen}
        mode={editingClient ? "edit" : "create"}
        initialData={editingClient}
        saving={saving}
        onClose={closeClientModal}
        onSave={handleSaveClient}
      />

      <div className="clients__page page">
        {/* 1) Filtros */}
        <section className="clients__filters">
          <header className="clients__filtersHeader">
            <h1 className="clients__title">Clientes</h1>

            <div className="clients__filtersActions">
              <button
                className="__button primary clients__btnNew"
                onClick={() => {
                  // abre modal "Crear cliente"
                  openNewClient()
                }}
              >
                + Nuevo
              </button>

              <button
                className="__button clients__btnRefresh"
                onClick={() => {
                  fetchClients()
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
            {/* Búsqueda */}
            <div className="field clients__field clients__fieldSearch">
              <label className="field__label">Buscar</label>
              <input
                className="field__input"
                placeholder="Nombre o teléfono"
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
                  <th className="clients__th">Cliente</th>
                  <th className="clients__th">Teléfono</th>
                  <th className="clients__th">Cédula</th>
                  <th className="clients__th">Email</th>
                  <th className="clients__th">Dirección</th>
                  <th className="clients__th">Registro</th>
                  <th className="clients__th clients__thActions">Acciones</th>
                </tr>
              </thead>

              <tbody className="clients__tbody">
                {loading && (
                  <tr className="clients__tr">
                    <td className="clients__td clients__tdState" colSpan={7}>
                      <div className="clients__state clients__stateLoading">
                        <span className="clients__stateTitle">Cargando clientes…</span>
                        <span className="clients__stateText">Por favor espera un momento</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr className="clients__tr">
                    <td className="clients__td clients__tdState" colSpan={7}>
                      <div className="clients__state clients__stateError">
                        <span className="clients__stateTitle">Ocurrió un error</span>
                        <span className="clients__stateText">{error}</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && (clients?.length ?? 0) === 0 && (
                  <tr className="clients__tr clients__trEmpty">
                    <td className="clients__td clients__tdState" colSpan={7}>
                      <div className="clients__state clients__stateEmpty">
                        <span className="clients__stateTitle">No se encontraron resultados</span>
                        <span className="clients__stateText">
                          Intenta buscar por nombre o por número de teléfono
                        </span>

                        <button
                          className="__button secondary clients__stateAction"
                          onClick={() => {
                            setQ('')
                            setPage(1)
                            setSort('recent') // si no usas sort, borra esta línea
                          }}
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && (clients?.length ?? 0) > 0 &&
                  clients.map((c) => {
                    const id = c?.id ?? c?._id
                    const firstName = c?.firstName ?? ''
                    const lastName = c?.lastName ?? ''
                    const name = c?.name ?? (`${firstName} ${lastName}`.trim() || '—')

                    return (
                      <tr className="clients__tr" key={id}>
                        <td className="clients__td">{name}</td>
                        <td className="clients__td">{c?.phone ?? '—'}</td>
                        <td className="clients__td">{c?.cedula ?? '—'}</td>
                        <td className="clients__td">{c?.email ?? '—'}</td>
                        <td className="clients__td">{c?.address ?? '—'}</td>
                        <td className="clients__td">
                          {c?.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                        </td>

                        {/* ✅ ACCIONES */}
                        <td className="clients__td clients__tdActions">
                          <div className="clients__actions">
                            <button
                              className="actionBtn actionBtn--edit"
                              title="Editar cliente"
                              onClick={() => {
                                openEditClient(c)
                              }}
                              disabled={loading}
                            >
                              ✎
                            </button>

                            <button
                              className="actionBtn actionBtn--delete"
                              title="Eliminar cliente"
                              onClick={() => {
                                setSelectedClient(c)
                                setConfirmModalText(`¿Confirma que desea eliminar al cliente "${name}"? Esta acción no se puede deshacer.`)
                                handleConfirmModal(c, 'delete')
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
                <div className="clients__paginationLeft">
                  <span className="clients__pageInfo">
                    Página <b>{safePage}</b> de <b>{totalPages}</b>
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
                    className={`clients__navBtn ${canNext ? '' : 'is-disabled'}`}
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

export default page