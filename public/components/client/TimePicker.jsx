'use client'
import React, { useState, useEffect } from 'react'
import {
  format,
  set,
  addMinutes,
  isBefore,
  isEqual,
  startOfDay,
  add,
  isSameDay
} from 'date-fns'
import { fromZonedTime, toZonedTime } from '@node_modules/date-fns-tz/dist/cjs';

const TUTOR_TIME_ZONE = 'America/Guayaquil'
const overlaps = (startA, endA, startB, endB) => startA < endB && startB < endA;
const STEP_MINUTES = 30;

/**
 * TimePicker: muestra botones con franjas de X minutos para un día dado.
 * Si selectedDate es hoy, solo permite slots cuya hora de inicio esté
 * 4h o más después del momento actual.
 *
 * Props:
 * - selectedDate: Date, día para el que se generan las franjas.
 * - onTimeSelect: función(day: Date) que recibe la fecha+hora de la franja seleccionada.
 * - startTime (opcional): string "HH:mm", hora de inicio (default "10:00").
 * - endTime   (opcional): string "HH:mm", hora de fin (default "22:00").
 */
export default function TimePicker({
  selectedDate,
  onTimeSelect,
  selectedTime = 30,
  startTime = '08:00',
  endTime = '20:00',
  reservedSlots = [],
}) {

  const [loading, setLoading] = useState(true)

  const userTimeZone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC';

  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)

  const getSelectedTypeDuration = () => {
    if (selectedTime === 'opcion1') {
      return 30; // minutos
    } else if (selectedTime === 'opcion2') {
      return 60; // minutos
    }
  }

  useEffect(() => {
    if (!selectedDate) {
      setSlots([])
      return
    }

    // 2. Creamos la "fecha base" en zona del tutor convertida a UTC
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const baseUtc = fromZonedTime(`${dateStr}T${startTime}:00`, TUTOR_TIME_ZONE)
    const limitUtc = fromZonedTime(`${dateStr}T${endTime}:00`, TUTOR_TIME_ZONE)

    // 3. Calculamos la hora mínima (hoy+4h) también en UTC
    const now = new Date()
    const minAllowedUtc = isSameDay(selectedDate, now)
      ? fromZonedTime(add(now, { hours: 2 }).toISOString(), TUTOR_TIME_ZONE)  // ahora UTC
      : baseUtc

    // 4. Generamos slots en UTC para el tutor
    const generated = []
    let cursor = baseUtc

    while (isBefore(cursor, limitUtc) || isEqual(cursor, limitUtc)) {

      const slotDuration = getSelectedTypeDuration();
      const end = addMinutes(cursor, slotDuration);
      const startsAfterMin = isSameDay(selectedDate, now)
        ? isBefore(minAllowedUtc, cursor) || isEqual(minAllowedUtc, cursor)
        : true

      const isTaken = reservedSlots.some((r) => {
        const rStart = new Date(r.startAt);
        const rEnd = addMinutes(rStart, Number(r.durationMinutes || 0));
        return overlaps(cursor, end, rStart, rEnd);
      });

      if (startsAfterMin && (isBefore(end, addMinutes(limitUtc, 1)))) {
        // 5. Convertimos cada slot a la hora local del usuario para mostrar
        const localStart = toZonedTime(cursor, userTimeZone)
        const localEnd = toZonedTime(end, userTimeZone)

        generated.push({
          value: cursor, // guardamos UTC para enviar al backend
          label: `${format(localStart, 'HH:mm')} – ${format(localEnd, 'HH:mm')}`,
          disabled: isTaken
        })
      }
      cursor = addMinutes(cursor, STEP_MINUTES)
    }
    setSlots(generated)
    setSelectedSlot(null)
    setLoading(false)
  }, [selectedDate, startTime, endTime, reservedSlots])

  const handleClick = (slot) => {
    if (!slot.disabled) {
      setSelectedSlot(slot.value)
      onTimeSelect?.(slot.value)
    }
    // Logging selectedSlot here will not reflect the updated value due to async state updates.
  }

  if (!selectedDate) {
    return <></>
  }


  if (loading) {
    return (
      <div className="timepicker-container">
        <div className="slots-grid">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }


  return (
    <div className="timepicker-container">
      <div className="slots-grid">
        {slots.map((slot) => (
          <button
            key={slot.value.toISOString()}
            disabled={slot.disabled}
            className={`slot-button 
              ${slot.disabled ? 'taken' : ''}
              ${selectedSlot?.toISOString() === slot.value.toISOString() ? 'selected' : ''}`}
            onClick={() => handleClick(slot)}
          >
            {slot.label}
          </button>
        ))}
      </div>
    </div>
  )
}
