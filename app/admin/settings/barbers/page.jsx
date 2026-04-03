'use client'

import React, { useEffect, useState } from 'react'
import {
  Phone,
  CalendarDays,
  Pencil,
  Trash2,
  UserRound,
  Power,
  PowerOff
} from 'lucide-react'
import BarberModal from '@public/components/admin/settings/BarberModal'
import ModalConfirm from '@public/components/shared/ModalConfirm'
import { is } from '@node_modules/date-fns/locale'

const BarbersPage = () => {
  /* ======================= Loading ======================= */
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /* ====================================================== */

  /* ========================= Data ======================== */
  const [barbers, setBarbers] = useState([])
  const [error, setError] = useState('')
  /* ====================================================== */

  /* ===================== Confirm Modal ================== */
  const [confirmModal, setConfirmModal] = useState(false)
  const [confirmModalText, setConfirmModalText] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [selectedBarber, setSelectedBarber] = useState(null)

  const handleConfirmModal = () => {
    setConfirmModal((prev) => !prev)
  }

  const responseConfirmModal = async () => {
    if (isConfirming) return

    setIsConfirming(true)

    if (!selectedBarber?.id && !selectedBarber?._id) return

    const id = selectedBarber.id ?? selectedBarber._id

    try {

      const res = await fetch(`/api/admin/settings/barbers/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Error eliminando barbero')
      }

      await fetchBarbers()
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
      setConfirmModal(false)
      setSelectedBarber(null)
      setIsConfirming(false)
    }
  }
  /* ====================================================== */

  /* ========================= Fetch ======================= */
  async function fetchBarbers() {
    setError('')

    try {
      const res = await fetch('/api/admin/settings/barbers?includeInactive=true', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Error cargando barberos')
      }

      setBarbers(data?.barbers || [])
    } catch (err) {
      setBarbers([])
      setError(err?.message || 'Error cargando barberos')
    } finally {
      setLoading(false)
    }
  }
  /* ====================================================== */

  /* ====================== Barber Modal =================== */
  const [barberModalOpen, setBarberModalOpen] = useState(false)
  const [editingBarber, setEditingBarber] = useState(null)

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
        isEdit ? `/api/admin/settings/barbers/${id}` : `/api/admin/settings/barbers/create`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo guardar el barbero')
      }

      closeBarberModal()
      fetchBarbers()
    } catch (e) {
      alert(e?.message || 'Error guardando barbero')
    } finally {
      setSaving(false)
    }
  }
  /* ====================================================== */

  useEffect(() => {
    setLoading(true)
    fetchBarbers()
  }, [])

  return (
    <>
      <ModalConfirm
        mainText={confirmModalText}
        active={confirmModal}
        setActive={handleConfirmModal}
        response={responseConfirmModal}
        status={isConfirming}
        type="confirm"
      />

      <BarberModal
        open={barberModalOpen}
        mode={editingBarber ? 'edit' : 'create'}
        initialData={editingBarber}
        saving={saving}
        onClose={closeBarberModal}
        onSave={handleSaveBarber}
      />

      <div className="barbers-page page">
        <section className="barbers-page__header">
          <div className="barbers-page__headerContent">
            <div className="barbers-page__titleWrap">
              <h1 className="barbers-page__title">Barberos</h1>
              <p className="barbers-page__subtitle">
                Administra los perfiles del equipo de trabajo.
              </p>
            </div>

            <button
              className="__button primary barbers-page__newBtn"
              onClick={openNewBarber}
            >
              + Nuevo
            </button>
          </div>
        </section>

        <section className="barbers-page__content">
          {loading && (
            <div className="barbers-page__state barbers-page__state--loading">
              <div className="spinner" aria-hidden="true"></div>
              <span className="barbers-page__stateTitle">Cargando barberos…</span>
              <span className="barbers-page__stateText">
                Espera un momento mientras se actualiza la información.
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="barbers-page__state barbers-page__state--error">
              <span className="barbers-page__stateTitle">Ocurrió un error</span>
              <span className="barbers-page__stateText">{error}</span>

              <button
                className="__button secondary"
                onClick={fetchBarbers}
              >
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && (barbers?.length ?? 0) === 0 && (
            <div className="barbers-page__state barbers-page__state--empty">
              <span className="barbers-page__stateTitle">
                Aún no hay barberos registrados
              </span>
              <span className="barbers-page__stateText">
                Crea el primer perfil para empezar a organizar al equipo.
              </span>

              <button
                className="__button primary"
                onClick={openNewBarber}
              >
                + Crear barbero
              </button>
            </div>
          )}

          {!loading && !error && (barbers?.length ?? 0) > 0 && (
            <div className="barbers-page__grid">
              {barbers.map((b) => {
                const id = b?.id ?? b?._id
                const name = b?.name ?? 'Sin nombre'
                const phone = b?.phone ?? 'No registrado'
                const color = b?.color || '#1f1f1f'
                const isActive = b?.isActive !== false
                const image =
                  b?.image ||
                  b?.avatar ||
                  b?.photo ||
                  b?.photoUrl ||
                  b?.imageUrl ||
                  ''

                return (
                  <article
                    className={`barber-profile-card ${!isActive ? 'is-inactive' : ''}`}
                    key={id}
                  >
                    <div className="barber-profile-card__media">
                      {image ? (
                        <img src={image} alt={name} />
                      ) : (
                        <div className="barber-profile-card__placeholder">
                          <UserRound size={36} />
                        </div>
                      )}

                      <div className="barber-profile-card__topRow">
                        <span
                          className={`barber-profile-card__status ${isActive ? 'is-active' : 'is-inactive'}`}
                        >
                          {isActive ? 'Activo' : 'Inactivo'}
                        </span>

                        <div className="barber-profile-card__actions">
                          {
                            isActive && (
                              <button
                                className="barber-profile-card__actionBtn barber-profile-card__actionBtn--edit"
                                title="Editar barbero"
                                onClick={() => openEditBarber(b)}
                                disabled={loading}
                              >
                                <Pencil size={15} />
                              </button>
                            )
                          }


                          <button
                            className={`barber-profile-card__actionBtn ${isActive
                              ? "barber-profile-card__actionBtn--deactivate"
                              : "barber-profile-card__actionBtn--activate"
                              }`}
                            title={isActive ? "Desactivar barbero" : "Activar barbero"}
                            onClick={() => {
                              setSelectedBarber(b)

                              setConfirmModalText(
                                isActive
                                  ? `¿Se marcará como inactivo al barbero "${name}"?`
                                  : `¿Desea volver a activar al barbero "${name}"?`
                              )


                              handleConfirmModal()
                            }}
                            disabled={loading}
                          >
                            {isActive ? <PowerOff size={15} /> : <Power size={15} />}
                          </button>
                        </div>
                      </div>

                      <div
                        className="barber-profile-card__colorAccent"
                        style={{ background: color }}
                      />
                    </div>

                    <div className="barber-profile-card__body">
                      <div className="barber-profile-card__identity">
                        <h2 className="barber-profile-card__name">{name}</h2>
                        <p className="barber-profile-card__role">Barbero</p>
                      </div>

                      <div className="barber-profile-card__meta">
                        <div className="barber-profile-card__metaItem">
                          <span className="barber-profile-card__metaIcon">
                            <Phone size={15} />
                          </span>
                          <div className="barber-profile-card__metaText">
                            <span className="barber-profile-card__metaLabel">Teléfono</span>
                            <span className="barber-profile-card__metaValue">{phone}</span>
                          </div>
                        </div>

                        <div className="barber-profile-card__metaItem">
                          <span className="barber-profile-card__metaIcon">
                            <CalendarDays size={15} />
                          </span>
                          <div className="barber-profile-card__metaText">
                            <span className="barber-profile-card__metaLabel">Registro</span>
                            <span className="barber-profile-card__metaValue">
                              {b?.createdAt
                                ? new Date(b.createdAt).toLocaleDateString()
                                : 'No disponible'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="barber-profile-card__footer">
                        <div className="barber-profile-card__colorBox">
                          <span className="barber-profile-card__colorLabel">Color</span>

                          <div className="barber-profile-card__colorValue">
                            <span
                              className="barber-profile-card__colorDot"
                              style={{ background: color }}
                            />
                            <span>{color}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

export default BarbersPage