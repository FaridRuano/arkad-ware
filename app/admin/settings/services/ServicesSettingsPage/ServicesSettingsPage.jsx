'use client'

import React, { useEffect, useState } from 'react'
import {
  BriefcaseBusiness,
  Clock3,
  DollarSign,
  Pencil,
  Power,
  PowerOff,
  Users,
} from 'lucide-react'
import ModalConfirm from '@public/components/shared/ModalConfirm/ModalConfirm'
import PageLoader from '@public/components/shared/PageLoader/PageLoader'
import ServiceModal from '@public/components/admin/settings/ServicesModal/ServicesModal'
import styles from './ServicesSettingsPage.module.scss'

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ')

const formatDuration = (minutes = 0) => {
  const total = Number(minutes) || 0
  const hrs = Math.floor(total / 60)
  const mins = total % 60

  if (hrs && mins) return `${hrs}h ${mins}min`
  if (hrs) return `${hrs}h`
  return `${mins}min`
}

const truncateText = (text = '', max = 30) => {
  const value = String(text || '').trim()
  if (!value) return 'Sin descripción'
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}...`
}

const ServicesPage = () => {
  /* ======================= Loading ======================= */
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /* ====================================================== */

  /* ========================= Data ======================== */
  const [services, setServices] = useState([])
  const [barbers, setBarbers] = useState([])
  const [error, setError] = useState('')
  /* ====================================================== */

  /* ===================== Confirm Modal ================== */
  const [confirmModal, setConfirmModal] = useState(false)
  const [confirmModalText, setConfirmModalText] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [selectedService, setSelectedService] = useState(null)

  const handleConfirmModal = () => {
    setConfirmModal((prev) => !prev)
  }

  const responseConfirmModal = async () => {

    if (isConfirming) return
    setIsConfirming(true)
    if (!selectedService?.id && !selectedService?._id) return

    const id = selectedService.id ?? selectedService._id
    const isActive = selectedService?.isActive !== false

    try {
      const res = await fetch(
        `/api/admin/settings/services/${id}?action=${isActive ? 'deactivate' : 'activate'}`,
        {
          method: 'DELETE',
        }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Error actualizando estado del servicio')
      }

      await fetchServices()
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
      setConfirmModal(false)
      setSelectedService(null)
      setIsConfirming(false)
    }
  }
  /* ====================================================== */

  /* ========================= Fetch ======================= */
  async function fetchServices() {
    setError('')

    try {
      const res = await fetch('/api/admin/settings/services?includeInactive=true', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Error cargando servicios')
      }

      setServices(data?.services || [])
    } catch (err) {
      setServices([])
      setError(err?.message || 'Error cargando servicios')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBarbers() {
    try {
      const res = await fetch('/api/admin/settings/barbers?includeInactive=true', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Error cargando barberos')

      setBarbers(data?.barbers || [])
    } catch (err) {
      console.error(err)
      setBarbers([])
    }
  }
  /* ====================================================== */

  /* ====================== Service Modal ================== */
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)

  const openNewService = () => {
    setEditingService(null)
    setServiceModalOpen(true)
  }

  const openEditService = (service) => {
    setEditingService(service)
    setServiceModalOpen(true)
  }

  const closeServiceModal = () => {
    setServiceModalOpen(false)
    setEditingService(null)
  }

  async function handleSaveService(payload) {
    setSaving(true)

    try {
      const isEdit = Boolean(editingService?.id || editingService?._id)
      const id = editingService?.id || editingService?._id

      const res = await fetch(
        isEdit
          ? `/api/admin/settings/services/${id}`
          : `/api/admin/settings/services/create`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo guardar el servicio')
      }

      closeServiceModal()
      fetchServices()
    } catch (e) {
      alert(e?.message || 'Error guardando servicio')
    } finally {
      setSaving(false)
    }
  }
  /* ====================================================== */

  useEffect(() => {
    setLoading(true)
    fetchServices()
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

      <ServiceModal
        open={serviceModalOpen}
        mode={editingService ? 'edit' : 'create'}
        initialData={editingService}
        saving={saving}
        barbers={barbers}
        onClose={closeServiceModal}
        onSave={handleSaveService}
      />

      <div className={m('services-page page')}>
        <section className={m('services-page__header')}>
          <div className={m('services-page__headerContent')}>
            <div className={m('services-page__titleWrap')}>
              <h1 className={m('services-page__title')}>Servicios</h1>
              <p className={m('services-page__subtitle')}>
                Administra los servicios disponibles y sus barberos asignados.
              </p>
            </div>

            <button
              className={m('__button primary services-page__newBtn')}
              onClick={openNewService}
            >
              + Nuevo
            </button>
          </div>
        </section>

        <section className={m('services-page__content')}>
          {loading && (
            <div className={m('services-page__state')}>
              <PageLoader
                title="Cargando servicios..."
                text="Espera un momento mientras se actualiza la información."
              />
            </div>
          )}

          {!loading && error && (
            <div className={m('services-page__state services-page__state--error')}>
              <span className={m('services-page__stateTitle')}>Ocurrió un error</span>
              <span className={m('services-page__stateText')}>{error}</span>

              <button className={m('__button secondary')} onClick={fetchServices}>
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && (services?.length ?? 0) === 0 && (
            <div className={m('services-page__state services-page__state--empty')}>
              <span className={m('services-page__stateTitle')}>
                Aún no hay servicios registrados
              </span>
              <span className={m('services-page__stateText')}>
                Crea el primer servicio para comenzar a organizar la agenda.
              </span>

              <button className={m('__button primary')} onClick={openNewService}>
                + Crear servicio
              </button>
            </div>
          )}

          {!loading && !error && (services?.length ?? 0) > 0 && (
            <div className={m('services-page__list')}>
              {services.map((service, index) => {
                const id = service?.id ?? service?._id
                const name = service?.name ?? 'Sin nombre'
                const description = truncateText(service?.description, 30)
                const price = Number(service?.price ?? 0)
                const duration = formatDuration(service?.durationMinutes)
                const isActive = service?.isActive !== false
                const assignedBarbers = Array.isArray(service?.barbers) ? service.barbers : []
                const color = service?.color || '#CFB690'

                return (
                  <article
                    key={id}
                    className={m('service-row-card', !isActive && 'is-inactive')}
                    style={{ '--card-index': index }}
                  >
                    <div className={m('service-row-card__main')}>
                      <div
                        className={m('service-row-card__accent')}
                        style={{ background: color }}
                      />

                      <div className={m('service-row-card__content')}>
                        <div className={m('service-row-card__top')}>
                          <div className={m('service-row-card__identity')}>
                            <div className={m('service-row-card__titleRow')}>
                              <span
                                className={m('service-row-card__status', isActive ? 'is-active' : 'is-inactive')}
                              >
                                {isActive ? 'Activo' : 'Inactivo'}
                              </span>

                              <h2 className={m('service-row-card__name')}>{name}</h2>
                            </div>

                            <p className={m('service-row-card__description')}>
                              {description}
                            </p>
                          </div>

                          <div className={m('service-row-card__actions')}>
                            {isActive && (
                              <button
                                className={m('service-row-card__actionBtn service-row-card__actionBtn--edit')}
                                title="Editar servicio"
                                onClick={() => openEditService(service)}
                                disabled={loading}
                              >
                                <Pencil size={15} />
                              </button>
                            )}

                            <button
                              className={m(
                                'service-row-card__actionBtn',
                                isActive
                                  ? 'service-row-card__actionBtn--deactivate'
                                  : 'service-row-card__actionBtn--activate',
                              )}
                              title={isActive ? 'Desactivar servicio' : 'Activar servicio'}
                              onClick={() => {
                                setSelectedService(service)
                                setConfirmModalText(
                                  isActive
                                    ? `¿Se marcará como inactivo el servicio "${name}"?`
                                    : `¿Desea volver a activar el servicio "${name}"?`
                                )
                                handleConfirmModal()
                              }}
                              disabled={loading}
                            >
                              {isActive ? <PowerOff size={15} /> : <Power size={15} />}
                            </button>
                          </div>
                        </div>

                        <div className={m('service-row-card__meta')}>
                          <div className={m('service-row-card__metaItem')}>
                            <span className={m('service-row-card__metaIcon')}>
                              <DollarSign size={15} />
                            </span>
                            <div className={m('service-row-card__metaText')}>
                              <span className={m('service-row-card__metaLabel')}>Precio</span>
                              <span className={m('service-row-card__metaValue')}>
                                ${price.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className={m('service-row-card__metaItem')}>
                            <span className={m('service-row-card__metaIcon')}>
                              <Clock3 size={15} />
                            </span>
                            <div className={m('service-row-card__metaText')}>
                              <span className={m('service-row-card__metaLabel')}>Duración</span>
                              <span className={m('service-row-card__metaValue')}>{duration}</span>
                            </div>
                          </div>

                          <div className={m('service-row-card__metaItem')}>
                            <span className={m('service-row-card__metaIcon')}>
                              <BriefcaseBusiness size={15} />
                            </span>
                            <div className={m('service-row-card__metaText')}>
                              <span className={m('service-row-card__metaLabel')}>Color</span>
                              <span className={m('service-row-card__metaValue')}>
                                <span
                                  className={m('service-row-card__colorDot')}
                                  style={{ background: color }}
                                />
                                {color}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={m('service-row-card__bottom')}>
                          <div className={m('service-row-card__bottomHeader')}>
                            <div className={m('service-row-card__assignedTitle')}>
                              <Users size={15} />
                              <span>Barberos asignados</span>
                            </div>

                            <span className={m('service-row-card__assignedCount')}>
                              {assignedBarbers.length}
                            </span>
                          </div>

                          {assignedBarbers.length > 0 ? (
                            <div className={m('service-row-card__barbers')}>
                              {assignedBarbers.map((barber) => {
                                const barberId = barber?.id ?? barber?._id
                                const barberName = barber?.name ?? 'Sin nombre'
                                const barberColor = barber?.color || '#000000'
                                const barberActive = barber?.isActive !== false

                                return (
                                  <div
                                    key={barberId}
                                    className={m('service-row-card__barberChip', !barberActive && 'is-inactive')}
                                  >
                                    <span
                                      className={m('service-row-card__barberDot')}
                                      style={{ background: barberColor }}
                                    />
                                    <span className={m('service-row-card__barberName')}>
                                      {barberName}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className={m('service-row-card__emptyBarbers')}>
                              Sin barberos asignados
                            </div>
                          )}
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

export default ServicesPage
