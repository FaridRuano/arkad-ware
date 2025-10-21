'use client'
import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react'
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isBefore,
  startOfDay,
  isAfter,
} from 'date-fns'
import { es } from 'date-fns/locale'
import ArrowLeft from '@public/assets/icons/arrow-left.webp'
import ArrowRight from '@public/assets/icons/arrow-right.webp'
import Image from 'next/image'

/**
 * Props:
 * - onDateChange(date|null)
 * - defaultDate
 * - endDate
 * - enableEscapeKey (bool) -> limpia con tecla Esc (default: true)
 *
 * Métodos imperativos (vía ref):
 * - clear(): deselecciona el día y llama onDateChange(null)
 * - set(date: Date): selecciona ese día (si está permitido) y dispara onDateChange(date)
 */
const HorizontalCalendar = forwardRef(function HorizontalCalendar(
  {
    onDateChange,
    defaultDate,
    endDate,
    enableEscapeKey = true,
  },
  ref
) {
  const initialDate = defaultDate ? new Date(defaultDate) : null

  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [selectedDay, setSelectedDay] = useState(initialDate)

  const daysOfTheWeek = Array.from({ length: 5 }).map((_, index) =>
    addDays(currentWeekStart, index)
  )

  const today = startOfDay(new Date())
  const maxDate = endDate ? startOfDay(new Date(endDate)) : null

  const clear = () => {
    setSelectedDay(null)
    onDateChange?.(null)
  }

  const setExtern = (date) => {
    if (!date) return clear()
    const dayStart = startOfDay(date)
    const outOfRange =
      isBefore(dayStart, today) || (maxDate && isAfter(dayStart, maxDate))
    if (!outOfRange) {
      setSelectedDay(date)
      onDateChange?.(date)
    }
  }

  useImperativeHandle(ref, () => ({
    clear,
    set: setExtern,
  }))

  useEffect(() => {
    if (!enableEscapeKey) return
    const onKey = (e) => {
      if (e.key === 'Escape') clear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enableEscapeKey])

  const handlePrevWeek = () => setCurrentWeekStart((prev) => addDays(prev, -7))
  const handleNextWeek = () => setCurrentWeekStart((prev) => addDays(prev, 7))

  const handleDayClick = (day) => {
    const dayStart = startOfDay(day)
    const isOutOfRange =
      isBefore(dayStart, today) || (maxDate && isAfter(dayStart, maxDate))
    if (!isOutOfRange) {
      setSelectedDay(day)
      onDateChange?.(day)
    }
  }

  return (
    <div className="calendar-container">
      <div className="calendar-row">
        <button className="nav-button" onClick={handlePrevWeek}>
          <Image src={ArrowLeft} width={10} height={10} alt="Icon" />
        </button>

        <div className="days-wrapper">
          {daysOfTheWeek.map((day) => {
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
            const dayStart = startOfDay(day)
            const isDisabled =
              isBefore(dayStart, today) ||
              (maxDate && isAfter(dayStart, maxDate))

            return (
              <div
                key={day.toString()}
                className={`day-card ${isSelected ? 'selected' : ''} ${
                  isDisabled ? 'disabled' : ''
                }`}
                onClick={() => handleDayClick(day)}
              >
                <div className="day-label">
                  {format(day, 'EEE', { locale: es })}
                </div>
                <div className="day-number">{format(day, 'd')}</div>
                <div className="month-label">
                  {format(day, 'LLL', { locale: es })}
                </div>
              </div>
            )
          })}
        </div>

        <button className="nav-button" onClick={handleNextWeek}>
          <Image src={ArrowRight} width={10} height={10} alt="Icon" />
        </button>
      </div>

      <div className="selected-info">
        {selectedDay
          ? format(selectedDay, 'EEEE, d LLL yyyy', { locale: es })
          : 'Selecciona un día'}
      </div>
    </div>
  )
})

export default HorizontalCalendar
