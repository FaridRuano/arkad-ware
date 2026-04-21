'use client';

import React from 'react';
import styles from './ClientHistoryModal.module.scss';

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ');

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_assistance: 'No asistió',
};

const PAYMENT_LABELS = {
  unpaid: 'No pagada',
  paid: 'Pagada',
};

const SOURCE_LABELS = {
  'admin-panel': 'Panel admin',
  'client-page': 'Cliente',
};

const ASSIGNMENT_LABELS = {
  assigned: 'Asignada',
  unassigned: 'Sin asignar',
};

const CANCEL_REASON_LABELS = {
  client_cancelled: 'Cliente canceló',
  client_rescheduled: 'Cliente reagendó',
  barber_unavailable: 'Barbero no disponible',
  schedule_error: 'Error de agenda',
  other: 'Otro',
};

const STATUS_ACTION_LABELS = {
  pending: 'Marcada como pendiente',
  confirmed: 'Confirmada',
  in_progress: 'Iniciada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_assistance: 'Marcada como no asistió',
};

const safeDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const formatDateTime = (value) => {
  const date = safeDate(value);
  if (!date) return '—';

  return date.toLocaleString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount}` : '—';
};

const formatStatusHistoryLine = (entry) => {
  const action = STATUS_ACTION_LABELS[entry?.to] || STATUS_LABELS[entry?.to] || 'Actualizada';
  const actor = entry?.changedBy?.name || 'Sistema';
  return `${action} por ${actor}`;
};

export default function ClientHistoryModal({
  open,
  loading = false,
  error = '',
  client = null,
  appointments = [],
  onClose,
}) {
  const panelRef = React.useRef(null);
  const [openAppointmentId, setOpenAppointmentId] = React.useState('');

  React.useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    setOpenAppointmentId('');
  }, [open, appointments]);

  if (!open) return null;

  return (
    <div
      className={m('historyOverlay')}
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (panelRef.current && !panelRef.current.contains(event.target)) {
          onClose?.();
        }
      }}
    >
      <div className={m('historyPanel')} ref={panelRef}>
        <header className={m('historyHeader')}>
          <div className={m('historyTitleWrap')}>
            <h2 className={m('historyTitle')}>
              {client?.name ? `Historial de ${client.name}` : 'Historial del cliente'}
            </h2>
            <p className={m('historySubtitle')}>
              Revisa citas, estados, responsables y movimientos relevantes del cliente.
            </p>
            {client && (
              <div className={m('historyMeta')}>
                <span className={m('historyChip')}>{client?.cedula || 'Sin documento'}</span>
                <span className={m('historyChip')}>{client?.phone || 'Sin teléfono'}</span>
                <span className={m('historyChip')}>{client?.email || 'Sin email'}</span>
              </div>
            )}
          </div>

          <button
            className={m('historyClose')}
            type="button"
            onClick={onClose}
            aria-label="Cerrar historial"
          >
            ✕
          </button>
        </header>

        <div className={m('historyBody')}>
          {loading && (
            <div className={m('historyLoading')}>
              <div className={m('historySpinner')} />
              <div className={m('historyLoadingTitle')}>Cargando historial…</div>
              <div className={m('historyLoadingText')}>
                Estamos reuniendo las citas y movimientos del cliente.
              </div>
            </div>
          )}

          {!loading && error && (
            <div className={m('historyError')}>
              <div className={m('historyErrorTitle')}>No se pudo cargar el historial</div>
              <div className={m('historyErrorText')}>{error}</div>
            </div>
          )}

          {!loading && !error && (
            <>
              {appointments.length === 0 ? (
                <div className={m('historyEmpty')}>
                  <div className={m('historyEmptyTitle')}>Todavía no hay citas registradas</div>
                  <div className={m('historyEmptyText')}>
                    Cuando este cliente tenga citas, aquí verás el historial completo para seguimiento y auditoría.
                  </div>
                </div>
              ) : (
                <section className={m('historyTimeline')}>
                  {appointments.map((appointment) => {
                    const appointmentId = appointment?.id || appointment?._id;
                    const isOpen = openAppointmentId === appointmentId;

                    return (
                    <article
                      className={m(`historyCard ${isOpen ? 'is-open' : ''}`)}
                      key={appointmentId}
                    >
                      <button
                        type="button"
                        className={m('historyCardToggle')}
                        onClick={() => setOpenAppointmentId((current) => (current === appointmentId ? '' : appointmentId))}
                        aria-expanded={isOpen}
                      >
                        <div className={m('historyCardTop')}>
                          <div className={m('historyAppointmentMain')}>
                            <h3 className={m('historyAppointmentTitle')}>
                              {appointment?.serviceName || appointment?.service?.name || 'Servicio'}
                            </h3>
                            <div className={m('historyAppointmentDate')}>
                              {formatDateTime(appointment?.startAt)} · {appointment?.serviceDurationMinutes || appointment?.durationMinutes || '—'} min
                            </div>
                          </div>

                          <div className={m('historyCardAside')}>
                            <div className={m('historyPills')}>
                              <span className={m(`historyPill historyPillStatus_${appointment?.status || 'pending'}`)}>
                                {STATUS_LABELS[appointment?.status] || appointment?.status || '—'}
                              </span>
                              <span className={m(`historyPill historyPillPayment_${appointment?.paymentStatus || 'unpaid'}`)}>
                                {PAYMENT_LABELS[appointment?.paymentStatus] || '—'}
                              </span>
                            </div>
                            <span className={m('historyChevron')}>{isOpen ? '−' : '+'}</span>
                          </div>
                        </div>

                        <div className={m('historyCardPreview')}>
                          <span className={m('historyPreviewItem')}>Barbero: {appointment?.barber?.name || 'Sin asignar'}</span>
                          <span className={m('historyPreviewItem')}>Valor: {formatMoney(appointment?.price)}</span>
                          <span className={m('historyPreviewItem')}>
                            {SOURCE_LABELS[appointment?.source] || appointment?.source || 'Origen no definido'}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                      <>
                      <div className={m('historyGrid')}>
                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Barbero</div>
                          <div className={m('historyValue')}>{appointment?.barber?.name || 'Sin asignar'}</div>
                        </div>

                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Duración real</div>
                          <div className={m('historyValue')}>
                            {appointment?.serviceDurationMinutes || appointment?.durationMinutes || '—'} min
                          </div>
                        </div>

                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Duración agenda</div>
                          <div className={m('historyValue')}>{appointment?.durationMinutes || '—'} min</div>
                        </div>

                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Valor</div>
                          <div className={m('historyValue')}>{formatMoney(appointment?.price)}</div>
                        </div>

                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Creada por</div>
                          <div className={m('historyValue')}>{appointment?.createdBy?.name || 'Sistema'}</div>
                        </div>

                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Creada el</div>
                          <div className={m('historyValue')}>{formatDateTime(appointment?.createdAt)}</div>
                        </div>

                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Pago registrado</div>
                          <div className={m('historyValue')}>{formatDateTime(appointment?.paidAt)}</div>
                        </div>

                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Finalizada</div>
                          <div className={m('historyValue')}>{formatDateTime(appointment?.completedAt)}</div>
                        </div>

                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Asignación</div>
                          <div className={m('historyValue')}>
                            {ASSIGNMENT_LABELS[appointment?.assignmentStatus] || '—'} · {formatDateTime(appointment?.barberAssignedAt)}
                          </div>
                        </div>

                        <div className={m('historyField')}>
                          <div className={m('historyLabel')}>Cancelada el</div>
                          <div className={m('historyValue')}>{formatDateTime(appointment?.cancelledAt)}</div>
                        </div>

                        {!!appointment?.cancelReason && (
                          <div className={m('historyReasonBox historyFieldFull')}>
                            <div className={m('historyLabel')}>Motivo de cancelación</div>
                            <div className={m('historyValue')}>
                              {CANCEL_REASON_LABELS[appointment.cancelReason] || appointment.cancelReason}
                            </div>
                          </div>
                        )}

                        {!!appointment?.notes && (
                          <div className={m('historyNotesBox historyFieldFull')}>
                            <div className={m('historyLabel')}>Notas</div>
                            <div className={m('historyValue')}>{appointment.notes}</div>
                          </div>
                        )}
                      </div>

                      <section className={m('historyAudit')}>
                        <h4 className={m('historyAuditTitle')}>Movimiento de estados</h4>

                        <div className={m('historyAuditList')}>
                          {(appointment?.statusHistory || []).length > 0 ? (
                            appointment.statusHistory.map((entry) => (
                              <div className={m('historyAuditItem')} key={entry?.id || `${entry?.to}-${entry?.changedAt}`}>
                                <div className={m('historyAuditLine')}>
                                  {formatStatusHistoryLine(entry)}
                                </div>
                                <div className={m('historyAuditMeta')}>
                                  {formatDateTime(entry?.changedAt)}
                                  {entry?.reason ? ` · ${CANCEL_REASON_LABELS[entry.reason] || entry.reason}` : ''}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className={m('historyAuditItem')}>
                              <div className={m('historyAuditMeta')}>
                                No hay trazas adicionales para esta cita.
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                      </>
                      )}
                    </article>
                    );
                  })}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
