'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  Save,
} from 'lucide-react'
import ModalConfirm from '@public/components/shared/ModalConfirm'
import { set } from 'mongoose'

const DAY_LABELS = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

const DEFAULT_BUSINESS = {
  timezone: 'America/Guayaquil',
  generalSchedule: {
    weekdays: {
      enabled: true,
      start: '09:00',
      end: '18:00',
    },
    saturday: {
      enabled: true,
      start: '09:00',
      end: '14:00',
    },
    sunday: {
      enabled: false,
      start: '',
      end: '',
    },
  },
  slotIntervalMinutes: 15,
  bookingMinNoticeMinutes: 60,
  bookingMaxDaysAhead: 30,
}

const DEFAULT_WEEK_SCHEDULE = [
  { day: 0, enabled: false, start: '', end: '', breakStart: '', breakEnd: '' },
  { day: 1, enabled: true, start: '09:00', end: '18:00', breakStart: '', breakEnd: '' },
  { day: 2, enabled: true, start: '09:00', end: '18:00', breakStart: '', breakEnd: '' },
  { day: 3, enabled: true, start: '09:00', end: '18:00', breakStart: '', breakEnd: '' },
  { day: 4, enabled: true, start: '09:00', end: '18:00', breakStart: '', breakEnd: '' },
  { day: 5, enabled: true, start: '09:00', end: '18:00', breakStart: '', breakEnd: '' },
  { day: 6, enabled: true, start: '09:00', end: '14:00', breakStart: '', breakEnd: '' },
]

const normalizeBusinessData = (business) => {
  if (!business) return DEFAULT_BUSINESS

  return {
    timezone: business?.timezone ?? 'America/Guayaquil',
    generalSchedule: {
      weekdays: {
        enabled: business?.generalSchedule?.weekdays?.enabled ?? true,
        start: business?.generalSchedule?.weekdays?.start ?? '09:00',
        end: business?.generalSchedule?.weekdays?.end ?? '18:00',
      },
      saturday: {
        enabled: business?.generalSchedule?.saturday?.enabled ?? true,
        start: business?.generalSchedule?.saturday?.start ?? '09:00',
        end: business?.generalSchedule?.saturday?.end ?? '14:00',
      },
      sunday: {
        enabled: business?.generalSchedule?.sunday?.enabled ?? false,
        start: business?.generalSchedule?.sunday?.start ?? '',
        end: business?.generalSchedule?.sunday?.end ?? '',
      },
    },
    slotIntervalMinutes: business?.slotIntervalMinutes ?? 15,
    bookingMinNoticeMinutes: business?.bookingMinNoticeMinutes ?? 60,
    bookingMaxDaysAhead: business?.bookingMaxDaysAhead ?? 30,
  }
}

const normalizeScheduleRow = (item) => ({
  day: Number(item?.day),
  enabled: Boolean(item?.enabled),
  start: item?.start ?? '',
  end: item?.end ?? '',
  breakStart: item?.breakStart ?? '',
  breakEnd: item?.breakEnd ?? '',
})

const normalizeScheduleForCompare = (schedule) => ({
  id: schedule?.id ?? null,
  barberId: schedule?.barber?.id || schedule?.barber?._id || null,
  useBusinessHoursAsFallback: Boolean(schedule?.useBusinessHoursAsFallback),
  notes: String(schedule?.notes || '').trim(),
  isActive: Boolean(schedule?.isActive),
  weekSchedule: (schedule?.weekSchedule || [])
    .map((day) => ({
      day: Number(day.day),
      enabled: Boolean(day.enabled),
      start: day?.start || '',
      end: day?.end || '',
      breakStart: day?.breakStart || '',
      breakEnd: day?.breakEnd || '',
    }))
    .sort((a, b) => a.day - b.day),
})

const normalizeBusinessForCompare = (business) => ({
  timezone: String(business?.timezone || '').trim(),
  generalSchedule: {
    weekdays: {
      enabled: Boolean(business?.generalSchedule?.weekdays?.enabled),
      start: business?.generalSchedule?.weekdays?.enabled
        ? business?.generalSchedule?.weekdays?.start || ''
        : '',
      end: business?.generalSchedule?.weekdays?.enabled
        ? business?.generalSchedule?.weekdays?.end || ''
        : '',
    },
    saturday: {
      enabled: Boolean(business?.generalSchedule?.saturday?.enabled),
      start: business?.generalSchedule?.saturday?.enabled
        ? business?.generalSchedule?.saturday?.start || ''
        : '',
      end: business?.generalSchedule?.saturday?.enabled
        ? business?.generalSchedule?.saturday?.end || ''
        : '',
    },
    sunday: {
      enabled: Boolean(business?.generalSchedule?.sunday?.enabled),
      start: business?.generalSchedule?.sunday?.enabled
        ? business?.generalSchedule?.sunday?.start || ''
        : '',
      end: business?.generalSchedule?.sunday?.enabled
        ? business?.generalSchedule?.sunday?.end || ''
        : '',
    },
  },
  slotIntervalMinutes: Number(business?.slotIntervalMinutes),
  bookingMinNoticeMinutes: Number(business?.bookingMinNoticeMinutes),
  bookingMaxDaysAhead: Number(business?.bookingMaxDaysAhead),
})

const SchedulePage = () => {
  const [loading, setLoading] = useState(true)
  const [businessSaving, setBusinessSaving] = useState(false)
  const [scheduleSavingId, setScheduleSavingId] = useState(null)
  const [error, setError] = useState('')

  const [businessExists, setBusinessExists] = useState(false)
  const [businessForm, setBusinessForm] = useState(DEFAULT_BUSINESS)
  const [initialBusinessForm, setInitialBusinessForm] = useState(DEFAULT_BUSINESS)

  const [barberSchedules, setBarberSchedules] = useState([])
  const [initialBarberSchedulesMap, setInitialBarberSchedulesMap] = useState({})

  const [confirmModal, setConfirmModal] = useState(false)
  const [confirmModalText, setConfirmModalText] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const [alertModal, setAlertModal] = useState(false)
  const [alertText, setAlertText] = useState('')
  const [alertTitle, setAlertTitle] = useState('')

  const handleConfirmModal = () => {
    setConfirmModal((prev) => !prev)
  }

  async function fetchBusiness() {
    const res = await fetch('/api/admin/settings/schedule/business', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Error cargando configuración general')

    const business = data?.business || null
    const normalized = normalizeBusinessData(business)

    setBusinessExists(Boolean(business))
    setBusinessForm(normalized)
    setInitialBusinessForm(normalized)
  }

  async function fetchBarberSchedules() {
    const res = await fetch('/api/admin/settings/schedule/barbers?includeInactive=true', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Error cargando horarios de barberos')

    const list = Array.isArray(data?.schedules) ? data.schedules : []

    const normalized = list.map((item) => ({
      ...item,
      weekSchedule: Array.isArray(item?.weekSchedule)
        ? [...item.weekSchedule].sort((a, b) => a.day - b.day).map(normalizeScheduleRow)
        : DEFAULT_WEEK_SCHEDULE.map(normalizeScheduleRow),
      notes: item?.notes ?? '',
      useBusinessHoursAsFallback: item?.useBusinessHoursAsFallback ?? true,
      isActive: item?.isActive ?? true,
    }))

    setBarberSchedules(normalized)

    const initialMap = {}
    normalized.forEach((item) => {
      const barberId = item?.barber?.id || item?.barber?._id
      if (barberId) {
        initialMap[barberId] = normalizeScheduleForCompare(item)
      }
    })
    setInitialBarberSchedulesMap(initialMap)
  }

  async function fetchAll() {
    setError('')
    setLoading(true)

    try {
      await Promise.all([fetchBusiness(), fetchBarberSchedules()])
    } catch (err) {
      setError(err?.message || 'Error cargando horarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const setBusinessRange = (key, field, value) => {
    setBusinessForm((prev) => ({
      ...prev,
      generalSchedule: {
        ...prev.generalSchedule,
        [key]: {
          ...prev.generalSchedule[key],
          [field]: value,
        },
      },
    }))
  }

  const setBusinessField = (key, value) => {
    setBusinessForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const validateBusiness = () => {
    const gs = businessForm.generalSchedule

    const validateRange = (label, range) => {
      if (!range.enabled) return ''
      if (!range.start || !range.end) return `${label} debe tener hora de inicio y fin`
      if (range.start >= range.end) return `La hora inicial de ${label} debe ser menor que la final`
      return ''
    }

    return (
      validateRange('Lunes a viernes', gs.weekdays) ||
      validateRange('Sábado', gs.saturday) ||
      validateRange('Domingo', gs.sunday) ||
      ''
    )
  }

  const saveBusiness = async () => {

    if (isConfirming) return

    setIsConfirming(true)
    setBusinessSaving(true)

    try {
      const payload = {
        timezone: businessForm.timezone.trim() || 'America/Guayaquil',
        generalSchedule: {
          weekdays: {
            enabled: Boolean(businessForm.generalSchedule.weekdays.enabled),
            start: businessForm.generalSchedule.weekdays.enabled
              ? businessForm.generalSchedule.weekdays.start
              : '',
            end: businessForm.generalSchedule.weekdays.enabled
              ? businessForm.generalSchedule.weekdays.end
              : '',
          },
          saturday: {
            enabled: Boolean(businessForm.generalSchedule.saturday.enabled),
            start: businessForm.generalSchedule.saturday.enabled
              ? businessForm.generalSchedule.saturday.start
              : '',
            end: businessForm.generalSchedule.saturday.enabled
              ? businessForm.generalSchedule.saturday.end
              : '',
          },
          sunday: {
            enabled: Boolean(businessForm.generalSchedule.sunday.enabled),
            start: businessForm.generalSchedule.sunday.enabled
              ? businessForm.generalSchedule.sunday.start
              : '',
            end: businessForm.generalSchedule.sunday.enabled
              ? businessForm.generalSchedule.sunday.end
              : '',
          },
        },
        slotIntervalMinutes: Number(businessForm.slotIntervalMinutes),
        bookingMinNoticeMinutes: Number(businessForm.bookingMinNoticeMinutes),
        bookingMaxDaysAhead: Number(businessForm.bookingMaxDaysAhead),
      }

      const res = await fetch('/api/admin/settings/schedule/business', {
        method: businessExists ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar la configuración general')

      const normalized = normalizeBusinessData(data?.business)

      setBusinessExists(true)
      setBusinessForm(normalized)
      setInitialBusinessForm(normalized)
    } catch (err) {
      setAlertTitle('No se pudo guardar')
      setAlertText(err?.message || 'Error guardando configuración general')
      setAlertModal(true)
    } finally {
      setBusinessSaving(false)
      setConfirmModal(false)
      setConfirmAction(null)
      setIsConfirming(false)

    }
  }

  const updateBarberScheduleField = (index, field, value) => {
    setBarberSchedules((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
            ...item,
            [field]: value,
          }
          : item
      )
    )
  }

  const updateDayField = (scheduleIndex, dayIndex, field, value) => {
    setBarberSchedules((prev) =>
      prev.map((schedule, i) => {
        if (i !== scheduleIndex) return schedule

        return {
          ...schedule,
          weekSchedule: schedule.weekSchedule.map((dayItem, j) => {
            if (j !== dayIndex) return dayItem

            const next = {
              ...dayItem,
              [field]: value,
            }

            if (field === 'enabled' && !value) {
              next.start = ''
              next.end = ''
              next.breakStart = ''
              next.breakEnd = ''
            }

            return next
          }),
        }
      })
    )
  }

  const validateBarberSchedule = (schedule) => {
    const days = schedule?.weekSchedule || []

    if (days.length !== 7) return 'El horario semanal debe tener 7 días'

    for (const day of days) {
      if (!day.enabled) continue

      if (!day.start || !day.end) {
        return `El día ${DAY_LABELS[day.day]} debe tener hora de inicio y fin`
      }

      if (day.start >= day.end) {
        return `El día ${DAY_LABELS[day.day]} tiene un rango inválido`
      }

      const hasBreak = day.breakStart || day.breakEnd
      if (hasBreak) {
        if (!day.breakStart || !day.breakEnd) {
          return `El descanso de ${DAY_LABELS[day.day]} está incompleto`
        }

        if (day.breakStart >= day.breakEnd) {
          return `El descanso de ${DAY_LABELS[day.day]} es inválido`
        }

        if (day.breakStart <= day.start || day.breakEnd >= day.end) {
          return `El descanso de ${DAY_LABELS[day.day]} debe estar dentro del horario laboral`
        }
      }
    }

    return ''
  }

  const saveBarberSchedule = async (schedule) => {

    if (isConfirming) return


    const barberId = schedule?.barber?.id || schedule?.barber?._id
    const scheduleId = schedule?.id || schedule?._id

    if (!barberId) {
      setAlertTitle('Aviso')
      setAlertText('No se encontró el barbero asociado')
      setAlertModal(true)
      return
    }
    setIsConfirming(true)
    setScheduleSavingId(barberId)

    try {
      const payload = {
        barber: barberId,
        weekSchedule: schedule.weekSchedule.map((day) => ({
          day: Number(day.day),
          enabled: Boolean(day.enabled),
          start: day.enabled ? day.start : '',
          end: day.enabled ? day.end : '',
          breakStart: day.enabled ? day.breakStart || '' : '',
          breakEnd: day.enabled ? day.breakEnd || '' : '',
        })),
        useBusinessHoursAsFallback: Boolean(schedule.useBusinessHoursAsFallback),
        notes: String(schedule.notes || '').trim(),
        isActive: Boolean(schedule.isActive),
      }


      const res = await fetch(
        scheduleId
          ? `/api/admin/settings/schedule/barbers/${scheduleId}`
          : '/api/admin/settings/schedule/barbers/create',
        {
          method: scheduleId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar el horario del barbero')

      await fetchBarberSchedules()
    } catch (err) {
      setAlertTitle('No se pudo guardar')
      setAlertText(err?.message || 'Error guardando horario del barbero')
      setAlertModal(true)
    } finally {
      setScheduleSavingId(null)
      setConfirmModal(false)
      setConfirmAction(null)
      setIsConfirming(false)
    }
  }

  const businessSummary = useMemo(() => {
    const { weekdays, saturday, sunday } = businessForm.generalSchedule

    const formatRange = (range) =>
      range.enabled ? `${range.start} - ${range.end}` : 'Cerrado'

    return {
      weekdays: formatRange(weekdays),
      saturday: formatRange(saturday),
      sunday: formatRange(sunday),
    }
  }, [businessForm])

  const businessHasChanges = useMemo(() => {
    return (
      JSON.stringify(normalizeBusinessForCompare(businessForm)) !==
      JSON.stringify(normalizeBusinessForCompare(initialBusinessForm))
    )
  }, [businessForm, initialBusinessForm])

  const barberHasChanges = (schedule) => {
    const barberId = schedule?.barber?.id || schedule?.barber?._id
    if (!barberId) return false

    const current = normalizeScheduleForCompare(schedule)
    const initial = initialBarberSchedulesMap[barberId]

    return JSON.stringify(current) !== JSON.stringify(initial)
  }

  const requestSaveBusiness = () => {
    const validationError = validateBusiness()
    if (validationError) {
      setAlertTitle('Error de validación')
      setAlertText(validationError)
      setAlertModal(true)
      return
    }

    if (!businessHasChanges) return

    setConfirmModalText('¿Desea guardar los cambios de la configuración general de horarios?')
    setConfirmAction(() => saveBusiness)
    setConfirmModal(true)
  }

  const requestSaveBarberSchedule = (schedule) => {
    const validationError = validateBarberSchedule(schedule)
    if (validationError) {
      setAlertTitle('Error de validación')
      setAlertText(validationError)
      setAlertModal(true)
      return
    }

    if (!barberHasChanges(schedule)) return

    const barberName = schedule?.barber?.name || 'este barbero'
    setConfirmModalText(`¿Desea guardar los cambios del horario de "${barberName}"?`)
    setConfirmAction(() => () => saveBarberSchedule(schedule))
    setConfirmModal(true)
  }

  const handleDiscardBusinessChanges = () => {
    setBusinessForm(initialBusinessForm)
  }

  const handleDiscardBarberScheduleChanges = (barberId) => {
    if (!barberId) return

    const initial = initialBarberSchedulesMap[barberId]
    if (!initial) return

    setBarberSchedules((prev) =>
      prev.map((item) => {
        const currentBarberId = item?.barber?.id || item?.barber?._id
        if (currentBarberId !== barberId) return item

        return {
          ...item,
          weekSchedule: initial.weekSchedule.map((day) => ({
            day: Number(day.day),
            enabled: Boolean(day.enabled),
            start: day.start || '',
            end: day.end || '',
            breakStart: day.breakStart || '',
            breakEnd: day.breakEnd || '',
          })),
          useBusinessHoursAsFallback: Boolean(initial.useBusinessHoursAsFallback),
          notes: initial.notes || '',
          isActive: Boolean(initial.isActive),
        }
      })
    )
  }


  return (
    <>
      <ModalConfirm
        mainText={confirmModalText}
        active={confirmModal}
        setActive={handleConfirmModal}
        status={isConfirming}
        response={() => confirmAction?.()}
        type="confirm"
      />

      <ModalConfirm
        active={alertModal}
        setActive={setAlertModal}
        mainText={alertText}
        title={alertTitle}
        type="alert"
      />

      <div className="schedule-page page">
        <section className="schedule-page__header">
          <div className="schedule-page__headerContent">
            <div className="schedule-page__titleWrap">
              <h1 className="schedule-page__title">Horarios</h1>
              <p className="schedule-page__subtitle">
                Configura la disponibilidad general del negocio y el horario semanal de cada barbero.
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="schedule-page__state">
            <div className="spinner" aria-hidden="true"></div>
            <span className="schedule-page__stateTitle">Cargando horarios…</span>
            <span className="schedule-page__stateText">
              Espera un momento mientras se prepara la configuración.
            </span>
          </section>
        ) : error ? (
          <section className="schedule-page__state">
            <span className="schedule-page__stateTitle">Ocurrió un error</span>
            <span className="schedule-page__stateText">{error}</span>
            <button className="__button secondary" onClick={fetchAll}>
              Reintentar
            </button>
          </section>
        ) : (
          <>
            <section className="schedule-page__business">
              <div className="schedule-business-card">
                <div className="schedule-business-card__top">
                  <div className="schedule-business-card__titleWrap">
                    <div className="schedule-business-card__eyebrow">
                      <BriefcaseBusiness size={15} />
                      <span>Configuración general</span>
                    </div>

                    <h2 className="schedule-business-card__title">Horario general del negocio</h2>
                    <p className="schedule-business-card__text">
                      Define la base sobre la que luego se organizan los horarios individuales.
                    </p>
                  </div>

                  <div className="schedule-business-card__actions">
                    <button
                      className="__button schedule-business-card__discardBtn"
                      onClick={handleDiscardBusinessChanges}
                      disabled={businessSaving || !businessHasChanges}
                      type="button"
                    >
                      Descartar cambios
                    </button>

                    <button
                      className="__button primary schedule-business-card__saveBtn"
                      onClick={requestSaveBusiness}
                      disabled={businessSaving || !businessHasChanges}
                      type="button"
                    >
                      {businessSaving ? 'Guardando…' : 'Guardar general'}
                    </button>
                  </div>
                </div>

                <div className="schedule-business-card__grid">
                  <div className="schedule-business-card__ranges">
                    <div className="schedule-range-card">
                      <div className="schedule-range-card__head">
                        <h3 className="schedule-range-card__title">Lunes a viernes</h3>
                        <label className="schedule-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(businessForm.generalSchedule.weekdays.enabled)}
                            onChange={(e) =>
                              setBusinessRange('weekdays', 'enabled', e.target.checked)
                            }
                          />
                          <span>{businessForm.generalSchedule.weekdays.enabled ? 'Activo' : 'Cerrado'}</span>
                        </label>
                      </div>

                      <div className="schedule-range-card__times">
                        <div className="field">
                          <label className="field__label">Inicio</label>
                          <input
                            className="field__input"
                            type="time"
                            value={businessForm.generalSchedule.weekdays.start}
                            onChange={(e) =>
                              setBusinessRange('weekdays', 'start', e.target.value)
                            }
                            disabled={!businessForm.generalSchedule.weekdays.enabled}
                          />
                        </div>

                        <div className="field">
                          <label className="field__label">Fin</label>
                          <input
                            className="field__input"
                            type="time"
                            value={businessForm.generalSchedule.weekdays.end}
                            onChange={(e) =>
                              setBusinessRange('weekdays', 'end', e.target.value)
                            }
                            disabled={!businessForm.generalSchedule.weekdays.enabled}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="schedule-range-card">
                      <div className="schedule-range-card__head">
                        <h3 className="schedule-range-card__title">Sábado</h3>
                        <label className="schedule-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(businessForm.generalSchedule.saturday.enabled)}
                            onChange={(e) =>
                              setBusinessRange('saturday', 'enabled', e.target.checked)
                            }
                          />
                          <span>{businessForm.generalSchedule.saturday.enabled ? 'Activo' : 'Cerrado'}</span>
                        </label>
                      </div>

                      <div className="schedule-range-card__times">
                        <div className="field">
                          <label className="field__label">Inicio</label>
                          <input
                            className="field__input"
                            type="time"
                            value={businessForm.generalSchedule.saturday.start}
                            onChange={(e) =>
                              setBusinessRange('saturday', 'start', e.target.value)
                            }
                            disabled={!businessForm.generalSchedule.saturday.enabled}
                          />
                        </div>

                        <div className="field">
                          <label className="field__label">Fin</label>
                          <input
                            className="field__input"
                            type="time"
                            value={businessForm.generalSchedule.saturday.end}
                            onChange={(e) =>
                              setBusinessRange('saturday', 'end', e.target.value)
                            }
                            disabled={!businessForm.generalSchedule.saturday.enabled}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="schedule-range-card">
                      <div className="schedule-range-card__head">
                        <h3 className="schedule-range-card__title">Domingo</h3>
                        <label className="schedule-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(businessForm.generalSchedule.sunday.enabled)}
                            onChange={(e) =>
                              setBusinessRange('sunday', 'enabled', e.target.checked)
                            }
                          />
                          <span>{businessForm.generalSchedule.sunday.enabled ? 'Activo' : 'Cerrado'}</span>
                        </label>
                      </div>

                      <div className="schedule-range-card__times">
                        <div className="field">
                          <label className="field__label">Inicio</label>
                          <input
                            className="field__input"
                            type="time"
                            value={businessForm.generalSchedule.sunday.start}
                            onChange={(e) =>
                              setBusinessRange('sunday', 'start', e.target.value)
                            }
                            disabled={!businessForm.generalSchedule.sunday.enabled}
                          />
                        </div>

                        <div className="field">
                          <label className="field__label">Fin</label>
                          <input
                            className="field__input"
                            type="time"
                            value={businessForm.generalSchedule.sunday.end}
                            onChange={(e) =>
                              setBusinessRange('sunday', 'end', e.target.value)
                            }
                            disabled={!businessForm.generalSchedule.sunday.enabled}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="schedule-business-card__summary">
                    <div className="schedule-summary-chip">
                      <span className="schedule-summary-chip__label">Lun - Vie</span>
                      <span className="schedule-summary-chip__value">{businessSummary.weekdays}</span>
                    </div>

                    <div className="schedule-summary-chip">
                      <span className="schedule-summary-chip__label">Sábado</span>
                      <span className="schedule-summary-chip__value">{businessSummary.saturday}</span>
                    </div>

                    <div className="schedule-summary-chip">
                      <span className="schedule-summary-chip__label">Domingo</span>
                      <span className="schedule-summary-chip__value">{businessSummary.sunday}</span>
                    </div>
                  </div>

                  <div className="schedule-business-card__rules">
                    <div className="field">
                      <label className="field__label">Intervalo de agenda (min)</label>
                      <input
                        className="field__input"
                        type="number"
                        min="5"
                        step="5"
                        value={businessForm.slotIntervalMinutes}
                        onChange={(e) =>
                          setBusinessField('slotIntervalMinutes', e.target.value)
                        }
                      />
                    </div>

                    <div className="field">
                      <label className="field__label">Anticipación mínima (min)</label>
                      <input
                        className="field__input"
                        type="number"
                        min="0"
                        step="5"
                        value={businessForm.bookingMinNoticeMinutes}
                        onChange={(e) =>
                          setBusinessField('bookingMinNoticeMinutes', e.target.value)
                        }
                      />
                    </div>

                    <div className="field">
                      <label className="field__label">Máximo días de anticipación</label>
                      <input
                        className="field__input"
                        type="number"
                        min="1"
                        step="1"
                        value={businessForm.bookingMaxDaysAhead}
                        onChange={(e) =>
                          setBusinessField('bookingMaxDaysAhead', e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="schedule-page__barbers">
              <div className="schedule-page__sectionHead">
                <h2 className="schedule-page__sectionTitle">Horarios por barbero</h2>
                <p className="schedule-page__sectionText">
                  Ajusta la jornada semanal individual de cada miembro del equipo.
                </p>
              </div>

              <div className="schedule-page__barberList">
                {barberSchedules.map((schedule, index) => {
                  const barber = schedule?.barber || {}
                  const barberId = barber?.id || barber?._id || `row-${index}`
                  const barberName = barber?.name || 'Barbero'
                  const barberColor = barber?.color || '#000000'
                  const barberActive = barber?.isActive !== false
                  const isSaving = scheduleSavingId === barberId
                  const hasChanges = barberHasChanges(schedule)

                  return (
                    <article
                      key={barberId}
                      className={`barber-schedule-card ${!barberActive ? 'is-inactive' : ''}`}
                    >
                      {schedule.useBusinessHoursAsFallback && (
                        <div className="schedule-inherited-banner">
                          Este barbero usa el horario general del negocio.
                        </div>
                      )}
                      <div className="barber-schedule-card__top">
                        <div className="barber-schedule-card__identity">
                          <div className="barber-schedule-card__titleRow">
                            <span
                              className="barber-schedule-card__color"
                              style={{ background: barberColor }}
                            />
                            <h3 className="barber-schedule-card__name">{barberName}</h3>
                            {!barberActive && (
                              <span className="barber-schedule-card__badge">Inactivo</span>
                            )}
                            {!schedule?.hasCustomSchedule && (
                              <span className="barber-schedule-card__badge barber-schedule-card__badge--ghost">
                                Nuevo horario
                              </span>
                            )}
                          </div>

                          <p className="barber-schedule-card__text">
                            Configura los días y horas en que este barbero puede recibir reservas.
                          </p>
                        </div>

                        <div className="barber-schedule-card__actions">
                          <button
                            className="__button barber-schedule-card__discardBtn"
                            onClick={() => handleDiscardBarberScheduleChanges(barberId)}
                            disabled={isSaving || !hasChanges}
                            type="button"
                          >
                            Descartar cambios
                          </button>

                          <button
                            className="__button primary barber-schedule-card__saveBtn"
                            onClick={() => requestSaveBarberSchedule(schedule)}
                            disabled={isSaving || !hasChanges}
                            type="button"
                          >
                            {isSaving ? 'Guardando…' : 'Guardar horario'}
                          </button>
                        </div>
                      </div>

                      <div className="barber-schedule-card__controls">
                        <label className="schedule-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(schedule.useBusinessHoursAsFallback)}
                            onChange={(e) =>
                              updateBarberScheduleField(
                                index,
                                'useBusinessHoursAsFallback',
                                e.target.checked
                              )
                            }
                          />
                          <span>Usar horario general como referencia</span>
                        </label>
                      </div>

                      <div className="barber-schedule-card__days">
                        {schedule.weekSchedule.map((dayItem, dayIndex) => {
                          const isLockedByBusiness = Boolean(schedule?.useBusinessHoursAsFallback)

                          return (

                            <div
                              className={`schedule-day-row ${isLockedByBusiness ? 'is-locked' : ''}`}
                              key={`${barberId}-${dayItem.day}`}
                            >
                              <div className="schedule-day-row__left">
                                <div className="schedule-day-row__dayWrap">
                                  <span className="schedule-day-row__day">
                                    {DAY_LABELS[dayItem.day]}
                                  </span>

                                  <label className="schedule-toggle">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(dayItem.enabled)}
                                      onChange={(e) =>
                                        updateDayField(index, dayIndex, 'enabled', e.target.checked)
                                      }

                                      disabled={isLockedByBusiness}
                                    />
                                    <span>{dayItem.enabled ? 'Activo' : 'Libre'}</span>
                                  </label>
                                </div>
                              </div>

                              <div className="schedule-day-row__times">
                                <div className="field">
                                  <label className="field__label">Inicio</label>
                                  <input
                                    className="field__input"
                                    type="time"
                                    value={dayItem.start}
                                    onChange={(e) =>
                                      updateDayField(index, dayIndex, 'start', e.target.value)
                                    }
                                    disabled={isLockedByBusiness || !dayItem.enabled}
                                  />
                                </div>

                                <div className="field">
                                  <label className="field__label">Fin</label>
                                  <input
                                    className="field__input"
                                    type="time"
                                    value={dayItem.end}
                                    onChange={(e) =>
                                      updateDayField(index, dayIndex, 'end', e.target.value)
                                    }
                                    disabled={isLockedByBusiness || !dayItem.enabled}

                                  />
                                </div>

                                <div className="field">
                                  <label className="field__label">Descanso inicio</label>
                                  <input
                                    className="field__input"
                                    type="time"
                                    value={dayItem.breakStart}
                                    onChange={(e) =>
                                      updateDayField(index, dayIndex, 'breakStart', e.target.value)
                                    }
                                    disabled={isLockedByBusiness || !dayItem.enabled}

                                  />
                                </div>

                                <div className="field">
                                  <label className="field__label">Descanso fin</label>
                                  <input
                                    className="field__input"
                                    type="time"
                                    value={dayItem.breakEnd}
                                    onChange={(e) =>
                                      updateDayField(index, dayIndex, 'breakEnd', e.target.value)
                                    }
                                    disabled={isLockedByBusiness || !dayItem.enabled}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })
                        }
                      </div>

                      <div className="barber-schedule-card__footer">
                        <div className="field" style={{ width: '100%' }}>
                          <label className="field__label">Notas</label>
                          <input
                            className="field__input"
                            value={schedule.notes || ''}
                            onChange={(e) =>
                              updateBarberScheduleField(index, 'notes', e.target.value)
                            }
                            placeholder="Ej: descanso al mediodía / horario especial"
                          />
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  )
}

export default SchedulePage