'use client';

import { useMemo } from 'react';

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

function getAppointmentDurationMinutes(appointment, fallback = DEFAULT_INTERVAL) {
  const start = getMinutesFromDateValue(appointment?.startAt);
  const end = getMinutesFromDateValue(appointment?.endAt);

  if (start != null && end != null && end > start) {
    return end - start;
  }

  return Number(appointment?.durationMinutes) || fallback;
}

export default function ScheduleCalendar({
  dateISO,
  appointments = [],
  schedule = null,
  selectedBarberId = '',
  onCreateAtSlot,
  onOpenAppointment,
  loading = false,
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
      <section className="schedule-calendar is-loading">
        <div className="schedule-calendar__loading">
          <div className="schedule-calendar__loading-card" />
          <div className="schedule-calendar__loading-card" />
          <div className="schedule-calendar__loading-card" />
        </div>
      </section>
    );
  }

  if (isClosed) {
    return (
      <section className="schedule-calendar is-empty">
        <div className="schedule-calendar__empty">
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
    <section className="schedule-calendar">
      <div className="schedule-calendar__header">
        <div className="schedule-calendar__header-main">
          <h3>Agenda del día</h3>
          <p>
            {effectiveHours?.source === 'barber'
              ? 'Horario personalizado del barbero'
              : 'Horario general del negocio'}
          </p>
        </div>

        <div className="schedule-calendar__header-meta">
          <span>{effectiveHours?.start} - {effectiveHours?.end}</span>

          {effectiveHours?.breakStart && effectiveHours?.breakEnd ? (
            <span>
              Descanso {effectiveHours.breakStart} - {effectiveHours.breakEnd}
            </span>
          ) : null}

          {isToday ? (
            <span className="is-now">
              Ahora: {formatMinutesToHHMM(nowMinutes)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="schedule-calendar__list">
        {slots.map((slot) => {
          const slotAppointments = appointmentsBySlot.get(slot.key) || [];
          const hasAppointments = slotAppointments.length > 0;
          const canCreate = !slot.isBreak && !slot.isPast;

          return (
            <div
              key={slot.key}
              className={[
                'schedule-calendar__slot-card',
                slot.isBreak ? 'is-break' : '',
                slot.isPast ? 'is-past' : '',
                slot.isCurrent ? 'is-current' : '',
                !hasAppointments && !slot.isBreak ? 'is-available' : '',
              ].join(' ')}
            >
              <div className="schedule-calendar__slot-time">
                <div className="schedule-calendar__slot-hour">
                  {slot.timeHM}
                </div>
                <div className="schedule-calendar__slot-range">
                  hasta {slot.endTimeHM}
                </div>
              </div>

              <div className="schedule-calendar__slot-body">
                {slot.isCurrent ? (
                  <div className="schedule-calendar__slot-now-indicator">
                    <span className="dot" />
                    Hora actual
                  </div>
                ) : null}

                {slot.isBreak ? (
                  <div className="schedule-calendar__slot-state is-break">
                    <strong>Descanso</strong>
                    <span>
                      {effectiveHours?.breakStart} - {effectiveHours?.breakEnd}
                    </span>
                  </div>
                ) : null}

                {!slot.isBreak && !hasAppointments ? (
                  <button
                    type="button"
                    className={[
                      'schedule-calendar__available-card',
                      canCreate ? 'is-clickable' : '',
                      slot.isPast ? 'is-past' : '',
                      slot.isCurrent ? 'is-current' : '',
                    ].join(' ')}
                    onClick={() => handleCreateAtSlot(slot)}
                    disabled={!canCreate}
                  >
                    <div className="schedule-calendar__available-top">
                      <span className="schedule-calendar__available-badge">
                        Disponible
                      </span>

                      <span className="schedule-calendar__available-range">
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
                    className={[
                      'schedule-calendar__appointments-stack',
                      !selectedBarberId ? 'is-multi-barber' : '',
                    ].join(' ')}
                  >
                    {!selectedBarberId && slotAppointments.length > 1 ? (
                      <div className="schedule-calendar__stack-note">
                        {slotAppointments.length} citas en este horario
                      </div>
                    ) : null}

                    {slotAppointments.map((appointment) => {
                      const clientName = getClientName(appointment);
                      const serviceName = getServiceName(appointment);
                      const statusLabel = getStatusLabel(appointment?.status);
                      const appStart = getMinutesFromDateValue(appointment?.startAt);
                      const duration = getAppointmentDurationMinutes(
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
                          className={[
                            'schedule-calendar__appointment-card',
                            isUnassigned ? 'is-unassigned' : '',
                          ].join(' ')}
                          style={getAppointmentCardStyle(appointment)}
                          onClick={() => onOpenAppointment?.(appointment)}
                          title={`${clientName} • ${serviceName}`}
                        >
                          <div className="schedule-calendar__appointment-top">
                            <span className="schedule-calendar__appointment-time">
                              {appStart != null
                                ? formatMinutesToHHMM(appStart)
                                : slot.timeHM}
                            </span>

                            <span className="schedule-calendar__appointment-duration">
                              {duration} min
                            </span>
                          </div>

                          <div className="schedule-calendar__appointment-client">
                            {clientName}
                          </div>

                          <div className="schedule-calendar__appointment-service">
                            {serviceName}
                          </div>

                          <div className="schedule-calendar__appointment-footer">
                            <span className="schedule-calendar__appointment-status">
                              {statusLabel}
                            </span>

                            {isUnassigned ? (
                              <span className="schedule-calendar__appointment-unassigned">
                                Sin asignar
                              </span>
                            ) : null}

                            {appointment?.barber?.name && !selectedBarberId ? (
                              <span className="schedule-calendar__appointment-barber">
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
                        className="schedule-calendar__add-inline"
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
    </section>
  );
}