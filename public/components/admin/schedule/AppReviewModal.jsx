'use client';
import React from 'react';

const STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_ASSISTANCE: 'no_assistance',
};

const STATUS_LABELS = {
    [STATUS.PENDING]: 'Pendiente',
    [STATUS.CONFIRMED]: 'Confirmado',
    [STATUS.IN_PROGRESS]: 'En progreso',
    [STATUS.COMPLETED]: 'Completado',
    [STATUS.CANCELLED]: 'Cancelado',
    [STATUS.NO_ASSISTANCE]: 'No asistió',
};

const CANCEL_REASON_OPTIONS = [
    { value: '', label: 'Seleccionar motivo…' },
    { value: 'client_cancelled', label: 'Cliente canceló' },
    { value: 'client_rescheduled', label: 'Cliente reagendó' },
    { value: 'barber_unavailable', label: 'Barbero no disponible' },
    { value: 'schedule_error', label: 'Error de agenda' },
    { value: 'other', label: 'Otro' },
];

const CANCEL_REASON_LABELS = {
    '': '—',
    client_cancelled: 'Cliente canceló',
    client_rescheduled: 'Cliente reagendó',
    barber_unavailable: 'Barbero no disponible',
    schedule_error: 'Error de agenda',
    other: 'Otro',
};

const TRANSITIONS = {
    pending: ['confirmed', 'no_assistance', 'cancelled'],
    confirmed: ['in_progress', 'no_assistance', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    no_assistance: [],
    cancelled: [],
};

const ACTIONS_META = {
    confirmed: { label: 'Confirmar', variant: 'primary' },
    in_progress: { label: 'Iniciar', variant: 'primary' },
    completed: { label: 'Completar', variant: 'primary' },
    no_assistance: { label: 'No asistió', variant: 'ghost' },
    cancelled: { label: 'Cancelar cita', variant: 'danger' },
};

const buildWhatsAppLink = (phone, message) => {
    const wa = String(phone || '').replace(/[^\d]/g, '');
    if (!wa) return '';

    const clean = String(message || '')
        .normalize('NFC')
        .replace(/\r\n/g, '\n')
        .replace(/\u2028|\u2029/g, '\n');

    return `https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(clean)}`;
};

const safeDate = (v) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
};

const formatDateTime = (iso) => {
    const d = safeDate(iso);
    if (!d) return '—';

    return d.toLocaleString('es-EC', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `$${n}`;
};

const buildWaMessageByStatus = ({
    status,
    clientName,
    serviceName,
    barberName,
    startAt,
    price,
    shareLink,
}) => {
    const client = clientName ? ` ${clientName}` : '';
    const service = serviceName || 'servicio';
    const barber = barberName ? `👤 Barbero: ${barberName}\n` : '';
    const when = startAt ? `📅 ${formatDateTime(startAt)}\n` : '';
    const cost = Number(price) > 0 ? `💵 Valor: $${price}\n` : '';
    const link = shareLink ? `🔗 Detalles: ${shareLink}\n` : '';

    const base =
        `Hola${client} 👋\n` +
        `Tu cita en *ARKAD* está registrada.\n` +
        `✂️ Servicio: ${service}\n` +
        barber +
        when +
        cost +
        link;

    const footer = `\nSi necesitas cancelar o reagendar, escríbenos por aquí.`;

    switch (status) {
        case 'pending':
            return base + `\n¿Nos confirmas tu asistencia, por favor? 🙌\nQueremos asegurarnos de tener todo listo para ti.` + footer;
        case 'confirmed':
            return base + `\n¡Gracias por confirmar! ✅\nTe esperamos puntualmente.` + footer;
        case 'in_progress':
            return '';
        case 'completed':
            return `Hola${client} ✨\n¡Gracias por visitarnos! Esperamos que hayas tenido una excelente experiencia 😊\nSi te gustó el resultado, nos ayudaría muchísimo tu opinión.` + footer;
        case 'no_assistance':
            return `Hola${client} 👋\nVimos que hoy no pudiste llegar a tu cita.\nSi no vas a poder asistir, avísanos con anticipación para liberar el espacio 🙏` + footer;
        case 'cancelled':
            return `Hola${client} 👋\nTu cita fue cancelada.\nSi deseas reagendar, indícanos qué día y hora te queda mejor.` + footer;
        default:
            return base + footer;
    }
};

export default function AppReviewModal({
    open,
    appointment,
    onClose,
    onUpdateStatus,
    onTogglePaid,
    onCancel,
}) {
    const panelRef = React.useRef(null);

    const [showCancelBox, setShowCancelBox] = React.useState(false);
    const [cancelReason, setCancelReason] = React.useState('');
    const [cancelNote, setCancelNote] = React.useState('');
    const [cancelErr, setCancelErr] = React.useState('');

    React.useEffect(() => {
        if (!open) return;

        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    React.useEffect(() => {
        if (!open) return;
        setShowCancelBox(false);
        setCancelReason('');
        setCancelNote('');
        setCancelErr('');
    }, [open, appointment?.id, appointment?._id]);

    const onBackdropMouseDown = (e) => {
        if (panelRef.current && !panelRef.current.contains(e.target)) {
            onClose?.();
        }
    };

    if (!open || !appointment) return null;

    const id = appointment?.id || appointment?._id || '';

    const clientName =
        appointment?.client?.name ||
        appointment?.name ||
        `${appointment?.client?.firstName || ''} ${appointment?.client?.lastName || ''}`.trim() ||
        'Cita';

    const phone = appointment?.client?.phone || appointment?.phone || '';
    const email = appointment?.client?.email || '';
    const barberName = appointment?.barber?.name || '—';
    const serviceName =
        appointment?.serviceName ||
        appointment?.service?.name ||
        appointment?.serviceType ||
        '—';

    const notes = appointment?.notes || '';
    const startAt = appointment?.startAt || null;
    const endAt = appointment?.endAt || null;
    const status = appointment?.status || 'pending';
    const paymentStatus = appointment?.paymentStatus || 'unpaid';
    const statusHistory = Array.isArray(appointment?.statusHistory)
        ? appointment.statusHistory
        : [];
    const price = appointment?.price ?? null;
    const durationMinutes = appointment?.durationMinutes ?? null;

    const completedAt = appointment?.completedAt || null;
    const cancelledAt = appointment?.cancelledAt || null;
    const paidAt = appointment?.paidAt || null;
    const currentCancelReason = appointment?.cancelReason || '';

    const isPaid = paymentStatus === 'paid';
    const allowed = TRANSITIONS[status] || [];
    const isFinal = allowed.length === 0;

    const shareLink = appointment?.shareLink || appointment?.link || '';
    const waMessage = buildWaMessageByStatus({
        status,
        clientName,
        serviceName,
        barberName,
        startAt,
        price,
        shareLink,
    });
    const waHref = buildWhatsAppLink(phone, waMessage);

    const setStatus = (newStatus) => {
        if (!newStatus || newStatus === status) return;

        if (newStatus === STATUS.CANCELLED) {
            setShowCancelBox(true);
            setCancelErr('');
            return;
        }

        setShowCancelBox(false);
        onUpdateStatus?.(id, newStatus, appointment);
    };

    const submitCancel = () => {
        setCancelErr('');

        if (!cancelReason) {
            setCancelErr('Selecciona un motivo de cancelación');
            return;
        }

        onCancel?.(id, {
            cancelReason,
            reason: cancelNote.trim() || cancelReason,
            appointment,
        });
    };

    return (
        <div
            className="apptOverlay"
            onMouseDown={onBackdropMouseDown}
            role="dialog"
            aria-modal="true"
        >
            <div className="apptOverlay__panel" ref={panelRef}>
                <div className="apptOverlay__header">
                    <div className="apptOverlay__titleWrap">
                        <div className="apptOverlay__title">{clientName}</div>

                        <div className="apptOverlay__subtitle">
                            <span className={`apptOverlay__pill apptOverlay__pill--status s-${status}`}>
                                {STATUS_LABELS[status] || status}
                            </span>

                            <span
                                className={`apptOverlay__pill apptOverlay__pill--pay ${isPaid ? 'is-paid' : 'is-unpaid'
                                    }`}
                            >
                                {isPaid ? 'Pagado' : 'Por cobrar'}
                            </span>
                        </div>
                    </div>

                    <button
                        className="apptOverlay__close"
                        onClick={onClose}
                        type="button"
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                <div className="apptOverlay__body">
                    <div className="apptOverlay__grid">
                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Servicio</div>
                            <div className="apptOverlay__value">{serviceName}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Barbero</div>
                            <div className="apptOverlay__value">{barberName}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Teléfono</div>
                            <div className="apptOverlay__value">{phone || '—'}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Correo</div>
                            <div className="apptOverlay__value">{email || '—'}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Inicio</div>
                            <div className="apptOverlay__value">{formatDateTime(startAt)}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Fin</div>
                            <div className="apptOverlay__value">{formatDateTime(endAt)}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Duración</div>
                            <div className="apptOverlay__value">
                                {durationMinutes ? `${durationMinutes} min` : '—'}
                            </div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Valor</div>
                            <div className="apptOverlay__value">{formatMoney(price)}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Pagado el</div>
                            <div className="apptOverlay__value">{formatDateTime(paidAt)}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Completado el</div>
                            <div className="apptOverlay__value">{formatDateTime(completedAt)}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Cancelado el</div>
                            <div className="apptOverlay__value">{formatDateTime(cancelledAt)}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Motivo cancelación</div>
                            <div className="apptOverlay__value">
                                {CANCEL_REASON_LABELS[currentCancelReason] || currentCancelReason || '—'}
                            </div>
                        </div>

                        <div className="apptOverlay__field apptOverlay__field--full">
                            <div className="apptOverlay__label">Notas</div>
                            <div className="apptOverlay__value apptOverlay__notes">
                                {notes || '—'}
                            </div>
                        </div>
                    </div>

                    {!!statusHistory.length && (
                        <div className="apptOverlay__history">
                            <div className="apptOverlay__sectionTitle">Historial</div>

                            <div className="apptOverlay__historyList">
                                {statusHistory
                                    .slice()
                                    .reverse()
                                    .map((h, idx) => (
                                        <div
                                            className="apptOverlay__historyItem"
                                            key={`${h?.changedAt || idx}-${idx}`}
                                        >
                                            <div className="apptOverlay__historyMain">
                                                <strong>{STATUS_LABELS[h?.to] || h?.to || '—'}</strong>
                                                {h?.from ? (
                                                    <span> · desde {STATUS_LABELS[h.from] || h.from}</span>
                                                ) : null}
                                            </div>

                                            <div className="apptOverlay__historyMeta">
                                                {formatDateTime(h?.changedAt)}
                                                {h?.reason ? ` · ${h.reason}` : ''}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    <div className="apptOverlay__actions">
                        <div className="apptOverlay__actionsRow">
                            {!isPaid ? (
                                <button
                                    className="btn btn--money"
                                    type="button"
                                    onClick={() => onTogglePaid?.(id, 'paid', appointment)}
                                >
                                    Marcar como Pagado
                                </button>
                            ) : (
                                <>
                                    <div className="apptOverlay__paidBadge">Pagado</div>

                                    <button
                                        className="btn btn--ghost"
                                        type="button"
                                        onClick={() => onTogglePaid?.(id, 'unpaid', appointment)}
                                    >
                                        Revertir a Por cobrar
                                    </button>
                                </>
                            )}

                            <a
                                className={`btn btn--wa ${waHref ? '' : 'is-disabled'}`}
                                href={waHref || undefined}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => {
                                    if (!waHref) e.preventDefault();
                                }}
                            >
                                WhatsApp
                            </a>
                        </div>

                        <div className="apptOverlay__divider" />

                        <div className="apptOverlay__actionsRow apptOverlay__actionsRow--wrap">
                            {isFinal ? (
                                <div className="apptOverlay__finalHint">
                                    Estado final: <b>{STATUS_LABELS[status] || status}</b>
                                </div>
                            ) : (
                                <>
                                    {allowed.map((to) => {
                                        const meta = ACTIONS_META[to] || {
                                            label: STATUS_LABELS[to] || to,
                                            variant: 'ghost',
                                        };

                                        const className =
                                            meta.variant === 'primary'
                                                ? 'btn btn--primary'
                                                : meta.variant === 'danger'
                                                    ? 'btn btn--danger'
                                                    : 'btn btn--ghost';

                                        return (
                                            <button
                                                key={to}
                                                className={className}
                                                type="button"
                                                onClick={() => setStatus(to)}
                                            >
                                                {meta.label}
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        {showCancelBox && (
                            <div className="apptOverlay__cancelBox">
                                <div className="apptOverlay__cancelTitle">
                                    Confirmar cancelación
                                </div>

                                {cancelErr && (
                                    <div className="apptOverlay__cancelError">{cancelErr}</div>
                                )}

                                <div className="apptOverlay__cancelGrid">
                                    <div className="field">
                                        <label className="field__label">Motivo principal</label>
                                        <select
                                            className="field__select"
                                            value={cancelReason}
                                            onChange={(e) => setCancelReason(e.target.value)}
                                        >
                                            {CANCEL_REASON_OPTIONS.map((opt) => (
                                                <option key={opt.value || 'empty'} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="field">
                                        <label className="field__label">Nota / detalle</label>
                                        <textarea
                                            className="field__textarea"
                                            rows={3}
                                            placeholder="Ej. Cliente pidió mover la cita para mañana en la tarde"
                                            value={cancelNote}
                                            onChange={(e) => setCancelNote(e.target.value)}
                                        />
                                        <div className="field__hint">
                                            Este texto se guardará como reason en el historial.
                                        </div>
                                    </div>
                                </div>

                                <div className="apptOverlay__cancelActions">
                                    <button
                                        type="button"
                                        className="btn btn--ghost"
                                        onClick={() => {
                                            setShowCancelBox(false);
                                            setCancelReason('');
                                            setCancelNote('');
                                            setCancelErr('');
                                        }}
                                    >
                                        Volver
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn--danger"
                                        onClick={submitCancel}
                                    >
                                        Confirmar cancelación
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}