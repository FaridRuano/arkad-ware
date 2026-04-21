'use client';

import { useMemo } from 'react';
import styles from './ScheduleCalendar.module.scss';

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ');

const DEFAULT_INTERVAL = 30;

function parseTimeToMinutes(value = '') {
  if (!value || typeof value !== 'string' || !value.includes(':')) return null;

  const [hh, mm] = value.split(':').map(Number);

  if (
    Number.isNaN(hh) ||
    Number.isNaN(mm) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  ) {
    return null;
  }

  return hh * 60 + mm;
}

function formatMinutesToHHMM(totalMinutes = 0) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getMinutesFromDateValue(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function isInsideBreakRange(minutes, breakStart, breakEnd) {
  if (breakStart == null || breakEnd == null) return false;
  return minutes >= breakStart && minutes < breakEnd;
}

function isSameDayAsToday(dateISO = '') {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return dateISO === `${year}-${month}-${day}`;
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getStatusLabel(status = '') {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'confirmed':
      return 'Confirmada';
    case 'in_progress':
      return 'En curso';
    case 'completed':
      return 'Completada';
    case 'cancelled':
      return 'Cancelada';
    case 'no_assistance':
      return 'No asistió';
    default:
      return 'Cita';
  }
}

function getClientName(appointment) {
  return (
    appointment?.client?.name ||
    [appointment?.client?.firstName, appointment?.client?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'Cliente'
  );
}

function getServiceName(appointment) {
  return appointment?.serviceName || 'Servicio';
}

function getAppointmentCardStyle(appointment) {
  const barberColor = appointment?.barber?.color || '#8b5cf6';

  return {
    '--appointment-accent': barberColor,
  };
}

function getSlotKey(minutes) {
  return formatMinutesToHHMM(minutes);
}

function getExceptionLabel(exception = {}) {
  if (exception?.scope === 'business') {
    return exception?.type === 'time_range' ? 'Horario cerrado' : 'Día cerrado';
  }

  return exception?.barber?.name
    ? `Cerrado · ${exception.barber.name}`
    : 'Horario cerrado';
}

function getExceptionAccent(exception = {}) {
  if (exception?.scope === 'business') {
    return '#c86f4d';
  }

  return exception?.barber?.color || '#8f8a7a';
}

function exceptionOverlapsSlot(exception, slot) {
  if (!exception || exception?.type !== 'time_range') return false;
  const start = parseTimeToMinutes(exception?.startTime);
  const end = parseTimeToMinutes(exception?.endTime);

  if (start == null || end == null) return false;

  return start < slot.endMinutes && end > slot.minutes;
}

function normalizeDurationToInterval(durationMinutes, slotIntervalMinutes) {
  const duration = Number(durationMinutes || 0);
  const interval = Number(slotIntervalMinutes || 0);

  if (!Number.isFinite(duration) || duration <= 0) return interval || DEFAULT_INTERVAL;
  if (!Number.isFinite(interval) || interval <= 0) return Math.ceil(duration);

  return Math.ceil(duration / interval) * interval;
}

function getAppointmentDurationMinutes(appointment, fallback = DEFAULT_INTERVAL) {
  const start = getMinutesFromDateValue(appointment?.startAt);
  const end = getMinutesFromDateValue(appointment?.endAt);

  if (start != null && end != null && end > start) {
    return normalizeDurationToInterval(end - start, fallback);
  }

  return normalizeDurationToInterval(Number(appointment?.durationMinutes) || fallback, fallback);
}

function getAppointmentDisplayDurationMinutes(appointment, fallback = DEFAULT_INTERVAL) {
  const value = Number(
    appointment?.serviceDurationMinutes ?? appointment?.durationMinutes ?? fallback
  );

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export default function ScheduleCalendar({
  dateISO,
  appointments = [],
  exceptions = [],
  schedule = null,
  selectedBarberId = '',
  onCreateAtSlot,
  onOpenAppointment,
  onCreateException,
  onOpenException,
  loading = false,
  refreshing = false,
}) {
  const effectiveHours = schedule?.effectiveHours || null;
  const slotInterval = Number(schedule?.slotIntervalMinutes) || DEFAULT_INTERVAL;

  const startMinutes = parseTimeToMinutes(effectiveHours?.start);
  const endMinutes = parseTimeToMinutes(effectiveHours?.end);
  const breakStartMinutes = parseTimeToMinutes(effectiveHours?.breakStart);
  const breakEndMinutes = parseTimeToMinutes(effectiveHours?.breakEnd);

  const isClosed =
    !effectiveHours ||
    effectiveHours?.isClosed ||
    !effectiveHours?.enabled ||
    startMinutes == null ||
    endMinutes == null ||
    endMinutes <= startMinutes;

  const isToday = isSameDayAsToday(dateISO);
  const nowMinutes = getNowMinutes();
  const activeExceptions = Array.isArray(exceptions)
    ? exceptions.filter((exception) => exception?.isActive !== false)
    : [];
  const dayExceptions = activeExceptions.filter((exception) => exception?.type === 'full_day');
  const timeExceptions = activeExceptions.filter((exception) => exception?.type === 'time_range');
  const hasBusinessDayBlock = dayExceptions.some((exception) => exception?.scope === 'business');
  const currentViewDayBlocked = selectedBarberId ? dayExceptions.length > 0 : hasBusinessDayBlock;

  const slots = useMemo(() => {
    if (isClosed) return [];

    const result = [];

    for (let mins = startMinutes; mins < endMinutes; mins += slotInterval) {
      const slotEnd = Math.min(mins + slotInterval, endMinutes);
      const isBreak = isInsideBreakRange(mins, breakStartMinutes, breakEndMinutes);

      const isPast = isToday ? slotEnd <= nowMinutes : false;
      const isCurrent = isToday ? nowMinutes >= mins && nowMinutes < slotEnd : false;

      result.push({
        key: getSlotKey(mins),
        minutes: mins,
        endMinutes: slotEnd,
        timeHM: formatMinutesToHHMM(mins),
        endTimeHM: formatMinutesToHHMM(slotEnd),
        isBreak,
        isPast,
        isCurrent,
      });
    }

    return result;
  }, [
    isClosed,
    startMinutes,
    endMinutes,
    slotInterval,
    breakStartMinutes,
    breakEndMinutes,
    isToday,
    nowMinutes,
  ]);

  const appointmentsBySlot = useMemo(() => {
    const map = new Map();

    for (const slot of slots) {
      map.set(slot.key, []);
    }

    for (const appointment of appointments || []) {
      const start = getMinutesFromDateValue(appointment?.startAt);
      if (start == null) continue;

      const slotStart = startMinutes != null
        ? startMinutes + Math.floor((start - startMinutes) / slotInterval) * slotInterval
        : start;

      const safeSlotStart = Math.max(startMinutes ?? slotStart, slotStart);
      const slotKey = getSlotKey(safeSlotStart);

      if (!map.has(slotKey)) {
        map.set(slotKey, []);
      }

      map.get(slotKey).push(appointment);
    }

    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        const aStart = getMinutesFromDateValue(a?.startAt) ?? 0;
        const bStart = getMinutesFromDateValue(b?.startAt) ?? 0;
        return aStart - bStart;
      });
      map.set(key, list);
    }

    return map;
  }, [appointments, slots, startMinutes, slotInterval]);

  const handleCreateAtSlot = (slot) => {
    if (slot?.isBreak || slot?.isPast) return;

    onCreateAtSlot?.({
      dateISO,
      timeHM: slot.timeHM,
      barberId: selectedBarberId || '',
    });
  };

  if (loading) {
    return (
      <section className={m('schedule-calendar is-loading')}>
        <div className={m('schedule-calendar__loading')}>
          <div className={m('schedule-calendar__loading-card')} />
          <div className={m('schedule-calendar__loading-card')} />
          <div className={m('schedule-calendar__loading-card')} />
        </div>
      </section>
    );
  }

  if (isClosed) {
    return (
      <section className={m('schedule-calendar is-empty')}>
        <div className={m('schedule-calendar__empty')}>
          <h3>Sin horario disponible</h3>
          <p>
            No hay un horario configurado para este día
            {selectedBarberId ? ' o este barbero no atiende en esta fecha.' : '.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={m('schedule-calendar')}>
      {refreshing ? (
        <div className={m('schedule-calendar__refreshing')}>
          <div className={m('schedule-calendar__refreshingCard')}>
            <span className={m('schedule-calendar__refreshingSpinner')} aria-hidden="true" />
            <div className={m('schedule-calendar__refreshingText')}>
              <strong>Cargando agenda...</strong>
              <span>Actualizando el día seleccionado</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className={m('schedule-calendar__header')}>
        <div className={m('schedule-calendar__header-main')}>
          <h3>Agenda del día</h3>
          <p>
            {effectiveHours?.source === 'barber'
              ? 'Horario personalizado del barbero'
              : 'Horario general del negocio'}
          </p>
        </div>

        <div className={m('schedule-calendar__header-meta')}>
          <span>{effectiveHours?.start} - {effectiveHours?.end}</span>

          {effectiveHours?.breakStart && effectiveHours?.breakEnd ? (
            <span>
              Descanso {effectiveHours.breakStart} - {effectiveHours.breakEnd}
            </span>
          ) : null}

          {isToday ? (
            <span className={m('is-now')}>
              Ahora: {formatMinutesToHHMM(nowMinutes)}
            </span>
          ) : null}
        </div>
      </div>

      <div className={m('schedule-calendar__toolbar')}>
        <button
          type="button"
          className={m('schedule-calendar__action')}
          onClick={() => onCreateException?.('time_range')}
        >
          {selectedBarberId ? 'Cerrar horas' : 'Cerrar horas'}
        </button>

        <button
          type="button"
          className={m('schedule-calendar__action')}
          onClick={() => onCreateException?.('full_day')}
        >
          {selectedBarberId ? 'Cerrar día' : 'Cerrar día'}
        </button>
      </div>

      {dayExceptions.length > 0 ? (
        <div className={m('schedule-calendar__day-blocks')}>
          {dayExceptions.map((exception) => (
            <button
              key={exception.id}
              type="button"
              className={m('schedule-calendar__day-block')}
              style={{ '--exception-accent': getExceptionAccent(exception) }}
              onClick={() => onOpenException?.(exception)}
            >
              <span className={m('schedule-calendar__day-blockTitle')}>
                {getExceptionLabel(exception)}
              </span>
              <span className={m('schedule-calendar__day-blockMeta')}>
                {exception.startDate === exception.endDate
                  ? exception.startDate
                  : `${exception.startDate} - ${exception.endDate}`}
              </span>
              {exception.reason ? (
                <span className={m('schedule-calendar__day-blockReason')}>
                  {exception.reason}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {currentViewDayBlocked ? (
        <div className={m('schedule-calendar__blocked')}>
          <h4>El día está bloqueado</h4>
          <p>
            La agenda no muestra disponibilidad porque existe una excepción activa para
            esta fecha.
          </p>
        </div>
      ) : null}

      {!currentViewDayBlocked ? (
      <div className={m('schedule-calendar__list')}>
        {slots.map((slot) => {
          const slotAppointments = appointmentsBySlot.get(slot.key) || [];
          const hasAppointments = slotAppointments.length > 0;
          const canCreate = !slot.isBreak && !slot.isPast;
          const slotExceptions = timeExceptions.filter((exception) =>
            exceptionOverlapsSlot(exception, slot)
          );
          const slotHasBusinessException = slotExceptions.some(
            (exception) => exception?.scope === 'business'
          );
          const slotBlocksAvailability = selectedBarberId
            ? slotExceptions.length > 0
            : slotHasBusinessException;

          return (
            <div
              key={slot.key}
              className={m(
                'schedule-calendar__slot-card',
                slot.isBreak && 'is-break',
                slot.isPast && 'is-past',
                slot.isCurrent && 'is-current',
                !hasAppointments && !slot.isBreak && 'is-available',
              )}
            >
              <div className={m('schedule-calendar__slot-time')}>
                <div className={m('schedule-calendar__slot-hour')}>
                  {slot.timeHM}
                </div>
                <div className={m('schedule-calendar__slot-range')}>
                  hasta {slot.endTimeHM}
                </div>
              </div>

              <div className={m('schedule-calendar__slot-body')}>
                {slot.isCurrent ? (
                  <div className={m('schedule-calendar__slot-now-indicator')}>
                    <span className={m('dot')} />
                    Hora actual
                  </div>
                ) : null}

                {slot.isBreak ? (
                  <div className={m('schedule-calendar__slot-state is-break')}>
                    <strong>Descanso</strong>
                    <span>
                      {effectiveHours?.breakStart} - {effectiveHours?.breakEnd}
                    </span>
                  </div>
                ) : null}

                {!slot.isBreak && slotExceptions.length > 0 ? (
                  <div className={m('schedule-calendar__exceptions-stack')}>
                    {slotExceptions.map((exception) => (
                      <button
                        key={`${exception.id}-${slot.key}`}
                        type="button"
                        className={m('schedule-calendar__exception-card')}
                        style={{ '--exception-accent': getExceptionAccent(exception) }}
                        onClick={() => onOpenException?.(exception)}
                      >
                        <div className={m('schedule-calendar__exception-top')}>
                          <span className={m('schedule-calendar__exception-title')}>
                            {getExceptionLabel(exception)}
                          </span>
                          <span className={m('schedule-calendar__exception-range')}>
                            {exception.startTime} - {exception.endTime}
                          </span>
                        </div>

                        {exception.reason ? (
                          <div className={m('schedule-calendar__exception-reason')}>
                            {exception.reason}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}

                {!slot.isBreak && !hasAppointments && !slotBlocksAvailability ? (
                  <button
                    type="button"
                    className={m(
                      'schedule-calendar__available-card',
                      canCreate && 'is-clickable',
                      slot.isPast && 'is-past',
                      slot.isCurrent && 'is-current',
                    )}
                    onClick={() => handleCreateAtSlot(slot)}
                    disabled={!canCreate}
                  >
                    <div className={m('schedule-calendar__available-top')}>
                      <span className={m('schedule-calendar__available-badge')}>
                        Disponible
                      </span>

                      <span className={m('schedule-calendar__available-range')}>
                        {slot.timeHM} - {slot.endTimeHM}
                      </span>
                    </div>

                    <p>
                      {slot.isPast
                        ? 'Este horario ya pasó'
                        : 'Haz clic para crear una cita en este horario'}
                    </p>
                  </button>
                ) : null}

                {!slot.isBreak && hasAppointments ? (
                  <div
                    className={m(
                      'schedule-calendar__appointments-stack',
                      !selectedBarberId && 'is-multi-barber',
                    )}
                  >
                    {!selectedBarberId && slotAppointments.length > 1 ? (
                      <div className={m('schedule-calendar__stack-note')}>
                        {slotAppointments.length} citas en este horario
                      </div>
                    ) : null}

                    {slotAppointments.map((appointment) => {
                      const clientName = getClientName(appointment);
                      const serviceName = getServiceName(appointment);
                      const statusLabel = getStatusLabel(appointment?.status);
                      const appStart = getMinutesFromDateValue(appointment?.startAt);
                      const displayDuration = getAppointmentDisplayDurationMinutes(
                        appointment,
                        slotInterval
                      );

                      const isUnassigned =
                        appointment?.assignmentStatus === 'unassigned' ||
                        (!appointment?.barberId && !appointment?.barber?.id) ||
                        !appointment?.barber?.name;

                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          className={m(
                            'schedule-calendar__appointment-card',
                            isUnassigned && 'is-unassigned',
                          )}
                          style={getAppointmentCardStyle(appointment)}
                          onClick={() => onOpenAppointment?.(appointment)}
                          title={`${clientName} • ${serviceName}`}
                        >
                          <div className={m('schedule-calendar__appointment-top')}>
                            <span className={m('schedule-calendar__appointment-time')}>
                              {appStart != null
                                ? formatMinutesToHHMM(appStart)
                                : slot.timeHM}
                            </span>

                            <span className={m('schedule-calendar__appointment-duration')}>
                              {displayDuration} min
                            </span>
                          </div>

                          <div className={m('schedule-calendar__appointment-client')}>
                            {clientName}
                          </div>

                          <div className={m('schedule-calendar__appointment-service')}>
                            {serviceName}
                          </div>

                          <div className={m('schedule-calendar__appointment-footer')}>
                            <span className={m('schedule-calendar__appointment-status')}>
                              {statusLabel}
                            </span>

                            {isUnassigned ? (
                              <span className={m('schedule-calendar__appointment-unassigned')}>
                                Sin asignar
                              </span>
                            ) : null}

                            {appointment?.barber?.name && !selectedBarberId ? (
                              <span className={m('schedule-calendar__appointment-barber')}>
                                {appointment.barber.name}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}

                    {canCreate ? (
                      <button
                        type="button"
                        className={m('schedule-calendar__add-inline')}
                        onClick={() => handleCreateAtSlot(slot)}
                      >
                        + Agregar cita en {slot.timeHM}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      ) : null}
    </section>
  );
}
